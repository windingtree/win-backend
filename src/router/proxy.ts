import { Router } from 'express';
import proxyController from '../controllers/ProxyController';
import sessionMiddleware from '../middlewares/SessionMiddleware';

export default (router: Router): void => {
  router.post(
    '/hotels/offers/search',
    sessionMiddleware,
    proxyController.searchOffers
  );
  router.post(
    '/hotels/offers/:offerId/price',
    sessionMiddleware,
    proxyController.offerPrice
  );

  router.get(
    '/hotels/offers/:offerId/price',
    sessionMiddleware,
    proxyController.getPricedOffer
  );
  router.post(
    '/hotels/:providerHotelId',
    sessionMiddleware,
    proxyController.getAccommodation
  );
};
