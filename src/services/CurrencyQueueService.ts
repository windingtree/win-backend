import { Queue, QueueScheduler, Worker } from 'bullmq';
import { QueueBaseOptions } from 'bullmq/dist/esm/interfaces/queue-options';
import { redisHost, redisPassword, redisPort, redisUsername } from '../config';
import { DateTime } from 'luxon';
import currencyService from './CurrencyService';

export class CurrencyQueueService {
  private static _instance: CurrencyQueueService = new CurrencyQueueService();
  private connectionConfig: QueueBaseOptions = {
    connection: {
      host: redisHost,
      port: redisPort,
      username: redisUsername,
      password: redisPassword
    }
  };
  private currencyQueue: Queue;
  private currencyScheduler: QueueScheduler;
  private currencyWorker: Worker | undefined;

  constructor() {
    if (CurrencyQueueService._instance) {
      throw new Error(
        'QueueService class instantiation failed. Use QueueService.getInstance() instead of new operator.'
      );
    }
    this.currencyScheduler = new QueueScheduler(
      'Currency',
      this.connectionConfig
    );
    this.currencyQueue = new Queue('Currency', this.connectionConfig);

    CurrencyQueueService._instance = this;
  }

  public static getInstance(): CurrencyQueueService {
    return CurrencyQueueService._instance;
  }

  public async addCurrencyJob(withDelay = false): Promise<void> {
    await this.currencyQueue.add(
      DateTime.now().toISOTime(),
      {},
      {
        delay: withDelay ? 24 * 60 * 60 * 1000 : 0
      }
    );
  }

  public async runCurrencyWorker(): Promise<void> {
    this.currencyWorker = new Worker(
      'Currency',
      async () => {
        await currencyService.upsertCurrenciesRates();
        const jobsCount = await this.currencyQueue.getDelayedCount();
        if (jobsCount === 0) {
          await this.addCurrencyJob(true);
        }
      },
      {
        ...this.connectionConfig,
        autorun: true
      }
    );
  }

  public async close(): Promise<void> {
    await this.currencyWorker?.close();
    await this.currencyScheduler.close();
    await this.currencyQueue.close();
  }
}
