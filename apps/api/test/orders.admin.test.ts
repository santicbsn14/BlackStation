import type { Order } from '@blackstation/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { getEnv } from '../src/config/env';
import { setClock } from '../src/lib/clock';
import { CustomerModel, OrderModel, PickupSlotModel } from '../src/models';
import { useTestDb } from './db';
import {
  ABIERTO,
  FECHA,
  MIN,
  authAdmin,
  avanzarReloj,
  fijarReloj,
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
  vi.restoreAllMocks();
});

const listar = (query = '') =>
  request(app).get(`/api/admin/orders${query}`).set('Authorization', authAdmin);
const cambiarEstado = (id: string, body: unknown) =>
  request(app)
    .patch(`/api/admin/orders/${id}/estado`)
    .set('Authorization', authAdmin)
    .send(body as object);
const extender = (id: string) =>
  request(app).patch(`/api/admin/orders/${id}/extender`).set('Authorization', authAdmin);
const reimprimir = (id: string) =>
  request(app).post(`/api/admin/orders/${id}/reprint`).set('Authorization', authAdmin);
const cola = () => request(app).get('/api/print/queue').set('X-Print-Key', getEnv().PRINT_KEY);

const confirmar = (id: string) => cambiarEstado(id, { estado: 'confirmado' });
const entregar = (id: string) => cambiarEstado(id, { estado: 'entregado' });
const cancelar = (id: string, motivoCancelacion: string) =>
  cambiarEstado(id, { estado: 'cancelado', motivoCancelacion });

/** Crea un pedido y devuelve su `_id` y su teléfono. */
async function crear(cambios: Record<string, unknown> = {}) {
  const telefono = nuevoTelefono();
  const res = await postOrder(app, pedido({ cliente: { nombre: 'Ana', telefono }, ...cambios }));
  expect(res.status).toBe(201);
  const order = await OrderModel.findOne({ codigo: res.body.codigo }).lean();
  return { id: order!._id.toString(), telefono };
}

const ocupados = async () =>
  (await PickupSlotModel.findOne({ fecha: FECHA, hora: '22:00' }).lean())?.ocupados;
const contadores = async (telefono: string) => {
  const c = await CustomerModel.findOne({ telefono }).lean();
  return { entregados: c?.entregados, noShows: c?.noShows };
};
const iso = (ms: number) => new Date(ms).toISOString();

/** Devuelve una función que no resuelve hasta que la llamaron `n` veces. */
function barrera(n: number) {
  let llegaron = 0;
  let soltar = () => {};
  const todos = new Promise<void>((resolve) => (soltar = resolve));
  return async () => {
    if (++llegaron >= n) soltar();
    await todos;
  };
}

