import { AuthRequest } from '../types';
import { NextFunction, Response } from 'express';
import proxyService from '../services/ProxyService';

export class ProxyController {
  /**
   * @deprecated
   */
  public async searchOffersOld(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const derbySoft = await proxyService.getDerbySoftOffersOld(
        req.body,
        'derbySoft'
      );

      const amadeus = await proxyService.getDerbySoftOffersOld(
        req.body,
        'amadeus'
      );

      res.json({
        data: {
          derbySoft,
          amadeus,
          rooms: {
            data: null,
            status: 'success'
          }
        }
      });
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
      const offers = await proxyService.getDerbySoftOffers(req.body);

      res.json(offers);
    } catch (e) {
      next(e);
    }
  }

  /**
   * @deprecated
   */
  public async offerPriceOld(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { offerId } = req.params;
      const data = await proxyService.getDerbySoftOfferPrice(offerId);

      res.json({ data, status: 'success' });
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
