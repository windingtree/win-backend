import { Job, Queue, QueueScheduler, Worker } from 'bullmq';
import { QueueBaseOptions } from 'bullmq/dist/esm/interfaces/queue-options';
import { GroupBookingRequestDBValue } from '../types';
import { groupDealWorker } from './GroupContractService';
import { redisHost, redisPassword, redisPort, redisUsername } from '../config';
import LogService from './LogService';

export class GroupQueueService {
  private static _instance: GroupQueueService = new GroupQueueService();
  private connectionConfig: QueueBaseOptions = {
    connection: {
      host: redisHost,
      port: redisPort,
      username: redisUsername,
      password: redisPassword
    }
  };
  private dealQueue: Queue;
  private dealScheduler: QueueScheduler;
  private dealWorker: Worker;

  constructor() {
    if (GroupQueueService._instance) {
      throw new Error(
        'QueueService class instantiation failed. Use QueueService.getInstance() instead of new operator.'
      );
    }
    let backoffDelay = 5 * 1000; // Wait 5s before retry a failed job.
    // Reduce delay for tests.
    if (process.env.NODE_IS_TEST === 'true') {
      backoffDelay = 2 * 1000;
    }
    this.dealScheduler = new QueueScheduler('GroupDeal', this.connectionConfig);
    this.dealQueue = new Queue('GroupDeal', {
      defaultJobOptions: {
        attempts: 100,
        backoff: {
          delay: backoffDelay,
          type: 'fixed'
        },
        removeOnComplete: true
      },
      connection: this.connectionConfig.connection
    });
    GroupQueueService._instance = this;
  }

  public static getInstance(): GroupQueueService {
    return GroupQueueService._instance;
  }

  // Key here is an offerId for standard flow and a requestId for group flow
  public async addDealJob(
    key: string,
    value: GroupBookingRequestDBValue
  ): Promise<void> {
    let delay = 30 * 1000; // Start 30s after the booking request.
    if (process.env.NODE_IS_TEST === 'true') {
      delay = 1 * 1000; // Reduce delay for tests.
    }
    await this.dealQueue.add(key, value, {
      jobId: key,
      delay: delay
    });
  }

  public async runGroupDealWorker(): Promise<void> {
    this.dealWorker = new Worker('GroupDeal', groupDealWorker, {
      ...this.connectionConfig,
      concurrency: 3,
      autorun: true
    });

    this.dealWorker.on('completed', async (job: Job) => {
      LogService.green(`Job completed for Request: ${job.id}`);
    });
  }

  public async getDealJob(key: string): Promise<GroupBookingRequestDBValue> {
    const job = await this.dealQueue.getJob(key);
    if (!job) {
      throw new Error('JobID not in queue');
    }
    return job.data;
  }

  // TODO: handle blockchain event.
  // We should store the event in the pending Deals, and prioritize it in the queue (and put it back in the queue if it failed and is waiting a new attempt)

  // TODO: Log all exceptions returned by the worker...
  // The only exception that is not really interesting is the lack of deal, unless this is the last attempt...

  public async close(): Promise<void> {
    await this.dealWorker?.close();
    await this.dealScheduler.close();
    await this.dealQueue.close();
  }
}
