import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { getEnv } from '../src/config/env';
import { setClock } from '../src/lib/clock';

// Sin base: la firma no toca Mongo.

const app = createApp();
const token = jwt.sign({ sub: '66f1d0000000000000000099', rol: 'admin' }, getEnv().JWT_SECRET, {
  expiresIn: '12h',
});

const firmar = (body?: object) => {
  const req = request(app)
    .post('/api/admin/uploads/signature')
    .set('Authorization', `Bearer ${token}`);
  return body === undefined ? req : req.send(body);
};

afterEach(() => {
  setClock(null);
});

describe('POST /api/admin/uploads/signature', () => {
  it('firma folder + timestamp con el secret (sha1 hex)', async () => {
    setClock(() => new Date('2026-10-16T21:00:00.900Z'));
    const res = await firmar({ folder: 'products' });

    const timestamp = 1792184400; // 2026-10-16T21:00:00Z en segundos, sin los ms
    const { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } = getEnv();
    expect(CLOUDINARY_API_SECRET).toBe('test');
    const esperada = createHash('sha1')
      .update(`folder=blackstation/products&timestamp=${timestamp}test`)
      .digest('hex');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      signature: esperada,
      timestamp,
      apiKey: CLOUDINARY_API_KEY,
      cloudName: CLOUDINARY_CLOUD_NAME,
      folder: 'blackstation/products',
    });
  });

  it('folder es opcional (default products)', async () => {
    for (const res of [await firmar({}), await firmar()]) {
      expect(res.status).toBe(200);
      expect(res.body.folder).toBe('blackstation/products');
    }
  });

  it.each(['otra', 'blackstation/products', '', null, 5])('folder %j → 400', async (folder) => {
    const res = await firmar({ folder });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Carpeta inválida.' },
    });
  });
});
