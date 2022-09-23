import { Router } from 'express';
import bookingController from '../controllers/BookingController';
import walletAuthMiddleware from '../middlewares/WalletAuthMiddleware';
import sessionMiddleware from '../middlewares/SessionMiddleware';

export default (router: Router): void => {
  router.get(
    '/booking/:address',
    walletAuthMiddleware,
    bookingController.myBookings
  );
  router.post(
    '/booking/:offerId/guests',
    sessionMiddleware,
    bookingController.setPassengers
  );
  router.get(
    '/booking/:offerId/rewardOptions',
    sessionMiddleware,
    bookingController.getRewardOptions
  );
  router.post(
    '/booking/:offerId/reward',
    sessionMiddleware,
    bookingController.setRewardOption
  );
};
