import { Router } from 'express';
import bookingController from '../controllers/BookingController';

export default (router: Router): void => {
  router.get('/booking/:address', bookingController.myBookings);
  router.post(
    '/booking/:offerId/set-passengers',
    bookingController.setPassengers
  );
};
