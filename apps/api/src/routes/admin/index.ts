import { Router } from 'express';
import { requireAdmin } from '../../middlewares/requireAdmin';
import { adminSettingsRouter } from './settings';

/** `/api/admin` (§8): todo el router pasa por `requireAdmin`. */
export const adminRouter = Router();

adminRouter.use(requireAdmin);
adminRouter.use('/settings', adminSettingsRouter);
