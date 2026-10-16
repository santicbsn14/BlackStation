import { Router } from 'express';
import { getCatalogController } from '../controllers/catalog';
import { getPublicSettingsController } from '../controllers/settings';

/** Endpoints públicos bajo `/api` (§6), sin autenticación. */
export const publicRouter = Router();

publicRouter.get('/catalog', getCatalogController);
publicRouter.get('/public-settings', getPublicSettingsController);
