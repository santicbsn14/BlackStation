import type { AdminSlotsResponse, SlotsResponse } from '@blackstation/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { setClock } from '../src/lib/clock';
import { PickupSlotModel, SettingsModel } from '../src/models';
import { useTestDb } from './db';
import {
  ABIERTO,
  FECHA,
  MIN,
  authAdmin,
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
});

const getSlots = async () => {
  const res = await request(app).get('/api/slots');
  expect(res.status).toBe(200);
  return res.body as SlotsResponse;
};

const getAdmin = (query = '') =>
  request(app).get(`/api/admin/slots${query}`).set('Authorization', authAdmin);

const patch = (body: unknown) =>
  request(app)
    .patch('/api/admin/slots')
    .set('Authorization', authAdmin)
    .send(body as object);

/** Documento de franja de la jornada de `FECHA` creado a mano. */
function crearSlot(hora: string, inicio: string, campos: object = {}) {
  return PickupSlotModel.create({
    fecha: FECHA,
    hora,
    inicio: new Date(inicio),
    cupoMax: 6,
    ocupados: 0,
    cerrada: false,
    ...campos,
  });
}

describe('GET /api/slots', () => {
  it.each([
    ['fuera de horario (viernes 15:00)', Date.parse('2026-10-16T18:00:00.000Z')],
    ['día inactivo (lunes 21:00)', Date.parse('2026-10-20T00:00:00.000Z')],
  ])('%s → abierto: false y slots: []', async (_caso, instante) => {
    fijarReloj(instante);
    const body = await getSlots();
    expect(body.abierto).toBe(false);
    expect(body.slots).toEqual([]);
  });

  it('pedidosHabilitados: false → abierto: false y slots: []', async () => {
    await SettingsModel.updateOne({}, { $set: { pedidosHabilitados: false } });
    const body = await getSlots();
    expect(body).toEqual({ fecha: FECHA, abierto: false, slots: [] });
  });

  it('abierto: solo franjas con anticipación, con disponibles = cupoMax', async () => {
    const body = await getSlots();
    expect(body.fecha).toBe(FECHA);
    expect(body.abierto).toBe(true);
    // 21:00 + 30 min de anticipación: desde 21:30 hasta 00:15 (la de `cierra` no se ofrece).
    expect(body.slots.map((s) => s.hora)).toEqual([
      '21:30',
      '21:45',
      '22:00',
      '22:15',
      '22:30',
      '22:45',
      '23:00',
      '23:15',
      '23:30',
      '23:45',
      '00:00',
      '00:15',
    ]);
    expect(body.slots[0]).toEqual({
      hora: '21:30',
      inicio: '2026-10-17T00:30:00.000Z',
      disponibles: 6,
    });
  });

  it('saca las cerradas y las llenas; disponibles = cupoMax − ocupados', async () => {
    await crearSlot('21:30', '2026-10-17T00:30:00.000Z', { cerrada: true });
    await crearSlot('21:45', '2026-10-17T00:45:00.000Z', { cupoMax: 3, ocupados: 3 });
    await crearSlot('22:00', '2026-10-17T01:00:00.000Z', { cupoMax: 8, ocupados: 3 });

    const { slots } = await getSlots();
    expect(slots.map((s) => s.hora)).not.toContain('21:30');
    expect(slots.map((s) => s.hora)).not.toContain('21:45');
    expect(slots.find((s) => s.hora === '22:00')?.disponibles).toBe(5);
  });

  it('jornada que cruza la medianoche: las franjas después de las 00:00 traen el inicio real', async () => {
    fijarReloj(Date.parse('2026-10-17T02:30:00.000Z')); // viernes 23:30
    const body = await getSlots();
    expect(body.fecha).toBe(FECHA);
    expect(body.slots).toEqual([
      { hora: '00:00', inicio: '2026-10-17T03:00:00.000Z', disponibles: 6 },
      { hora: '00:15', inicio: '2026-10-17T03:15:00.000Z', disponibles: 6 },
    ]);
  });

  it('pasada la medianoche sigue siendo la jornada anterior', async () => {
    fijarReloj(Date.parse('2026-10-17T03:10:00.000Z')); // sábado 00:10
    const body = await getSlots();
    expect(body.fecha).toBe(FECHA);
    expect(body.abierto).toBe(true);
    expect(body.slots).toEqual([]);
  });

  it('un pedido descuenta un lugar de su franja', async () => {
    expect((await postOrder(app, pedido({ hora: '22:00' }))).status).toBe(201);
    const { slots } = await getSlots();
    expect(slots.find((s) => s.hora === '22:00')?.disponibles).toBe(5);
  });
});

