import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app';
import { AppError } from '../src/lib/AppError';
import { validate } from '../src/middlewares/validate';

const app = createApp({
  extraRoutes: (app) => {
    app.get('/test/app-error', () => {
      throw new AppError('SLOT_FULL', 'La franja elegida ya no tiene cupo.');
    });
    app.post(
      '/test/zod',
      validate({ body: z.object({ cantidad: z.number().int().min(1) }) }, ({ body }, _req, res) => {
        res.json({ doble: body.cantidad * 2 });
      }),
    );
    app.get('/test/cast', () => {
      throw new mongoose.Error.CastError('ObjectId', 'no-es-un-id', '_id');
    });
    app.get('/test/boom', async () => {
      throw new Error('secreto');
    });
  },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler', () => {
  it('AppError → su status y code con el formato de §10', async () => {
    const res = await request(app).get('/test/app-error');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'SLOT_FULL', message: 'La franja elegida ya no tiene cupo.' },
    });
  });

  it('validate deja el body tipado si es válido', async () => {
    const res = await request(app).post('/test/zod').send({ cantidad: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ doble: 4 });
  });

  it('error de zod → 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/test/zod').send({ cantidad: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/cantidad/);
  });

  it('JSON mal formado → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/test/zod')
      .set('Content-Type', 'application/json')
      .send('{"cantidad": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('CastError de Mongoose → 400 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/test/cast');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('ruta inexistente → 404 NOT_FOUND', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('error no previsto → 500 INTERNAL_ERROR sin exponer el detalle', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/test/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.text).not.toContain('secreto');
    expect(log).toHaveBeenCalled();
  });

  it('no expone x-powered-by', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
