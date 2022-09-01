import { Router } from 'express';
import proxyController from '../controllers/ProxyController';

export default (router: Router): void => {
  router.post('/hotels/offers/search', proxyController.searchOffers);
  router.post('/hotels/offers/:offerId/price', proxyController.offerPrice);

  router.get('/hotels/offers/:offerId/price', proxyController.getPricedOffer);
  router.get('/hotels/:accommodationId', proxyController.getAccommodation);
};