describe('GET /api/admin/orders', () => {
  it('sin token → 401', async () => {
    const res = await request(app).get('/api/admin/orders');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('sin query → la jornada actual, por createdAt, con el Order completo', async () => {
    // Uno de la jornada anterior (jueves 21:00), que no tiene que venir.
    fijarReloj(ABIERTO - 24 * 60 * MIN);
    await crear();
    fijarReloj(ABIERTO);
    const a = await crear();
    avanzarReloj(MIN);
    const b = await crear({ metodoPago: 'transferencia' });

    const res = await listar();
    expect(res.status).toBe(200);
    expect(res.body.orders.map((o: Order) => o._id)).toEqual([a.id, b.id]);
    const order = res.body.orders[1] as Order;
    expect(order).toMatchObject({
      _id: b.id,
      numero: 2,
      fecha: FECHA,
      cliente: { nombre: 'Ana', telefono: b.telefono },
      horaRetiro: '22:00',
      metodoPago: 'transferencia',
      estado: 'pendiente',
      expiresAt: iso(ABIERTO + 16 * MIN),
      confirmadoAt: null,
      entregadoAt: null,
      canceladoAt: null,
      motivoCancelacion: null,
      impresoAt: null,
      createdAt: iso(ABIERTO + MIN),
      updatedAt: iso(ABIERTO + MIN),
    });
    expect(typeof order.slotId).toBe('string');
    expect(typeof order.codigo).toBe('string');
  });

  it('?estado= filtra por estado', async () => {
    const a = await crear();
    const b = await crear();
    await confirmar(b.id);

    const pendientes = await listar('?estado=pendiente');
    expect(pendientes.body.orders.map((o: Order) => o._id)).toEqual([a.id]);
    const confirmados = await listar('?estado=confirmado');
    expect(confirmados.body.orders.map((o: Order) => o._id)).toEqual([b.id]);
  });

  it('?fecha= de otra jornada → los pedidos de esa jornada', async () => {
    fijarReloj(ABIERTO - 24 * 60 * MIN);
    const ayer = await crear();
    fijarReloj(ABIERTO);
    await crear();

    const res = await listar('?fecha=2026-10-15');
    expect(res.body.orders.map((o: Order) => o._id)).toEqual([ayer.id]);
  });

  it('serverTime es now − 2 s', async () => {
    const res = await listar();
    expect(res.body.serverTime).toBe(iso(ABIERTO - 2_000));
  });

  it('?since= trae solo lo actualizado después, incluido uno confirmado entre consultas', async () => {
    const a = await crear();
    const b = await crear();
    avanzarReloj(MIN);
    const primera = await listar();
    expect(primera.body.orders).toHaveLength(2);

    avanzarReloj(MIN);
    await confirmar(b.id);
    const c = await crear();
    avanzarReloj(MIN);

    const segunda = await listar(`?since=${encodeURIComponent(primera.body.serverTime)}`);
    expect(segunda.status).toBe(200);
    const ids = segunda.body.orders.map((o: Order) => o._id);
    expect(ids).toEqual([b.id, c.id]);
    expect(ids).not.toContain(a.id);
    expect(segunda.body.orders[0].estado).toBe('confirmado');
  });

  it('vence los pendientes antes de responder', async () => {
    const { id } = await crear({ metodoPago: 'transferencia' });
    avanzarReloj(16 * MIN);
    const res = await listar();
    expect(res.body.orders[0]).toMatchObject({
      _id: id,
      estado: 'cancelado',
      motivoCancelacion: 'vencido',
    });
  });

  it.each([
    ['?fecha=16-10-2026', 'La fecha no es válida.'],
    ['?estado=listo', 'El estado no es válido.'],
    ['?since=ayer', '`since` no es una fecha válida.'],
  ])('%s → 400 VALIDATION_ERROR', async (query, message) => {
    const res = await listar(query);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message });
  });
});

