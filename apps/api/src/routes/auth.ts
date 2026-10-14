import { Router } from 'express';
import { postLogin } from '../controllers/auth';

/** `/api/auth` (§7). */
export const authRouter = Router();

authRouter.post('/login', postLogin);
