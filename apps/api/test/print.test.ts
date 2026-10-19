import type { Order } from '@blackstation/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { getEnv } from '../src/config/env';
import { setClock } from '../src/lib/clock';
import { OrderModel } from '../src/models';
import { useTestDb } from './db';
import {
  ABIERTO,
  MIN,
  authAdmin,
  avanzarReloj,
  fijarReloj,
  pedido,
  postOrder,
  prepararBase,
} from './pedidos';

useTestDb();

const app = createApp();
const clave = getEnv().PRINT_KEY;

beforeEach(prepararBase);

afterEach(() => {
  setClock(null);
});

const cola = () => request(app).get('/api/print/queue').set('X-Print-Key', clave);
const ack = (id: string) => request(app).post(`/api/print/${id}/ack`).set('X-Print-Key', clave);
const iso = (ms: number) => new Date(ms).toISOString();
const ids = (res: request.Response) => res.body.orders.map((o: Order) => o._id);

async function crear(): Promise<string> {
  const res = await postOrder(app, pedido());
  expect(res.status).toBe(201);
  const order = await OrderModel.findOne({ codigo: res.body.codigo }).lean();
  return order!._id.toString();
}

const panel = (id: string, body: object) =>
  request(app).patch(`/api/admin/orders/${id}/estado`).set('Authorization', authAdmin).send(body);
const confirmar = (id: string) => panel(id, { estado: 'confirmado' });

describe('X-Print-Key', () => {
  it.each([
    ['GET /queue sin clave', () => request(app).get('/api/print/queue')],
    [
      'GET /queue con clave incorrecta',
      () => request(app).get('/api/print/queue').set('X-Print-Key', `${clave}x`),
    ],
    ['POST /:id/ack sin clave', () => request(app).post('/api/print/66f1f0000000000000000000/ack')],
    [
      'GET /queue con el token admin',
      () => request(app).get('/api/print/queue').set('Authorization', authAdmin),
    ],
  ])('%s → 401 UNAUTHORIZED', async (_caso, hacer) => {
    const res = await hacer();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /api/print/queue', () => {
  it('solo confirmados sin imprimir de la jornada actual, por confirmadoAt', async () => {
    // Confirmado sin imprimir de ayer: no aparece.
    fijarReloj(ABIERTO - 24 * 60 * MIN);
    const ayer = await crear();
    await confirmar(ayer);

    fijarReloj(ABIERTO);
    const a = await crear();
    const b = await crear();
    const pendiente = await crear();
    const cancelado = await crear();
    const impreso = await crear();
    await panel(cancelado, { estado: 'cancelado', motivoCancelacion: 'manual' });

    avanzarReloj(MIN);
    await confirmar(b);
    await confirmar(impreso);
    await OrderModel.updateOne({ _id: impreso }, { $set: { impresoAt: new Date() } });
    avanzarReloj(MIN);
    await confirmar(a);

    const res = await cola();
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([b, a]);
    expect(ids(res)).not.toContain(pendiente);
    expect(res.body.orders[0]).toMatchObject({
      _id: b,
      estado: 'confirmado',
      impresoAt: null,
      confirmadoAt: iso(ABIERTO + MIN),
      cliente: { nombre: 'Ana' },
    });
    expect(typeof res.body.orders[0].cliente.telefono).toBe('string');
  });

  it('vacía → { orders: [] }', async () => {
    const res = await cola();
    expect(res.body).toEqual({ orders: [] });
  });
});

describe('POST /api/print/:id/ack', () => {
  it('setea impresoAt (y updatedAt) y el pedido sale de la cola', async () => {
    const id = await crear();
    await confirmar(id);
    avanzarReloj(MIN);

    const res = await ack(id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, impresoAt: iso(ABIERTO + MIN) });
    const order = await OrderModel.findById(id).lean();
    expect(order?.updatedAt.toISOString()).toBe(iso(ABIERTO + MIN));
    expect(ids(await cola())).toEqual([]);
  });

  it('un segundo ack devuelve el mismo impresoAt', async () => {
    const id = await crear();
    await confirmar(id);
    await ack(id);
    avanzarReloj(5 * MIN);

    const res = await ack(id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, impresoAt: iso(ABIERTO) });
  });

  it('sobre un cancelado → 409 NOT_CONFIRMED', async () => {
    const id = await crear();
    await confirmar(id);
    await panel(id, { estado: 'cancelado', motivoCancelacion: 'manual' });

    const res = await ack(id);
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'NOT_CONFIRMED',
      message: 'El pedido ya no está confirmado.',
    });
    expect((await OrderModel.findById(id).lean())?.impresoAt).toBeNull();
  });

  it('sobre un pendiente → 409 NOT_CONFIRMED', async () => {
    const id = await crear();
    expect((await ack(id)).status).toBe(409);
  });

  it.each([
    ['inexistente', '66f1f0000000000000000000'],
    ['mal formado', 'abc'],
  ])('id %s → 404 ORDER_NOT_FOUND', async (_caso, id) => {
    const res = await ack(id);
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'ORDER_NOT_FOUND',
      message: 'No encontramos ese pedido.',
    });
  });

  it('después de reimprimir, un ack nuevo setea otro impresoAt', async () => {
    const id = await crear();
    await confirmar(id);
    await ack(id);
    avanzarReloj(MIN);
    await request(app).post(`/api/admin/orders/${id}/reprint`).set('Authorization', authAdmin);
    expect(ids(await cola())).toEqual([id]);

    avanzarReloj(MIN);
    const res = await ack(id);
    expect(res.body.impresoAt).toBe(iso(ABIERTO + 2 * MIN));
  });
});