describe('PATCH /api/admin/orders/:id/estado', () => {
  it('sin token → 401', async () => {
    const { id } = await crear();
    const res = await request(app)
      .patch(`/api/admin/orders/${id}/estado`)
      .send({ estado: 'confirmado' });
    expect(res.status).toBe(401);
  });

  it('confirmar → confirmadoAt, impresoAt null y entra en la cola', async () => {
    const { id } = await crear();
    avanzarReloj(MIN);
    const res = await confirmar(id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      _id: id,
      estado: 'confirmado',
      confirmadoAt: iso(ABIERTO + MIN),
      impresoAt: null,
      updatedAt: iso(ABIERTO + MIN),
    });
    expect((await cola()).body.orders.map((o: Order) => o._id)).toEqual([id]);
  });

  it('entregar → entregadoAt y entregados +1', async () => {
    const { id, telefono } = await crear();
    await confirmar(id);
    const res = await entregar(id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'entregado', entregadoAt: iso(ABIERTO) });
    expect(await contadores(telefono)).toEqual({ entregados: 1, noShows: 0 });
    expect(await ocupados()).toBe(1);
  });

  it('cancelar manual desde pendiente → libera el cupo; contadores sin cambios', async () => {
    const { id, telefono } = await crear();
    expect(await ocupados()).toBe(1);
    const res = await cancelar(id, 'manual');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      estado: 'cancelado',
      motivoCancelacion: 'manual',
      canceladoAt: iso(ABIERTO),
    });
    expect(await ocupados()).toBe(0);
    expect(await contadores(telefono)).toEqual({ entregados: 0, noShows: 0 });
  });

  it('cancelar manual desde confirmado → libera el cupo; contadores sin cambios', async () => {
    const { id, telefono } = await crear();
    await confirmar(id);
    const res = await cancelar(id, 'manual');
    expect(res.status).toBe(200);
    expect(await ocupados()).toBe(0);
    expect(await contadores(telefono)).toEqual({ entregados: 0, noShows: 0 });
  });

  it('cancelar no_retiro → libera el cupo y noShows +1', async () => {
    const { id, telefono } = await crear();
    await confirmar(id);
    const res = await cancelar(id, 'no_retiro');
    expect(res.status).toBe(200);
    expect(res.body.motivoCancelacion).toBe('no_retiro');
    expect(await ocupados()).toBe(0);
    expect(await contadores(telefono)).toEqual({ entregados: 0, noShows: 1 });
  });

  it('sin customer (no existe) → cambia el estado sin crearlo', async () => {
    const { id, telefono } = await crear();
    await CustomerModel.deleteOne({ telefono });
    await confirmar(id);
    expect((await entregar(id)).status).toBe(200);
    expect(await CustomerModel.countDocuments({ telefono })).toBe(0);
  });

  describe('transiciones inválidas → 409 INVALID_TRANSITION', () => {
    const esperar409 = (res: request.Response) => {
      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({
        code: 'INVALID_TRANSITION',
        message: 'El pedido cambió de estado y ya no admite esa acción.',
      });
    };

    it('entregar un pendiente', async () => {
      const { id } = await crear();
      esperar409(await entregar(id));
    });

    it('cualquier cambio sobre un entregado', async () => {
      const { id } = await crear();
      await confirmar(id);
      await entregar(id);
      esperar409(await confirmar(id));
      esperar409(await entregar(id));
      esperar409(await cancelar(id, 'manual'));
      esperar409(await cancelar(id, 'no_retiro'));
    });

    it('cualquier cambio sobre un cancelado (sin tocar cupo ni contadores)', async () => {
      const { id, telefono } = await crear();
      await cancelar(id, 'manual');
      esperar409(await confirmar(id));
      esperar409(await entregar(id));
      esperar409(await cancelar(id, 'manual'));
      expect(await ocupados()).toBe(0);
      expect(await contadores(telefono)).toEqual({ entregados: 0, noShows: 0 });
    });

    it('no_retiro desde pendiente', async () => {
      const { id } = await crear();
      esperar409(await cancelar(id, 'no_retiro'));
    });

    it.each(['vencido', 'cliente'])('motivo %s desde el panel', async (motivo) => {
      const { id } = await crear();
      esperar409(await cancelar(id, motivo));
      await confirmar(id);
      esperar409(await cancelar(id, motivo));
      expect(await ocupados()).toBe(1);
    });

    it('confirmar un pendiente vencido', async () => {
      const { id } = await crear({ metodoPago: 'transferencia' });
      avanzarReloj(16 * MIN);
      esperar409(await confirmar(id));
      const order = await OrderModel.findById(id).lean();
      expect(order).toMatchObject({ estado: 'cancelado', motivoCancelacion: 'vencido' });
      expect(await ocupados()).toBe(0);
    });
  });

  it.each([
    ['cancelar sin motivo', { estado: 'cancelado' }],
    ['motivo inexistente', { estado: 'cancelado', motivoCancelacion: 'otro' }],
  ])('%s → 400 VALIDATION_ERROR', async (_caso, body) => {
    const { id } = await crear();
    const res = await cambiarEstado(id, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Para cancelar hace falta el motivo: `manual` o `no_retiro`.',
    });
  });

  it.each([
    ['sin estado', {}],
    ['estado inexistente', { estado: 'listo' }],
  ])('%s → 400 El estado no es válido.', async (_caso, body) => {
    const { id } = await crear();
    const res = await cambiarEstado(id, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'El estado no es válido.',
    });
  });

  it.each([
    ['inexistente', '66f1f0000000000000000000'],
    ['mal formado', 'no-es-un-id'],
  ])(':id %s → 404 ORDER_NOT_FOUND', async (_caso, id) => {
    const res = await confirmar(id);
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'ORDER_NOT_FOUND',
      message: 'No encontramos ese pedido.',
    });
  });

  describe('concurrencia', () => {
    it('confirmar y cancelar a la vez → uno 200 y otro 409, efectos una sola vez', async () => {
      const { id, telefono } = await crear();
      // Las dos requests leen `pendiente` antes de que cualquiera escriba: si no, el cancelar podría
      // leer el pedido ya confirmado y cancelarlo legítimamente.
      const original = OrderModel.findOneAndUpdate.bind(OrderModel);
      const esperar = barrera(2);
      vi.spyOn(OrderModel, 'findOneAndUpdate').mockImplementation(((
        ...args: Parameters<typeof original>
      ) => ({
        lean: async () => {
          await esperar();
          return original(...args).lean();
        },
      })) as never);

      const [a, b] = await Promise.all([confirmar(id), cancelar(id, 'manual')]);
      vi.restoreAllMocks();
      expect([a.status, b.status].sort()).toEqual([200, 409]);

      const order = await OrderModel.findById(id).lean();
      const ganador = a.status === 200 ? a : b;
      expect(order?.estado).toBe(ganador.body.estado);
      expect(await ocupados()).toBe(order?.estado === 'cancelado' ? 0 : 1);
      expect(await contadores(telefono)).toEqual({ entregados: 0, noShows: 0 });
    });

    it('dos no_retiro a la vez → noShows +1 y el cupo se libera una vez', async () => {
      const { id, telefono } = await crear();
      await crear(); // Otro pedido en la franja: ocupados no puede bajar a 0 por el piso.
      await confirmar(id);
      const res = await Promise.all([cancelar(id, 'no_retiro'), cancelar(id, 'no_retiro')]);
      expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await ocupados()).toBe(1);
      expect(await contadores(telefono)).toEqual({ entregados: 0, noShows: 1 });
    });

    it('dos entregar a la vez → entregados +1', async () => {
      const { id, telefono } = await crear();
      await confirmar(id);
      const res = await Promise.all([entregar(id), entregar(id)]);
      expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await contadores(telefono)).toEqual({ entregados: 1, noShows: 0 });
    });
  });
});

