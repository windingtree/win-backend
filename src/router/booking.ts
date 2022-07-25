import { Router } from 'express';
import bookingController from '../controllers/BookingController';

export default (router: Router): void => {
  router.get('/booking', bookingController.myBookings);

  router.post('/booking', bookingController.booking);

  router.get('/booking/price/:id', bookingController.price);
};
