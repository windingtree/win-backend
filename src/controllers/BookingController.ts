import { AuthRequest, WalletRequest } from '../types';
import { NextFunction, Request, Response } from 'express';
import bookingService from '../services/BookingService';
import rewardService from '../services/RewardService';
import groupBookingService from '../services/GroupBookingService';
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

      const expiration = await bookingService.setPassengers(
        offerId,
        passengers
      );

      res.json({ expiration });
    } catch (e) {
      next(e);
    }
  }

  public async getRewardOptions(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { offerId } = req.params;

      const data = await rewardService.getOptions(offerId);

      res.json(data);
    } catch (e) {
      next(e);
    }
  }

  public async setRewardOption(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { offerId } = req.params;
      const rewardOption = req.body.rewardType;

      await rewardService.updateOption(offerId, rewardOption);

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }

  public async createGroupBookingRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      await groupBookingService.createGroupBookingRequest(req.body);

      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }
}

export default new BookingController();
