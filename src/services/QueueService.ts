import { Job, Queue, QueueScheduler, Worker } from 'bullmq';
import { QueueBaseOptions } from 'bullmq/dist/esm/interfaces/queue-options';
import { DealDBValue, DealWorkerData } from '../types';
import bookingService from './BookingService';
import { sleep } from '../utils';
import { PassengerBooking } from '@windingtree/glider-types/dist/accommodations';
import dealRepository from '../repositories/DealRepository';
import offerRepository from '../repositories/OfferRepository';
import { DateTime } from 'luxon';
import { redisHost, redisPassword, redisPort, redisUsername } from '../config';

export class QueueService {
  private static _instance: QueueService = new QueueService();
  private connectionConfig: QueueBaseOptions = {
    connection: {
      host: redisHost,
      port: redisPort,
      username: redisUsername,
      password: redisPassword
    }
  };
  private contractWorker: Worker | undefined;
  private dealQueue: Queue;
  private contractQueue: Queue;
  private contractJobs: string[] = [];
  private contractScheduler: QueueScheduler;
  private dealScheduler: QueueScheduler;
  private dealWorker: Worker | undefined;

  constructor() {
    if (QueueService._instance) {
      throw new Error(
        'QueueService class instantiation failed. Use QueueService.getInstance() instead of new operator.'
      );
    }
    this.dealScheduler = new QueueScheduler('Deal', this.connectionConfig);
    this.contractScheduler = new QueueScheduler(
      'Contract',
      this.connectionConfig
    );
    this.dealQueue = new Queue('Deal', this.connectionConfig);
    this.contractQueue = new Queue('Contract', this.connectionConfig);

    QueueService._instance = this;
  }

  public static getInstance(): QueueService {
    return QueueService._instance;
  }

  public async addDealJob(key: string, value: DealWorkerData): Promise<void> {
    await this.dealQueue.add(key, value, {
      delay: this.getThrottleTime(value.startTime)
    });
  }

  public async runDealWorker(): Promise<void> {
    this.dealWorker = new Worker(
      'Deal',
      async (job: Job) => {
        const data: DealWorkerData = job.data;
        const startTime = data.startTime || DateTime.now();
        await bookingService.checkFailedDeal(
          data.id,
          data.passengers,
          startTime
        );
      },
      {
        ...this.connectionConfig,
        autorun: true
      }
    );
  }

  public async addContractJob(
    key: string,
    value: DealWorkerData
  ): Promise<Job | void> {
    if (this.contractJobs.includes(key)) {
      return;
    }
    this.contractJobs.push(key);
    if (!this.contractWorker) {
      return await this.contractQueue.add(key, value);
    }
    let workerRunning = true;
    while (workerRunning) {
      if (!this.contractWorker) {
        workerRunning = false;
        return await this.contractQueue.add(key, value);
      }
      await sleep(1000);
    }
  }

  public async runContractWorker(): Promise<void> {
    this.contractWorker = new Worker(
      'Contract',
      async (job: Job) => {
        const data: DealWorkerData = job.data;
        const offer = await offerRepository.getOne(data.id);
        let deal: DealDBValue | undefined = undefined;
        try {
          deal = await dealRepository.getDeal(data.id);
        } catch (e) {
          // it's ok
        }

        if (
          deal ||
          !offer ||
          DateTime.now() >
            DateTime.fromISO(
              (offer.expiration as unknown as Date).toISOString()
            )
        ) {
          return;
        }

        const passengers: PassengerBooking[] = [];
        Object.values(data.passengers).forEach((passenger: PassengerBooking) =>
          passengers.push(passenger)
        );
        await bookingService.setPassengers(data.id, passengers);
      },
      {
        ...this.connectionConfig,
        autorun: true
      }
    );

    //close worker after all pollers started
    this.contractWorker.on('drained', async () => {
      if (this.contractWorker) {
        await this.contractWorker.close();
        this.contractWorker = undefined;
      }
    });
  }

  public async close(): Promise<void> {
    await this.contractWorker?.close();
    await this.dealWorker?.close();
    await this.contractScheduler.close();
    await this.dealScheduler.close();
    await this.dealQueue.close();
    await this.contractQueue.close();
  }

  private getThrottleTime(dateTime: DateTime): number {
    const minutes = dateTime.diffNow('minutes').minutes;
    const minuteInMs = 60 * 1000;

    const timings = [
      {
        throttle: 5 * minuteInMs, // every 5 min
        timeout: 3 * 60 // 3 hours
      },
      {
        throttle: 30 * minuteInMs, // every 30 min
        timeout: 9 * 60 // 9 hours
      },
      {
        throttle: 60 * minuteInMs, // every  60 min
        timeout: 24 * 60 // 24 hours
      }
    ];

    for (const timing of timings) {
      if (Math.abs(minutes) < timing.timeout) {
        return timing.throttle;
      }
    }

    return 24 * 60 * minuteInMs; //1 time per day
  }
}
