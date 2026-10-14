import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { getEnv } from '../src/config/env';
import { requirePrintKey } from '../src/middlewares/requirePrintKey';

const app = createApp({
  extraRoutes: (app) => {
    app.get('/test/print', requirePrintKey, (_req, res) => {
      res.json({ ok: true });
    });
  },
});

const clave = getEnv().PRINT_KEY;

describe('requirePrintKey', () => {
  it.each([
    ['sin header', undefined],
    ['header vacío', ''],
    ['clave incorrecta del mismo largo', `${clave.slice(0, -1)}X`],
    ['clave de distinto largo', `${clave}extra`],
    ['prefijo de la clave', clave.slice(0, 10)],
  ])('%s → 401 UNAUTHORIZED', async (_caso, header) => {
    const req = request(app).get('/test/print');
    const res = await (header === undefined ? req : req.set('X-Print-Key', header));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('clave correcta → pasa', async () => {
    const res = await request(app).get('/test/print').set('X-Print-Key', clave);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
