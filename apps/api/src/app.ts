import cors from 'cors';
import express, { type Express } from 'express';
import { getEnv } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { healthRouter } from './routes/health';

export type CreateAppOptions = {
  /** Default: `CORS_ORIGINS` del env. */
  corsOrigins?: string[];
  /** Solo tests: rutas extra, registradas antes de `notFound`. */
  extraRoutes?: (app: Express) => void;
};

/** Arma la app sin `listen`, para poder usarla con supertest. */
export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(cors({ origin: options.corsOrigins ?? getEnv().CORS_ORIGINS }));
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRouter);
  options.extraRoutes?.(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
