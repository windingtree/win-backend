import { AuthRequest } from '../types';
import { NextFunction, Response } from 'express';
import bookingService from '../services/BookingService';

export class BookingController {
  public async myBookings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { address } = req.params;
      const bookings = await bookingService.myBookings(address);

      res.json({ data: bookings });
    } catch (e) {
      next(e);
    }
  }

  public async setPassengers(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { offerId } = req.params;
      const passengers = req.body;

      const data = await bookingService.setPassengers(offerId, passengers);

      res.json({ data, success: true });
    } catch (e) {
      next(e);
    }
  }
}

export default new BookingController();
