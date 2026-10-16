import { Router } from 'express';
import {
  createCategoryController,
  deleteCategoryController,
  listCategoriesController,
  updateCategoryController,
} from '../../controllers/catalog';

/** `/api/admin/categories` (§8.2). */
export const adminCategoriesRouter = Router();

adminCategoriesRouter.get('/', listCategoriesController);
adminCategoriesRouter.post('/', createCategoryController);
adminCategoriesRouter.put('/:id', updateCategoryController);
adminCategoriesRouter.delete('/:id', deleteCategoryController);
