import { Job, Queue, QueueScheduler, Worker } from 'bullmq';
import { QueueBaseOptions } from 'bullmq/dist/esm/interfaces/queue-options';
import { RewardWorkerData } from '../types';

import { redisHost, redisPassword, redisPort, redisUsername } from '../config';
import DealRepository from '../repositories/DealRepository';
import GroupBookingRequestRepository from '../repositories/GroupBookingRequestRepository';

// We use this queue to update the reward choice, this is safer since the deal is often in an unstable
// state when the reward choice is set.
export class RewardQueueService {
  private static _instance: RewardQueueService = new RewardQueueService();
  private connectionConfig: QueueBaseOptions = {
    connection: {
      host: redisHost,
      port: redisPort,
      username: redisUsername,
      password: redisPassword
    }
  };
  private rewardQueue: Queue;
  private rewardScheduler: QueueScheduler;
  private rewardWorker: Worker;

  constructor() {
    if (RewardQueueService._instance) {
      throw new Error(
        'QueueService class instantiation failed. Use QueueService.getInstance() instead of new operator.'
      );
    }
    let backOffDelay = 30 * 1000; // 30s
    // Reduce delay for tests.
    if (process.env.NODE_IS_TEST === 'true') {
      backOffDelay = 1 * 1000;
    }
    this.rewardScheduler = new QueueScheduler('Rewards', this.connectionConfig);
    this.rewardQueue = new Queue('Rewards', {
      defaultJobOptions: {
        attempts: 100,
        backoff: {
          delay: backOffDelay,
          type: 'fixed'
        },
        removeOnComplete: true
      },
      connection: this.connectionConfig.connection
    });
    RewardQueueService._instance = this;
  }

  public static getInstance(): RewardQueueService {
    return RewardQueueService._instance;
  }

  // Key here is an offerId for standard flow and a requestId for group flow
  public async addRewardJob(
    key: string,
    value: RewardWorkerData
  ): Promise<void> {
    await this.rewardQueue.add(key, value, {
      jobId: key
    });
  }

  public async runRewardsWorker(): Promise<void> {
    this.rewardWorker = new Worker('Rewards', rewardsWorker, {
      ...this.connectionConfig,
      autorun: true
    });

    // this.rewardWorker.on('completed', async (job: Job) => {
    //   LogService.green(`Reward updated for Id: ${job.id}`)
    // })
  }

  public async close(): Promise<void> {
    await this.rewardWorker?.close();
    await this.rewardScheduler.close();
    await this.rewardQueue.close();
  }
}

const rewardsWorker = async (job: Job) => {
  const data: RewardWorkerData = job.data;

  // Test retry
  if (process.env.NODE_IS_TEST === 'true' && job.attemptsMade == 1) {
    data.id = 'abcde';
  }

  if (data.dealType === 'Standard') {
    await DealRepository.updateRewardOption(data.id, data.rewardType);
    return;
  }

  if (data.dealType === 'Group') {
    await GroupBookingRequestRepository.updateRewardOption(
      data.id,
      data.rewardType
    );
    return;
  }
};
