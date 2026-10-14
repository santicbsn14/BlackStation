import { ROLES, type Rol } from '@blackstation/shared';
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getEnv } from '../config/env';
import { AppError } from '../lib/AppError';
import { now } from '../lib/clock';

export type AuthContext = { userId: string; rol: Rol };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- augmentation de Express
  namespace Express {
    interface Locals {
      /** Lo deja `requireAdmin`. */
      auth?: AuthContext;
    }
  }
}

const payloadSchema = z.object({ sub: z.string().min(1), rol: z.enum(ROLES) });

const BEARER = /^Bearer (\S+)$/;

/**
 * §7: valida solo firma (HS256) y vencimiento del JWT, sin consultar la base. Cualquier problema
 * (sin header, mal formado, otra firma, vencido, `rol` inválido) es 401 `UNAUTHORIZED`.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  const token = BEARER.exec(req.get('Authorization') ?? '')?.[1];
  if (!token) throw new AppError('UNAUTHORIZED', 'Falta iniciar sesión.');

  let payload: unknown;
  try {
    payload = jwt.verify(token, getEnv().JWT_SECRET, {
      algorithms: ['HS256'],
      clockTimestamp: Math.floor(now().getTime() / 1000),
    });
  } catch {
    throw new AppError('UNAUTHORIZED', 'La sesión venció o no es válida.');
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new AppError('UNAUTHORIZED', 'La sesión no es válida.');

  res.locals.auth = { userId: parsed.data.sub, rol: parsed.data.rol };
  next();
};
