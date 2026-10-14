import type { Settings, UpdateSettingsRequest } from '@blackstation/shared';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { getEnv } from '../src/config/env';
import { setClock } from '../src/lib/clock';
import { PickupSlotModel, SettingsModel } from '../src/models';
import { runSeed } from '../src/seed/runSeed';
import { clearDb, useTestDb } from './db';

useTestDb();

const app = createApp();
const token = jwt.sign({ sub: '66f1d0000000000000000099', rol: 'admin' }, getEnv().JWT_SECRET, {
  expiresIn: '12h',
});
const auth = `Bearer ${token}`;

beforeEach(async () => {
  await clearDb();
  await runSeed({
    demo: false,
    admin: { usuario: 'admin', password: 'clave-de-prueba', nombre: 'Black Station' },
  });
});

afterEach(() => {
  setClock(null);
  vi.restoreAllMocks();
});

const getAdmin = () => request(app).get('/api/admin/settings').set('Authorization', auth);
const put = (body: unknown) =>
  request(app)
    .put('/api/admin/settings')
    .set('Authorization', auth)
    .send(body as object);

/** Body válido a partir de lo guardado (sin `_id`, `updatedAt` ni `reputacion`). */
async function bodyValido(): Promise<UpdateSettingsRequest> {
  const { body } = await getAdmin();
  const { _id, updatedAt, reputacion, ...resto } = body as Settings;
  void _id;
  void updatedAt;
  void reputacion;
  return resto;
}

describe('GET /api/public-settings', () => {
  it('sin auth → solo los campos de PublicSettings', async () => {
    const res = await request(app).get('/api/public-settings');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'alias',
        'anticipacionMinMin',
        'cbu',
        'horarios',
        'minutosTransferencia',
        'pedidosHabilitados',
        'telefonoLocal',
        'titular',
      ].sort(),
    );
    expect(res.body).not.toHaveProperty('mensajes');
    expect(res.body).not.toHaveProperty('cupoMaxDefault');
    expect(res.body).not.toHaveProperty('_id');
    expect(res.body.horarios).toHaveLength(7);
  });
});

describe('GET /api/admin/settings', () => {
  it('Settings completo, con _id string y updatedAt ISO', async () => {
    const res = await getAdmin();
    expect(res.status).toBe(200);
    expect(res.body._id).toMatch(/^[0-9a-f]{24}$/);
    expect(new Date(res.body.updatedAt).toISOString()).toBe(res.body.updatedAt);
    expect(res.body).toMatchObject({
      intervaloMin: 15,
      cupoMaxDefault: 6,
      mensajes: { confirmacion: expect.any(String) },
    });
  });
});

