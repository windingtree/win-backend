import { Router } from 'express';
import proxyController from '../controllers/ProxyController';

export default (router: Router): void => {
  router.get('/derby_soft/hotels', proxyController.getAllHotels);
  router.post('/derby_soft/hotels/search', proxyController.searchHotels);
};
