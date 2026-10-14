import { Router } from 'express';
import { getAdminSettingsController, putAdminSettingsController } from '../../controllers/settings';

/** `/api/admin/settings` (§8.4). */
export const adminSettingsRouter = Router();

adminSettingsRouter.get('/', getAdminSettingsController);
adminSettingsRouter.put('/', putAdminSettingsController);
