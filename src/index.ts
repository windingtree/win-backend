import ServerService from './services/ServerService';
import { port, prometheusEnabled } from './config';
import { MetricsService } from './services/MetricsService';
import { QueueService } from './services/QueueService';

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

  await server.start();
};

export default main().catch(async (error) => {
  console.log(error);
  process.exit(1);
});
