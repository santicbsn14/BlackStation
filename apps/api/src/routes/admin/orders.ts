import { Router } from 'express';
import {
  extendOrderController,
  getAdminOrdersController,
  reprintOrderController,
  updateOrderEstadoController,
} from '../../controllers/orders';

/** `/api/admin/orders` (§8.1). */
export const adminOrdersRouter = Router();

adminOrdersRouter.get('/', getAdminOrdersController);
adminOrdersRouter.patch('/:id/estado', updateOrderEstadoController);
adminOrdersRouter.patch('/:id/extender', extendOrderController);
adminOrdersRouter.post('/:id/reprint', reprintOrderController);
