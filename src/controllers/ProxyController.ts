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
      const derbySoft = await proxyService.getDerbySoftOffers(req.body);

      res.json({
        data: {
          derbySoft,
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
      const data = await proxyService.getDerbySoftOfferPrice(offerId);

      res.json(data);
    } catch (e) {
      next(e);
    }
  }
}

export default new ProxyController();
