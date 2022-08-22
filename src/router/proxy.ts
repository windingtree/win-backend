import { Router } from 'express';
import proxyController from '../controllers/ProxyController';

export default (router: Router): void => {
  /**
   * @deprecated
   */
  router.post('/derby-soft/offers/search', proxyController.searchOffersOld);
  /**
   * @deprecated
   */
  router.post(
    '/derby-soft/offers/:offerId/price',
    proxyController.offerPriceOld
  );

  router.post('/hotels/offers/search', proxyController.searchOffers);
  router.post('/hotels/offers/:offerId/price', proxyController.offerPrice);
};
