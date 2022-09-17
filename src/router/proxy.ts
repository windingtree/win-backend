import { Router } from 'express';
import proxyController from '../controllers/ProxyController';
import sessionMiddleware from '../middlewares/SessionMiddleware';

export default (router: Router): void => {
  router.post(
    '/hotels/offers/search',
    sessionMiddleware,
    proxyController.searchOffers
  );
  router.post('/hotels/offers/:offerId/price', proxyController.offerPrice);

  router.get('/hotels/offers/:offerId/price', proxyController.getPricedOffer);
  router.get(
    '/hotels/:accommodationId',
    sessionMiddleware,
    proxyController.getAccommodation
  );
};
