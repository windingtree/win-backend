import { Router } from 'express';
import hotelController from '../controllers/HotelController';

export default (router: Router): void => {
  router.get('/hotels', hotelController.getHotelsByLocation);
};
