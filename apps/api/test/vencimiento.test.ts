import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { startVencimientoJob } from '../src/jobs/vencimiento';
import { setClock } from '../src/lib/clock';
import { OrderModel, PickupSlotModel } from '../src/models';
import { vencerPendientes } from '../src/services/vencimiento';
import { useTestDb } from './db';
import {
  ABIERTO,
  FECHA,
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

beforeEach(prepararBase);

afterEach(() => {
  setClock(null);
  vi.restoreAllMocks();
});

const ocupados = async (hora = '22:00') =>
  (await PickupSlotModel.findOne({ fecha: FECHA, hora }).lean())?.ocupados;

async function crear(metodoPago: 'retiro' | 'transferencia', hora = '22:00') {
  const res = await postOrder(app, pedido({ metodoPago, hora }));
  expect(res.status).toBe(201);
  return res.body.codigo as string;
}

describe('vencimiento perezoso', () => {
  it('antes de expiresAt sigue pendiente', async () => {
    const codigo = await crear('transferencia');
    avanzarReloj(15 * MIN - 1);
    const res = await request(app).get(`/api/orders/${codigo}`);
    expect(res.body.estado).toBe('pendiente');
    expect(await ocupados()).toBe(1);
  });

  it('con el reloj en expiresAt, GET ya lo devuelve cancelado/vencido y el cupo quedó liberado', async () => {
    const codigo = await crear('transferencia');
    avanzarReloj(15 * MIN);

    const res = await request(app).get(`/api/orders/${codigo}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      estado: 'cancelado',
      motivoCancelacion: 'vencido',
      updatedAt: new Date(ABIERTO + 15 * MIN).toISOString(),
    });
    expect((await OrderModel.findOne({ codigo }).lean())?.canceladoAt).toEqual(
      new Date(ABIERTO + 15 * MIN),
    );
    expect(await ocupados()).toBe(0);
  });

  it('cancelar un pedido vencido → 409', async () => {
    const codigo = await crear('transferencia');
    avanzarReloj(20 * MIN);
    const res = await request(app).post(`/api/orders/${codigo}/cancelar`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect((await OrderModel.findOne({ codigo }).lean())?.motivoCancelacion).toBe('vencido');
    expect(await ocupados()).toBe(0);
  });

  it('GET /api/slots ya muestra el cupo liberado', async () => {
    await crear('transferencia');
    avanzarReloj(15 * MIN);
    const res = await request(app).get('/api/slots');
    expect(res.body.slots.find((s: { hora: string }) => s.hora === '22:00')?.disponibles).toBe(6);
  });

  it('GET /api/admin/slots ya muestra el cupo liberado', async () => {
    await crear('transferencia');
    avanzarReloj(15 * MIN);
    const res = await request(app).get('/api/admin/slots').set('Authorization', authAdmin);
    expect(res.body.slots.find((s: { hora: string }) => s.hora === '22:00')?.ocupados).toBe(0);
  });

  it('PATCH /api/admin/slots vence antes de comparar con ocupados', async () => {
    await crear('transferencia');
    avanzarReloj(15 * MIN);
    const res = await request(app)
      .patch('/api/admin/slots')
      .set('Authorization', authAdmin)
      .send({ fecha: FECHA, hora: '22:00', cupoMax: 0 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cupoMax: 0, ocupados: 0 });
  });

  it('un pedido de retiro nunca vence', async () => {
    const codigo = await crear('retiro');
    fijarReloj(ABIERTO + 2 * 24 * 60 * MIN);
    expect(await vencerPendientes()).toBe(0);
    const res = await request(app).get(`/api/orders/${codigo}`);
    expect(res.body.estado).toBe('pendiente');
  });
});

describe('vencerPendientes()', () => {
  it('vence solo las transferencias con expiresAt ≤ now y devuelve cuántas', async () => {
    await crear('transferencia');
    avanzarReloj(5 * MIN);
    await crear('transferencia', '22:15');
    await crear('retiro', '22:30');

    avanzarReloj(10 * MIN); // la primera vence justo ahora; la segunda en 5 min
    expect(await vencerPendientes()).toBe(1);
    expect(await ocupados('22:00')).toBe(0);
    expect(await ocupados('22:15')).toBe(1);
    expect(await ocupados('22:30')).toBe(1);
    expect(await OrderModel.countDocuments({ estado: 'pendiente' })).toBe(2);
  });

  it('dos corridas en paralelo liberan el cupo una sola vez', async () => {
    await crear('transferencia');
    await crear('retiro');
    expect(await ocupados()).toBe(2);

    avanzarReloj(15 * MIN);
    const vencidos = await Promise.all([vencerPendientes(), vencerPendientes()]);
    expect(vencidos[0] + vencidos[1]).toBe(1);
    expect(await ocupados()).toBe(1);
  });
});

describe('startVencimientoJob()', () => {
  it('corre vencerPendientes en cada intervalo y se frena', async () => {
    const codigo = await crear('transferencia');
    avanzarReloj(15 * MIN);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const stop = startVencimientoJob(20);
    try {
      await vi.waitFor(
        async () => {
          expect((await OrderModel.findOne({ codigo }).lean())?.estado).toBe('cancelado');
        },
        { timeout: 5_000, interval: 50 },
      );
    } finally {
      stop();
    }
    expect(await ocupados()).toBe(0);
  });

  it('una corrida que falla va al log y no corta las siguientes', async () => {
    const codigo = await crear('transferencia');
    avanzarReloj(15 * MIN);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errores = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const find = vi.spyOn(OrderModel, 'find').mockImplementationOnce(() => {
      throw new Error('falla forzada');
    });

    const stop = startVencimientoJob(20);
    try {
      await vi.waitFor(
        async () => {
          expect((await OrderModel.findOne({ codigo }).lean())?.estado).toBe('cancelado');
        },
        { timeout: 5_000, interval: 50 },
      );
    } finally {
      stop();
    }
    expect(errores).toHaveBeenCalledWith('Falló el job de vencimiento:', expect.any(Error));
    expect(find.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
