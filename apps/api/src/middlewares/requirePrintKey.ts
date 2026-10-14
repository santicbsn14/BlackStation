import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { getEnv } from '../config/env';
import { AppError } from '../lib/AppError';

const sha256 = (s: string) => createHash('sha256').update(s).digest();

/**
 * §9: header `X-Print-Key`. Se compara el sha256 de ambos lados con `timingSafeEqual`: mismo largo
 * siempre y tiempo constante, sin filtrar el largo ni el prefijo de la clave.
 */
export const requirePrintKey: RequestHandler = (req, _res, next) => {
  const recibida = req.get('X-Print-Key');
  if (!recibida || !timingSafeEqual(sha256(recibida), sha256(getEnv().PRINT_KEY))) {
    throw new AppError('UNAUTHORIZED', 'Clave de impresión inválida.');
  }
  next();
};
