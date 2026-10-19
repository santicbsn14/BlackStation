import { Router } from 'express';
import { getCustomersController, updateCustomerController } from '../../controllers/customers';

/** `/api/admin/customers` (§8.5). */
export const adminCustomersRouter = Router();

adminCustomersRouter.get('/', getCustomersController);
adminCustomersRouter.patch('/:telefono', updateCustomerController);
