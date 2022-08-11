import ServerService from './services/ServerService';
import { port, prometheusEnabled } from './config';
import { MetricsService } from './services/MetricsService';
import EmailSenderService from './services/EmailSenderService';
import offerRepository from './repositories/OfferRepository';

process.on('unhandledRejection', async (error) => {
  console.log(error);
  process.exit(1);
});

const main = async (): Promise<void> => {
  const server = new ServerService(port);

  if (prometheusEnabled) {
    await MetricsService.startMetricsServer();
  }

  const offer = await offerRepository.getOne(
    '3a7cf3f1-1c74-4cee-8f1c-c8038d2a76cf'
  );
  const passengers = {
    PAX1: {
      type: 'ADT',
      civility: 'MR',
      lastnames: ['Marley'],
      firstnames: ['Bob'],
      gender: 'Male',
      birthdate: '1980-03-21T00:00:00Z',
      contactInformation: ['32123456789', 'galeaf11@inbox.ru']
    }
  };
  const emailService = new EmailSenderService();
  emailService.setMessage(offer, passengers);
  await emailService.sendEmail();

  await server.start();
};

export default main().catch(async (error) => {
  console.log(error);
  process.exit(1);
});