describe('PATCH /api/admin/orders/:id/extender', () => {
  it('pendiente de transferencia → expiresAt = max(expiresAt, now) + minutosTransferencia', async () => {
    const { id } = await crear({ metodoPago: 'transferencia' });
    avanzarReloj(5 * MIN);
    const res = await extender(id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      _id: id,
      estado: 'pendiente',
      expiresAt: iso(ABIERTO + 30 * MIN),
      updatedAt: iso(ABIERTO + 5 * MIN),
    });

    // Sin límite de extensiones.
    const otra = await extender(id);
    expect(otra.body.expiresAt).toBe(iso(ABIERTO + 45 * MIN));
  });

  it('uno de retiro → 409 NOT_EXTENDABLE', async () => {
    const { id } = await crear();
    const res = await extender(id);
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'NOT_EXTENDABLE',
      message: 'El pedido se paga al retirar: no tiene plazo.',
    });
  });

  it('uno vencido → 409 INVALID_TRANSITION', async () => {
    const { id } = await crear({ metodoPago: 'transferencia' });
    avanzarReloj(16 * MIN);
    const res = await extender(id);
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'El pedido ya no está pendiente.',
    });
  });

  it('uno confirmado → 409 INVALID_TRANSITION', async () => {
    const { id } = await crear({ metodoPago: 'transferencia' });
    await confirmar(id);
    expect((await extender(id)).status).toBe(409);
  });

  it(':id inexistente → 404 ORDER_NOT_FOUND', async () => {
    const res = await extender('66f1f0000000000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });
});

describe('POST /api/admin/orders/:id/reprint', () => {
  it('confirmado → impresoAt null y vuelve a la cola', async () => {
    const { id } = await crear();
    await confirmar(id);
    await OrderModel.updateOne({ _id: id }, { $set: { impresoAt: new Date(ABIERTO) } });
    expect((await cola()).body.orders).toEqual([]);

    avanzarReloj(MIN);
    const res = await reimprimir(id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const order = await OrderModel.findById(id).lean();
    expect(order?.impresoAt).toBeNull();
    expect(order?.updatedAt.toISOString()).toBe(iso(ABIERTO + MIN));
    expect((await cola()).body.orders.map((o: Order) => o._id)).toEqual([id]);
  });

  it('pendiente → 409 NOT_CONFIRMED', async () => {
    const { id } = await crear();
    const res = await reimprimir(id);
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'NOT_CONFIRMED',
      message: 'Solo se reimprimen pedidos confirmados.',
    });
  });

  it.each([
    ['inexistente', '66f1f0000000000000000000'],
    ['mal formado', 'xyz'],
  ])(':id %s → 404 ORDER_NOT_FOUND', async (_caso, id) => {
    const res = await reimprimir(id);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });
});
