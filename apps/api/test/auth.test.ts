import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { getEnv } from '../src/config/env';
import { setClock } from '../src/lib/clock';
import { LOGIN_MAX_FALLOS } from '../src/lib/loginLimiter';
import { UserModel } from '../src/models';
import { runSeed } from '../src/seed/runSeed';
import { useTestDb } from './db';

useTestDb();

const app = createApp();
const admin = { usuario: 'admin', password: 'clave-de-prueba', nombre: 'Black Station' };

beforeAll(async () => {
  await runSeed({ demo: false, admin });
  await UserModel.create({
    nombre: 'Ex empleado',
    usuario: 'inactivo',
    passwordHash: await bcrypt.hash('clave-inactivo', 4),
    activo: false,
  });
});

afterEach(() => {
  setClock(null);
});

/** IP propia por test (con `trust proxy` en 1, `req.ip` sale de `X-Forwarded-For`). */
let ultimaIp = 0;
const nuevaIp = () => `10.0.${Math.floor(++ultimaIp / 250)}.${ultimaIp % 250}`;

function postLogin(ip: string, body?: object) {
  const req = request(app).post('/api/auth/login').set('X-Forwarded-For', ip);
  return body ? req.send(body) : req;
}

const credenciales = { usuario: admin.usuario, password: admin.password };
const incorrectas = { usuario: admin.usuario, password: 'mala' };

