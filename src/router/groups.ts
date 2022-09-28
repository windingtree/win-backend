import { Router } from 'express';
import proxyController from '../controllers/ProxyController';
import bookingController from '../controllers/BookingController';
import sessionMiddleware from '../middlewares/SessionMiddleware';

export default (router: Router): void => {
  router.post(
    '/groups/search',
    sessionMiddleware,
    proxyController.searchGroupOffers
  );
  router.post(
    '/groups/bookingRequest',
    sessionMiddleware,
    bookingController.createGroupBookingRequest
  );
  router.get(
    '/groups/:requestId/rewardOptions',
    sessionMiddleware,
    bookingController.getGroupRewardOptions
  );
  router.post(
    '/groups/:requestId/reward',
    sessionMiddleware,
    bookingController.setGroupRewardOption
  );
};
