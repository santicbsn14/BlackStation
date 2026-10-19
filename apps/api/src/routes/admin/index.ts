import { Router } from 'express';
import { requireAdmin } from '../../middlewares/requireAdmin';
import { adminCategoriesRouter } from './categories';
import { adminCustomersRouter } from './customers';
import { adminExtrasRouter } from './extras';
import { adminOrdersRouter } from './orders';
import { adminProductsRouter } from './products';
import { adminSettingsRouter } from './settings';
import { adminSlotsRouter } from './slots';
import { adminUploadsRouter } from './uploads';

/** `/api/admin` (§8): todo el router pasa por `requireAdmin`. */
export const adminRouter = Router();

adminRouter.use(requireAdmin);
adminRouter.use('/categories', adminCategoriesRouter);
adminRouter.use('/products', adminProductsRouter);
adminRouter.use('/extras', adminExtrasRouter);
adminRouter.use('/uploads', adminUploadsRouter);
adminRouter.use('/settings', adminSettingsRouter);
adminRouter.use('/slots', adminSlotsRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/customers', adminCustomersRouter);
