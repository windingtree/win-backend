import { RouterInitializer } from '../types';
import { Router } from 'express';

import usersRoutes from './users';
import proxyRoutes from './proxy';
import bookingRoutes from './booking';
import healthRoutes from './health';
import groupsRoutes from './groups';

const routes: RouterInitializer[] = [
  usersRoutes,
  proxyRoutes,
  bookingRoutes,
  healthRoutes,
  groupsRoutes
];

const router = Router();

routes.forEach((initializer) => initializer(router));

export default router;
