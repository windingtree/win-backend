import { AuthRequest } from '../types';
import { NextFunction, Response } from 'express';
import proxyService from '../services/ProxyService';

export class ProxyController {
  public async getAllHotels(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const hotels = await proxyService.getAllHotels();

      res.json(hotels);
    } catch (e) {
      next(e);
    }
  }

  public async searchHotels(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { rectangle } = req.body;

      const hotels = await proxyService.getHotelsByRectangle(rectangle);
      res.json(hotels);
    } catch (e) {
      next(e);
    }
  }
}

export default new ProxyController();
