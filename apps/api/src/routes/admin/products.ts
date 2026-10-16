import { Router } from 'express';
import {
  createProductController,
  deleteProductController,
  listProductsController,
  productDisponibleController,
  updateProductController,
} from '../../controllers/catalog';

/** `/api/admin/products` (§8.2). */
export const adminProductsRouter = Router();

adminProductsRouter.get('/', listProductsController);
adminProductsRouter.post('/', createProductController);
adminProductsRouter.put('/:id', updateProductController);
adminProductsRouter.delete('/:id', deleteProductController);
adminProductsRouter.patch('/:id/disponible', productDisponibleController);
