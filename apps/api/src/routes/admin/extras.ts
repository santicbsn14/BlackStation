import { Router } from 'express';
import {
  createExtraController,
  deleteExtraController,
  extraDisponibleController,
  listExtrasController,
  updateExtraController,
} from '../../controllers/catalog';

/** `/api/admin/extras` (§8.2). */
export const adminExtrasRouter = Router();

adminExtrasRouter.get('/', listExtrasController);
adminExtrasRouter.post('/', createExtraController);
adminExtrasRouter.put('/:id', updateExtraController);
adminExtrasRouter.delete('/:id', deleteExtraController);
adminExtrasRouter.patch('/:id/disponible', extraDisponibleController);
