import ServerService from './services/ServerService';
import { port, prometheusEnabled } from './config';
import { MetricsService } from './services/MetricsService';
import { QueueService } from './services/QueueService';
import { GroupQueueService } from './services/GroupQueueService';
import { RewardQueueService } from './services/RewardQueueService';
import { HotelQueueService } from './services/HotelQueueService';
import { CurrencyQueueService } from './services/CurrencyQueueService';

process.on('unhandledRejection', async (error) => {
  console.log(error);
  process.exit(1);
});

const main = async (): Promise<void> => {
  const server = new ServerService(port);

  if (prometheusEnabled) {
    await MetricsService.startMetricsServer();
  }

  await QueueService.getInstance().runDealWorker();
  await QueueService.getInstance().runContractWorker();
  await GroupQueueService.getInstance().runGroupDealWorker();
  await RewardQueueService.getInstance().runRewardsWorker();
  await HotelQueueService.getInstance().runHotelWorker();
  await CurrencyQueueService.getInstance().runCurrencyWorker();
  await CurrencyQueueService.getInstance().addCurrencyJob();

  await server.start();
};

export default main().catch(async (error) => {
  console.log(error);
  process.exit(1);
});
