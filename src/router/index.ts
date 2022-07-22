import { RouterInitializer } from '../types';
import { Router } from 'express';

import usersRoutes from './users';
import proxyRoutes from './proxy';

const routes: RouterInitializer[] = [usersRoutes, proxyRoutes];

const router = Router();

routes.forEach((initializer) => initializer(router));

export default router;