describe('GET /api/admin/slots', () => {
  it('sin token → 401', async () => {
    const res = await request(app).get('/api/admin/slots');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('jornada actual: todas las franjas posibles, sin _id si no hay documento', async () => {
    const res = await getAdmin();
    expect(res.status).toBe(200);
    const body = res.body as AdminSlotsResponse;
    expect(body.fecha).toBe(FECHA);
    expect(body.slots).toHaveLength(18);
    expect(body.slots[0]).toEqual({
      hora: '20:00',
      inicio: '2026-10-16T23:00:00.000Z',
      cupoMax: 6,
      ocupados: 0,
      cerrada: false,
      huerfana: false,
    });
    expect(body.slots.at(-1)?.hora).toBe('00:15');
  });

  it('unión con los documentos: _id en los que existen y huerfana en los que no están en la secuencia', async () => {
    const doc = await crearSlot('22:00', '2026-10-17T01:00:00.000Z', {
      cupoMax: 4,
      ocupados: 2,
      cerrada: true,
    });
    const huerfana = await crearSlot('20:10', '2026-10-16T23:10:00.000Z', { ocupados: 1 });

    const { slots } = (await getAdmin()).body as AdminSlotsResponse;
    expect(slots).toHaveLength(19);
    expect(slots.find((s) => s.hora === '22:00')).toEqual({
      _id: doc._id.toString(),
      hora: '22:00',
      inicio: '2026-10-17T01:00:00.000Z',
      cupoMax: 4,
      ocupados: 2,
      cerrada: true,
      huerfana: false,
    });
    // Ordenadas por `inicio`: la huérfana de las 20:10 queda entre 20:00 y 20:15.
    expect(slots.slice(0, 3).map((s) => s.hora)).toEqual(['20:00', '20:10', '20:15']);
    expect(slots[1]).toEqual({
      _id: huerfana._id.toString(),
      hora: '20:10',
      inicio: '2026-10-16T23:10:00.000Z',
      cupoMax: 6,
      ocupados: 1,
      cerrada: false,
      huerfana: true,
    });
  });

  it('?fecha= de otro día usa el horario de ese día', async () => {
    const res = await getAdmin('?fecha=2026-10-20');
    expect(res.status).toBe(200);
    expect(res.body.fecha).toBe('2026-10-20');
    expect(res.body.slots[0].inicio).toBe('2026-10-20T23:00:00.000Z');

    const lunes = await getAdmin('?fecha=2026-10-19');
    expect(lunes.body.slots).toEqual([]);
  });

  it('fecha inválida → 400', async () => {
    const res = await getAdmin('?fecha=16-10-2026');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'La fecha no es válida.' });
  });
});

