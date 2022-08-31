import { Router } from 'express';
import bookingController from '../controllers/BookingController';
import walletAuthMiddleware from '../middlewares/WalletAuthMiddleware';

export default (router: Router): void => {
  router.get(
    '/booking/:address',
    walletAuthMiddleware,
    bookingController.myBookings
  );
  router.post('/booking/:offerId/guests', bookingController.setPassengers);
  router.get(
    '/booking/:offerId/rewardOptions',
    bookingController.getRewardOptions
  );
  router.post(
    '/booking/:offerId/reward',
    walletAuthMiddleware,
    bookingController.setRewardOption
  );
};
