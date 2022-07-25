import { RouterInitializer } from '../types';
import { Router } from 'express';

import usersRoutes from './users';
import proxyRoutes from './proxy';
import bookingRoutes from './booking';

const routes: RouterInitializer[] = [usersRoutes, proxyRoutes, bookingRoutes];

const router = Router();

routes.forEach((initializer) => initializer(router));

export default router;