describe('PATCH /api/admin/slots', () => {
  it('sin token → 401', async () => {
    const res = await request(app).patch('/api/admin/slots').send({ fecha: FECHA, hora: '22:00' });
    expect(res.status).toBe(401);
  });

  it('crea el documento si no existe, con los valores iniciales', async () => {
    const res = await patch({ fecha: FECHA, hora: '22:00', cupoMax: 9 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      _id: expect.any(String),
      fecha: FECHA,
      hora: '22:00',
      inicio: '2026-10-17T01:00:00.000Z',
      cupoMax: 9,
      ocupados: 0,
      cerrada: false,
      createdAt: new Date(ABIERTO).toISOString(),
      updatedAt: new Date(ABIERTO).toISOString(),
    });
    expect(await PickupSlotModel.countDocuments({ fecha: FECHA })).toBe(1);
  });

  it('una franja cerrada deja de ofrecerse en GET /api/slots', async () => {
    const res = await patch({ fecha: FECHA, hora: '22:00', cerrada: true });
    expect(res.status).toBe(200);
    expect(res.body.cerrada).toBe(true);
    expect(res.body.cupoMax).toBe(6);

    const { slots } = await getSlots();
    expect(slots.map((s) => s.hora)).not.toContain('22:00');
    expect((await postOrder(app, pedido({ hora: '22:00' }))).body.error.code).toBe('SLOT_CLOSED');

    await patch({ fecha: FECHA, hora: '22:00', cerrada: false });
    expect((await getSlots()).slots.map((s) => s.hora)).toContain('22:00');
  });

  it('cupoMax < ocupados → 400 CUPO_BELOW_OCUPADOS; igual a ocupados se acepta', async () => {
    for (let i = 0; i < 2; i++) {
      expect((await postOrder(app, pedido({ hora: '22:00' }))).status).toBe(201);
    }
    const res = await patch({ fecha: FECHA, hora: '22:00', cupoMax: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'CUPO_BELOW_OCUPADOS',
      message: 'El cupo no puede ser menor a los 2 pedidos que ya tiene la franja.',
    });
    expect((await PickupSlotModel.findOne({ fecha: FECHA, hora: '22:00' }))?.cupoMax).toBe(6);

    const ok = await patch({ fecha: FECHA, hora: '22:00', cupoMax: 2 });
    expect(ok.status).toBe(200);
    expect(ok.body.cupoMax).toBe(2);
    expect((await postOrder(app, pedido({ hora: '22:00' }))).body.error.code).toBe('SLOT_FULL');
  });

  it('hora que no es franja de esa fecha → 400 INVALID_SLOT', async () => {
    const res = await patch({ fecha: FECHA, hora: '12:00', cerrada: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'INVALID_SLOT',
      message: 'Esa franja no existe para esa fecha.',
    });
  });

  it('edita una huérfana existente aunque no esté en la secuencia', async () => {
    await crearSlot('20:10', '2026-10-16T23:10:00.000Z');
    const res = await patch({ fecha: FECHA, hora: '20:10', cerrada: true });
    expect(res.status).toBe(200);
    expect(res.body.cerrada).toBe(true);
  });

  it('actualiza updatedAt con el reloj de la API', async () => {
    await patch({ fecha: FECHA, hora: '22:00' });
    fijarReloj(ABIERTO + 5 * MIN);
    const res = await patch({ fecha: FECHA, hora: '22:00', cerrada: true });
    expect(res.body.createdAt).toBe(new Date(ABIERTO).toISOString());
    expect(res.body.updatedAt).toBe(new Date(ABIERTO + 5 * MIN).toISOString());
  });

  it.each([
    ['sin body', undefined, 'La fecha no es válida.'],
    ['fecha inválida', { fecha: '2026/10/16', hora: '22:00' }, 'La fecha no es válida.'],
    ['hora inválida', { fecha: FECHA, hora: '24:00' }, 'La hora no es válida.'],
    [
      'cupoMax negativo',
      { fecha: FECHA, hora: '22:00', cupoMax: -1 },
      'El cupo tiene que ser un entero mayor o igual a 0.',
    ],
    [
      'cupoMax no entero',
      { fecha: FECHA, hora: '22:00', cupoMax: 2.5 },
      'El cupo tiene que ser un entero mayor o igual a 0.',
    ],
    [
      'cerrada no booleana',
      { fecha: FECHA, hora: '22:00', cerrada: 'si' },
      '`cerrada` tiene que ser true o false.',
    ],
  ])('%s → 400 con el mensaje del mock', async (_caso, body, message) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message });
  });
});
