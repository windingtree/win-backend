import { AuthRequest } from '../types';
import { NextFunction, Response } from 'express';
import proxyService from '../services/ProxyService';

export class ProxyController {
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