describe('POST /api/auth/login', () => {
  it('credenciales válidas → 200 { token, expiresAt, user } con expiresAt = emisión + 12 h', async () => {
    setClock(() => new Date('2026-10-14T21:00:00.000Z'));
    const res = await postLogin(nuevaIp(), credenciales);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['expiresAt', 'token', 'user']);
    expect(res.body.expiresAt).toBe('2026-10-15T09:00:00.000Z');
    expect(res.body.user).toEqual({
      _id: expect.any(String),
      nombre: 'Black Station',
      rol: 'admin',
    });
    expect(res.text).not.toContain('passwordHash');

    const payload = jwt.verify(res.body.token, getEnv().JWT_SECRET, { ignoreExpiration: true });
    expect(payload).toMatchObject({ sub: res.body.user._id, rol: 'admin' });
  });

  it.each([
    ['password incorrecto', incorrectas],
    ['usuario inexistente', { usuario: 'nadie', password: 'x' }],
    ['usuario inactivo', { usuario: 'inactivo', password: 'clave-inactivo' }],
  ])('%s → 401 INVALID_CREDENTIALS', async (_caso, body) => {
    const res = await postLogin(nuevaIp(), body);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it.each([
    ['sin body', undefined],
    ['body vacío', {}],
    ['sin password', { usuario: 'admin' }],
    ['password vacío', { usuario: 'admin', password: '' }],
  ])('%s → 400 VALIDATION_ERROR', async (_caso, body) => {
    const res = await postLogin(nuevaIp(), body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('límite de intentos', () => {
  async function fallar(ip: string, veces: number) {
    for (let i = 0; i < veces; i++) {
      const res = await postLogin(ip, incorrectas);
      expect(res.status).toBe(401);
    }
  }

  it('el intento 11 → 429 TOO_MANY_ATTEMPTS con Retry-After, aunque las credenciales sean correctas', async () => {
    setClock(() => new Date('2026-10-14T21:00:00.000Z'));
    const ip = nuevaIp();
    await fallar(ip, LOGIN_MAX_FALLOS);

    setClock(() => new Date('2026-10-14T21:05:00.000Z'));
    const res = await postLogin(ip, credenciales);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(res.headers['retry-after']).toBe('600');
  });

  it('pasados 15 min desde el primer fallo → vuelve a permitir', async () => {
    setClock(() => new Date('2026-10-14T21:00:00.000Z'));
    const ip = nuevaIp();
    await fallar(ip, LOGIN_MAX_FALLOS);
    expect((await postLogin(ip, credenciales)).status).toBe(429);

    setClock(() => new Date('2026-10-14T21:15:00.000Z'));
    expect((await postLogin(ip, credenciales)).status).toBe(200);
  });

  it('un login exitoso resetea el contador', async () => {
    const ip = nuevaIp();
    await fallar(ip, LOGIN_MAX_FALLOS - 1);
    expect((await postLogin(ip, credenciales)).status).toBe(200);
    await fallar(ip, LOGIN_MAX_FALLOS - 1);
    expect((await postLogin(ip, credenciales)).status).toBe(200);
  });

  it('otra IP no se ve afectada', async () => {
    const ip = nuevaIp();
    await fallar(ip, LOGIN_MAX_FALLOS);
    expect((await postLogin(ip, credenciales)).status).toBe(429);
    expect((await postLogin(nuevaIp(), credenciales)).status).toBe(200);
  });

  it('un 400 de validación no cuenta como fallo', async () => {
    const ip = nuevaIp();
    for (let i = 0; i < LOGIN_MAX_FALLOS; i++) {
      expect((await postLogin(ip, {})).status).toBe(400);
    }
    expect((await postLogin(ip, credenciales)).status).toBe(200);
  });
});

describe('diagnóstico de IP', () => {
  it('un login fallido y un 429 dejan req.ip y X-Forwarded-For en el log, sin usuario ni password', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const proxy = nuevaIp();
    const xff = `203.0.113.7, ${proxy}`;
    for (let i = 0; i < LOGIN_MAX_FALLOS; i++) {
      expect((await postLogin(xff, incorrectas)).status).toBe(401);
    }
    expect((await postLogin(xff, credenciales)).status).toBe(429);

    expect(warn).toHaveBeenCalledTimes(LOGIN_MAX_FALLOS + 1);
    const lineas = warn.mock.calls.map((call) => String(call[0]));
    expect(lineas[0]).toContain('login fallido');
    expect(lineas.at(-1)).toContain('TOO_MANY_ATTEMPTS');
    for (const linea of lineas) {
      // Con TRUST_PROXY=1, req.ip es el último salto del header.
      expect(linea).toContain(`req.ip=${proxy}`);
      expect(linea).toContain(`x-forwarded-for=${xff}`);
      expect(linea).not.toContain(admin.usuario);
      expect(linea).not.toContain(incorrectas.password);
      expect(linea).not.toContain(admin.password);
    }
    warn.mockRestore();
  });

  it('un login exitoso o un 400 no loguean', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect((await postLogin(nuevaIp(), credenciales)).status).toBe(200);
    expect((await postLogin(nuevaIp(), {})).status).toBe(400);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('requireAdmin (GET /api/admin/settings)', () => {
  const EMISION = new Date('2026-10-14T21:00:00.000Z');

  async function tokenValido(): Promise<string> {
    setClock(() => EMISION);
    const res = await postLogin(nuevaIp(), credenciales);
    return res.body.token;
  }

  const getSettings = (authorization?: string) => {
    const req = request(app).get('/api/admin/settings');
    return authorization ? req.set('Authorization', authorization) : req;
  };

  it('token válido → 200', async () => {
    const token = await tokenValido();
    const res = await getSettings(`Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('a las 12 h menos 1 s sigue valiendo', async () => {
    const token = await tokenValido();
    setClock(() => new Date(EMISION.getTime() + 12 * 3_600_000 - 1000));
    expect((await getSettings(`Bearer ${token}`)).status).toBe(200);
  });

  it.each([
    ['sin header', async () => undefined],
    ['sin "Bearer"', async () => await tokenValido()],
    ['token mal formado', async () => 'Bearer no-es-un-jwt'],
    [
      'firmado con otro secreto',
      async () =>
        `Bearer ${jwt.sign({ sub: 'x', rol: 'admin' }, 'otro-secreto-de-al-menos-32-caracteres!')}`,
    ],
    [
      'rol inválido',
      async () => `Bearer ${jwt.sign({ sub: 'x', rol: 'cliente' }, getEnv().JWT_SECRET)}`,
    ],
    [
      'algoritmo none',
      async () => `Bearer ${jwt.sign({ sub: 'x', rol: 'admin' }, '', { algorithm: 'none' })}`,
    ],
  ])('%s → 401 UNAUTHORIZED', async (_caso, header) => {
    const res = await getSettings(await header());
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('vencido (reloj + 12 h 1 s) → 401 UNAUTHORIZED', async () => {
    const token = await tokenValido();
    setClock(() => new Date(EMISION.getTime() + 12 * 3_600_000 + 1000));
    const res = await getSettings(`Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
