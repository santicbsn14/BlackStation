import { Router } from 'express';
import { getPublicSettingsController } from '../controllers/settings';

/** Endpoints públicos bajo `/api` (§6), sin autenticación. */
export const publicRouter = Router();

publicRouter.get('/public-settings', getPublicSettingsController);
