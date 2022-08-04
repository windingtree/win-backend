import { RouterInitializer } from '../types';
import { Router } from 'express';

import usersRoutes from './users';
import proxyRoutes from './proxy';
import bookingRoutes from './booking';
import hotelRoutes from './hotel';
import healthRoutes from './health';

const routes: RouterInitializer[] = [
  usersRoutes,
  proxyRoutes,
  bookingRoutes,
  hotelRoutes,
  healthRoutes
];

const router = Router();

routes.forEach((initializer) => initializer(router));

export default router;
