import type { PublicOrder } from '@blackstation/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { setClock } from '../src/lib/clock';
import { CustomerModel, OrderModel, PickupSlotModel } from '../src/models';
import { useTestDb } from './db';
import {
  ABIERTO,
  CHEDDAR,
  FECHA,
  LOMITO_COMPLETO,
  MIN,
  avanzarReloj,
  nuevoTelefono,
  pedido,
  postOrder,
  prepararBase,
} from './pedidos';

useTestDb();

const app = createApp();

beforeEach(prepararBase);

afterEach(() => {
  setClock(null);
});

const getOrder = (codigo: string) => request(app).get(`/api/orders/${codigo}`);
const cancelar = (codigo: string) => request(app).post(`/api/orders/${codigo}/cancelar`);

const ocupados = async () =>
  (await PickupSlotModel.findOne({ fecha: FECHA, hora: '22:00' }).lean())?.ocupados;

async function crear(cambios: Record<string, unknown> = {}) {
  const res = await postOrder(app, pedido(cambios));
  expect(res.status).toBe(201);
  return res.body.codigo as string;
}

describe('GET /api/orders/:codigo', () => {
  it('devuelve el PublicOrder, sin teléfono ni campos internos', async () => {
    const telefono = nuevoTelefono();
    const codigo = await crear({
      cliente: { nombre: 'Ana', telefono },
      items: [
        {
          productoId: LOMITO_COMPLETO,
          cantidad: 1,
          quitados: ['lechuga'],
          extras: [{ extraId: CHEDDAR, cantidad: 1 }],
        },
      ],
      aclaracion: 'Sin sal',
      metodoPago: 'transferencia',
    });

    const res = await getOrder(codigo);
    expect(res.status).toBe(200);
    const creado = new Date(ABIERTO).toISOString();
    expect(res.body).toEqual({
      codigo,
      numero: 1,
      fecha: FECHA,
      horaRetiro: '22:00',
      cliente: { nombre: 'Ana' },
      items: [
        {
          productoId: LOMITO_COMPLETO,
          nombre: 'Lomito completo',
          precioUnitario: 14500,
          cantidad: 1,
          quitados: ['lechuga'],
          extras: [{ extraId: CHEDDAR, nombre: 'Cheddar extra', precio: 1200, cantidad: 1 }],
          subtotal: 15700,
        },
      ],
      aclaracion: 'Sin sal',
      metodoPago: 'transferencia',
      estado: 'pendiente',
      motivoCancelacion: null,
      total: 15700,
      expiresAt: new Date(ABIERTO + 15 * MIN).toISOString(),
      createdAt: creado,
      updatedAt: creado,
    } satisfies PublicOrder);
    expect(res.text).not.toContain(telefono);
    expect(res.text).not.toContain('slotId');
  });

  it.each([
    ['inexistente', 'ABCDEFGH'],
    ['con formato inválido', 'abc'],
  ])('codigo %s → 404 ORDER_NOT_FOUND', async (_caso, codigo) => {
    const res = await getOrder(codigo);
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'ORDER_NOT_FOUND',
      message: 'No encontramos ese pedido.',
    });
  });
});

describe('POST /api/orders/:codigo/cancelar', () => {
  it('pendiente → cancelado/cliente, libera el cupo y el customer no cambia', async () => {
    const telefono = nuevoTelefono();
    const codigo = await crear({ cliente: { nombre: 'Ana', telefono } });
    expect(await ocupados()).toBe(1);
    const customerAntes = await CustomerModel.findOne({ telefono }).lean();

    avanzarReloj(MIN);
    const res = await cancelar(codigo);
    expect(res.status).toBe(200);
    const cancelado = new Date(ABIERTO + MIN).toISOString();
    expect(res.body).toMatchObject({
      codigo,
      estado: 'cancelado',
      motivoCancelacion: 'cliente',
      updatedAt: cancelado,
    });
    expect(res.body).not.toHaveProperty('canceladoAt');
    expect((await OrderModel.findOne({ codigo }).lean())?.canceladoAt).toEqual(
      new Date(ABIERTO + MIN),
    );
    expect(await ocupados()).toBe(0);
    expect(await CustomerModel.findOne({ telefono }).lean()).toEqual(customerAntes);

    // El mismo JSON que el GET.
    expect((await getOrder(codigo)).body).toEqual(res.body);
  });

  it.each([
    ['confirmado', { estado: 'confirmado', confirmadoAt: new Date(ABIERTO) }],
    ['entregado', { estado: 'entregado', entregadoAt: new Date(ABIERTO) }],
  ])('%s → 409 INVALID_TRANSITION', async (_caso, cambios) => {
    const codigo = await crear();
    await OrderModel.updateOne({ codigo }, { $set: cambios });
    const res = await cancelar(codigo);
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'El pedido ya no se puede cancelar.',
    });
    expect(await ocupados()).toBe(1);
  });

  it('ya cancelado → 409 y no libera dos veces', async () => {
    const codigo = await crear();
    await crear(); // otro en la misma franja: ocupados 2
    expect((await cancelar(codigo)).status).toBe(200);
    expect(await ocupados()).toBe(1);

    const res = await cancelar(codigo);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect(await ocupados()).toBe(1);
  });

  it('dos cancelaciones a la vez: una da 200 y la otra 409; el cupo se libera una vez', async () => {
    const codigo = await crear();
    await crear();
    const respuestas = await Promise.all([cancelar(codigo), cancelar(codigo)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await ocupados()).toBe(1);
  });

  it('inexistente → 404 ORDER_NOT_FOUND', async () => {
    const res = await cancelar('ABCDEFGH');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });
});
