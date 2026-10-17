import { Router } from 'express';
import { getAdminSlotsController, updateSlotController } from '../../controllers/slots';

/** `/api/admin/slots` (§8.3). */
export const adminSlotsRouter = Router();

adminSlotsRouter.get('/', getAdminSlotsController);
adminSlotsRouter.patch('/', updateSlotController);
