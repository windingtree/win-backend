import { Router } from 'express';
import proxyController from '../controllers/ProxyController';

export default (router: Router): void => {
  router.get('/derby-soft/hotels', proxyController.getAllHotels);
  router.get('/derby-soft/hotels/search', proxyController.searchHotels);
  router.post('/derby-soft/offers/search', proxyController.searchOffers);
  router.post('/derby-soft/offers/:offerId/price', proxyController.offerPrice);
};
