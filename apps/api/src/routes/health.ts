import type { HealthResponse } from '@blackstation/shared';
import { Router } from 'express';
import mongoose from 'mongoose';
import { now } from '../lib/clock';

export const healthRouter = Router();

// §6: 503 si Mongo no está conectado, así el monitoreo avisa también si se cae la base.
healthRouter.get('/health', (_req, res) => {
  const ok = mongoose.connection.readyState === mongoose.ConnectionStates.connected;
  const body: HealthResponse = { ok, time: now().toISOString() };
  res.status(ok ? 200 : 503).json(body);
});
