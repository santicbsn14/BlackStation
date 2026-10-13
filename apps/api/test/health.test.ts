import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { disconnectDb } from '../src/db/connect';
import { setClock } from '../src/lib/clock';
import { useTestDb } from './db';

useTestDb();

const app = createApp();

describe('GET /health', () => {
  it('200 { ok: true, time } con la base conectada', async () => {
    setClock(() => new Date('2026-10-10T23:00:00.000Z'));
    const res = await request(app).get('/health');
    setClock(null);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, time: '2026-10-10T23:00:00.000Z' });
  });

  it('503 { ok: false, time } con la conexión cerrada', async () => {
    await disconnectDb();
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(typeof res.body.time).toBe('string');
  });
});
