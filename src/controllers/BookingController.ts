import { AuthRequest, WalletRequest } from '../types';
import { NextFunction, Response } from 'express';
import bookingService from '../services/BookingService';
import ApiError from '../exceptions/ApiError';

export class BookingController {
  public async myBookings(
    req: WalletRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { address } = req.params;

      if (address !== req.walletAddress) {
        throw ApiError.AccessDenied();
      }

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
