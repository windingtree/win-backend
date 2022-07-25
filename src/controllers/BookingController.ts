import { AuthRequest } from '../types';
import { NextFunction, Response } from 'express';
import bookingService from '../services/BookingService';

export class BookingController {
  public async booking(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await bookingService.booking();

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }

  public async myBookings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const bookings = await bookingService.myBookings();

      res.json({ data: bookings, success: true });
    } catch (e) {
      next(e);
    }
  }

  public async price(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const price = await bookingService.price(id);

      res.json({ data: price, success: true });
    } catch (e) {
      next(e);
    }
  }
}

export default new BookingController();
