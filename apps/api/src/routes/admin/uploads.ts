import { Router } from 'express';
import { uploadSignatureController } from '../../controllers/uploads';

/** `/api/admin/uploads` (§8.2). */
export const adminUploadsRouter = Router();

adminUploadsRouter.post('/signature', uploadSignatureController);
