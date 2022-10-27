import { Router } from 'express';
import proxyController from '../controllers/ProxyController';
import sessionMiddleware from '../middlewares/SessionMiddleware';

export default (router: Router): void => {
  //start @deprecated
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
  router.get(
    '/hotels/:providerHotelId',
    sessionMiddleware,
    proxyController.getHotelInfo
  );
  //end @deprecated

  router.post(
    '/accommodations/offers/search',
    sessionMiddleware,
    proxyController.searchOffers
  );
  router.post(
    '/accommodations/offers/:offerId/price',
    sessionMiddleware,
    proxyController.offerPrice
  );

  router.get(
    '/accommodations/offers/:offerId/price',
    sessionMiddleware,
    proxyController.getPricedOffer
  );
  router.post(
    '/accommodations/:providerHotelId',
    sessionMiddleware,
    proxyController.getAccommodation
  );
  router.get(
    '/accommodations/:providerHotelId',
    sessionMiddleware,
    proxyController.getHotelInfo
  );
  router.get('/currencies', sessionMiddleware, proxyController.getCurrencies);
};
