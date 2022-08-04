import { Router } from 'express';
import healthController from '../controllers/HealthController';

export default (router: Router): void => {
  router.get('/health', healthController.getBasicHealth);
};
