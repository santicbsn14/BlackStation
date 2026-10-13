import type { RequestHandler } from 'express';
import { AppError } from '../lib/AppError';

export const notFound: RequestHandler = (req) => {
  throw new AppError('NOT_FOUND', `No existe ${req.method} ${req.path}.`);
};
