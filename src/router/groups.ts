import { Router } from 'express';
import proxyController from '../controllers/ProxyController';
import bookingController from '../controllers/BookingController';

export default (router: Router): void => {
  router.post('/groups/search', proxyController.searchGroupOffers);
  router.post(
    '/groups/bookingRequest',
    bookingController.createGroupBookingRequest
  );
};
