import { Router } from 'express';
import { getCatalogController } from '../controllers/catalog';
import {
  cancelPublicOrderController,
  createOrderController,
  getPublicOrderController,
} from '../controllers/orders';
import { getPublicSettingsController } from '../controllers/settings';
import { getPublicSlotsController } from '../controllers/slots';

/** Endpoints públicos bajo `/api` (§6), sin autenticación. */
export const publicRouter = Router();

publicRouter.get('/catalog', getCatalogController);
publicRouter.get('/public-settings', getPublicSettingsController);
publicRouter.get('/slots', getPublicSlotsController);
publicRouter.post('/orders', createOrderController);
publicRouter.get('/orders/:codigo', getPublicOrderController);
publicRouter.post('/orders/:codigo/cancelar', cancelPublicOrderController);
