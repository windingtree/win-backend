import { AuthRequest, WalletRequest } from '../types';
import { NextFunction, Response } from 'express';
import bookingService from '../services/BookingService';
import rewardService from '../services/RewardService';
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

      res.json(bookings);
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

  public async getRewardOptions(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { offerId } = req.params;

      const data = await rewardService.getOptions(offerId);

      res.json({ data, success: true });
    } catch (e) {
      next(e);
    }
  }

  public async setRewardOption(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { offerId } = req.params;
      const rewardOption = req.body.rewardType;

      await rewardService.updateOptions(offerId, rewardOption);

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }
}

export default new BookingController();
