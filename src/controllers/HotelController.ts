import { AuthRequest } from '../types';
import { NextFunction, Response } from 'express';
import { defaultRadius } from '../config';
import hotelRepository from '../repositories/HotelRepository';

export class HotelController {
  public async getHotelsByLocation(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const lon = Number(req.query.lon);
      const lat = Number(req.query.lat);
      let radius = Number(req.query.radius);

      if (!radius) {
        radius = defaultRadius;
      }

      const hotels = await hotelRepository.searchByRadius(lon, lat, radius);

      res.json({ data: Array.from(hotels) });
    } catch (e) {
      next(e);
    }
  }
}

export default new HotelController();
