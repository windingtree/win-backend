import { Job, Queue, QueueScheduler, Worker } from 'bullmq';
import { QueueBaseOptions } from 'bullmq/dist/esm/interfaces/queue-options';
import { CachedWinAccommodation } from '../types';
import { redisHost, redisPassword, redisPort, redisUsername } from '../config';
import { WinAccommodation } from '@windingtree/glider-types/dist/win';
import cachedHotelRepository from '../repositories/CachedHotelRepository';

export class HotelQueueService {
  private static _instance: HotelQueueService = new HotelQueueService();
  private connectionConfig: QueueBaseOptions = {
    connection: {
      host: redisHost,
      port: redisPort,
      username: redisUsername,
      password: redisPassword
    }
  };
  private hotelQueue: Queue;
  private hotelScheduler: QueueScheduler;
  private hotelWorker: Worker | undefined;

  constructor() {
    if (HotelQueueService._instance) {
      throw new Error(
        'QueueService class instantiation failed. Use QueueService.getInstance() instead of new operator.'
      );
    }
    this.hotelScheduler = new QueueScheduler('Hotel', this.connectionConfig);
    this.hotelQueue = new Queue('Hotel', this.connectionConfig);

    HotelQueueService._instance = this;
  }

  public static getInstance(): HotelQueueService {
    return HotelQueueService._instance;
  }

  public addHotelJobs(value: WinAccommodation[]): void {
    if (process.env.NODE_IS_TEST === 'true') return;

    for (const accommodation of value) {
      const hotel: CachedWinAccommodation = {
        checkinoutPolicy: accommodation.checkinoutPolicy,
        contactInformation: accommodation.contactInformation,
        description: accommodation.description,
        hotelId: accommodation.hotelId,
        id: accommodation.id,
        location: accommodation.location,
        media: accommodation.media,
        name: accommodation.name,
        otherPolicies: accommodation.otherPolicies,
        provider: accommodation.provider,
        providerHotelId: accommodation.providerHotelId,
        rating: accommodation.rating,
        roomTypes: accommodation.roomTypes,
        type: accommodation.type
      };
      this.addHotelJob(hotel.hotelId, hotel).catch((e) => console.log(e));
    }
  }

  public async addHotelJob(
    key: string,
    value: CachedWinAccommodation
  ): Promise<void> {
    await this.hotelQueue.add(key, value); // 5 minutes
  }

  public async runHotelWorker(): Promise<void> {
    this.hotelWorker = new Worker(
      'Hotel',
      async (job: Job) => {
        const data: CachedWinAccommodation = job.data;
        await cachedHotelRepository.upsert(data);
      },
      {
        ...this.connectionConfig,
        autorun: true
      }
    );
  }

  public async close(): Promise<void> {
    await this.hotelWorker?.close();
    await this.hotelScheduler.close();
    await this.hotelQueue.close();
  }
}
