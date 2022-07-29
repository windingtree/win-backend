import { AuthRequest } from '../types';
import { NextFunction, Response } from 'express';
import proxyService from '../services/ProxyService';
import { defaultRadius } from '../config';

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
      const lon = Number(req.query.lon);
      const lat = Number(req.query.lat);
      let radius = Number(req.query.radius);

      if (!radius) {
        radius = defaultRadius;
      }

      const hotels = await proxyService.getHotels(lon, lat, radius);
      res.json({ data: hotels });
    } catch (e) {
      next(e);
    }
  }

  public async searchOffers(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const hotels = await proxyService.getDerbySoftOffers(req.body);

      res.json({
        data: {
          derbySoft: hotels,
          rooms: {
            data: {},
            status: 'success'
          }
        }
      });
    } catch (e) {
      next(e);
    }
  }

  public async offerPrice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { offerId } = req.params;
      const offer = await proxyService.getDerbySoftOfferPrice(offerId);

      res.json(offer);
    } catch (e) {
      next(e);
    }
  }
}

export default new ProxyController();