describe('PUT /api/admin/settings', () => {
  it('válido → 200 con lo guardado, updatedAt cambia y horarios ordenados por dia', async () => {
    const antes = (await getAdmin()).body as Settings;
    const body = await bodyValido();
    setClock(() => new Date('2026-10-14T22:30:00.000Z'));

    const res = await put({
      ...body,
      horarios: [...body.horarios].reverse(),
      intervaloMin: 20,
      alias: '  OTRO.ALIAS  ',
      _id: 'se-ignora',
      updatedAt: 'se-ignora',
    });

    expect(res.status).toBe(200);
    expect(res.body.updatedAt).toBe('2026-10-14T22:30:00.000Z');
    expect(res.body.updatedAt).not.toBe(antes.updatedAt);
    expect(res.body._id).toBe(antes._id);
    expect(res.body.intervaloMin).toBe(20);
    expect(res.body.alias).toBe('OTRO.ALIAS');
    expect(res.body.horarios.map((h: { dia: number }) => h.dia)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect((await getAdmin()).body).toEqual(res.body);
  });

  it('cambiar cupoMaxDefault no toca las franjas existentes', async () => {
    await PickupSlotModel.create({
      fecha: '2026-10-14',
      hora: '21:00',
      inicio: new Date('2026-10-15T00:00:00.000Z'),
      cupoMax: 6,
      ocupados: 0,
      cerrada: false,
    });
    const res = await put({ ...(await bodyValido()), cupoMaxDefault: 10 });
    expect(res.status).toBe(200);
    expect((await PickupSlotModel.findOne().lean())?.cupoMax).toBe(6);
  });

  it('reputacion en el body no pisa la guardada', async () => {
    await SettingsModel.updateOne({}, { $set: { reputacion: { umbral: 3 } } });
    const res = await put({ ...(await bodyValido()), reputacion: { umbral: 99 } });
    expect(res.status).toBe(200);
    expect(res.body.reputacion).toEqual({ umbral: 3 });
  });

  type Mutacion = (body: UpdateSettingsRequest) => unknown;
  const conHorario =
    (i: number, cambio: object): Mutacion =>
    (b) => ({
      ...b,
      horarios: b.horarios.map((h, j) => (j === i ? { ...h, ...cambio } : h)),
    });

  it.each<[string, Mutacion, string]>([
    [
      '6 horarios',
      (b) => ({ ...b, horarios: b.horarios.slice(1) }),
      'Tiene que haber un horario por día.',
    ],
    ['día repetido', conHorario(1, { dia: 0 }), 'Hay días repetidos en los horarios.'],
    [
      'abre = cierra',
      conHorario(0, { abre: '20:00', cierra: '20:00' }),
      'La apertura y el cierre no pueden ser la misma hora.',
    ],
    [
      'hora 25:00',
      conHorario(2, { abre: '25:00' }),
      'La hora de apertura del horario 3 no es válida.',
    ],
    [
      'intervalo 4',
      (b) => ({ ...b, intervaloMin: 4 }),
      'El intervalo tiene que estar entre 5 y 120 minutos.',
    ],
    [
      'intervalo 121',
      (b) => ({ ...b, intervaloMin: 121 }),
      'El intervalo tiene que estar entre 5 y 120 minutos.',
    ],
    ['cupo 0', (b) => ({ ...b, cupoMaxDefault: 0 }), 'El cupo por defecto tiene que ser 1 o más.'],
    [
      'anticipación -1',
      (b) => ({ ...b, anticipacionMinMin: -1 }),
      'La anticipación mínima tiene que ser 0 o más.',
    ],
    [
      'minutosTransferencia 1.5',
      (b) => ({ ...b, minutosTransferencia: 1.5 }),
      'Los minutos para transferir tienen que ser 1 o más.',
    ],
    [
      'teléfono inválido',
      (b) => ({ ...b, telefonoLocal: '3364123456' }),
      'El teléfono del local no es válido.',
    ],
    ['alias vacío', (b) => ({ ...b, alias: '   ' }), 'Falta el alias.'],
    [
      'mensaje vacío',
      (b) => ({ ...b, mensajes: { ...b.mensajes, recordatorio: '' } }),
      'Falta el mensaje de recordatorio.',
    ],
    [
      'pedidosHabilitados no boolean',
      (b) => ({ ...b, pedidosHabilitados: 'si' }),
      '`pedidosHabilitados` tiene que ser true o false.',
    ],
    ['sin body', () => undefined, 'Faltan los ajustes.'],
  ])('%s → 400 VALIDATION_ERROR', async (_caso, mutar, message) => {
    const res = await put(mutar(await bodyValido()));
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message });
  });

  it('sin token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .send(await bodyValido());
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('sin documento settings', () => {
  it.each([
    ['GET /api/public-settings', () => request(app).get('/api/public-settings')],
    ['GET /api/admin/settings', getAdmin],
  ])('%s → 500 INTERNAL_ERROR y avisa del seed en el log', async (_caso, hacer) => {
    const body = await bodyValido();
    await SettingsModel.deleteMany({});
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await hacer();
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('seed'));

    const resPut = await put(body);
    expect(resPut.status).toBe(500);
  });
});
