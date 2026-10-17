import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import request from 'supertest';
import { getEnv } from '../src/config/env';
import { setClock } from '../src/lib/clock';
import { runSeed } from '../src/seed/runSeed';
import { clearDb } from './db';

// Helpers de los tests de franjas y pedidos. Reloj en una jornada abierta de los defaults de §3.7
// (martes a domingo 20:00–00:30).

/** Viernes 2026-10-16, 21:00 en Buenos Aires. */
export const ABIERTO = Date.parse('2026-10-17T00:00:00.000Z');
export const FECHA = '2026-10-16';
export const MIN = 60_000;

let ahora = ABIERTO;

/** Fija el reloj de la API en `instante` (ms) y lo deja ahí hasta el próximo cambio. */
export function fijarReloj(instante: number): void {
  ahora = instante;
  setClock(() => new Date(ahora));
}

export function avanzarReloj(ms: number): void {
  fijarReloj(ahora + ms);
}

/** Base limpia con settings, admin y catálogo demo; reloj en `ABIERTO`. */
export async function prepararBase(): Promise<void> {
  fijarReloj(ABIERTO);
  await clearDb();
  await runSeed({
    demo: true,
    admin: { usuario: 'admin', password: 'clave-de-prueba', nombre: 'Black Station' },
  });
}

// Fixtures de `seed/data` (los mismos que los mocks del front).
export const LOMITO_COMPLETO = '66f1c0000000000000000001'; // 14500; extras 1, 2, 5
export const HAMBURGUESA_AGOTADA = '66f1c0000000000000000006';
export const COCA = '66f1c0000000000000000010'; // 2500; categoría Bebidas
export const LOMITO_INACTIVO = '66f1c0000000000000000013';
export const BEBIDAS = '66f1a0000000000000000004';
export const CHEDDAR = '66f1b0000000000000000001'; // 1200, cantidadMax 2
export const BACON = '66f1b0000000000000000002'; // 1500, cantidadMax 2
export const CEBOLLA_CARAMELIZADA = '66f1b0000000000000000004'; // no está en el lomito completo
export const TEL_BLOQUEADO = '5493361111111';
export const TEL_TRANSFERENCIA = '5493362222222';

let contador = 0;

/** Teléfono normalizado distinto en cada llamada. */
export const nuevoTelefono = () => `549336${String(5_000_000 + ++contador).padStart(7, '0')}`;

/** IP propia (con `trust proxy` en 1, `req.ip` sale de `X-Forwarded-For`). */
export const nuevaIp = () => `10.1.${Math.floor(++contador / 250)}.${contador % 250}`;

type Body = Record<string, unknown>;

/** Body válido de `POST /api/orders` (un lomito completo, retiro a las 22:00). */
export function pedido(cambios: Body = {}): Body {
  return {
    cliente: { nombre: 'Ana', telefono: nuevoTelefono() },
    items: [{ productoId: LOMITO_COMPLETO, cantidad: 1, quitados: [], extras: [] }],
    hora: '22:00',
    metodoPago: 'retiro',
    ...cambios,
  };
}

export function postOrder(app: Express, body: unknown, ip = nuevaIp()) {
  return request(app)
    .post('/api/orders')
    .set('X-Forwarded-For', ip)
    .send(body as object);
}

/** Token admin emitido un día antes de `ABIERTO`, válido una semana (el reloj de los tests avanza). */
export const authAdmin = `Bearer ${jwt.sign(
  {
    sub: '66f1d0000000000000000099',
    rol: 'admin',
    iat: Math.floor((ABIERTO - 24 * 60 * MIN) / 1000),
  },
  getEnv().JWT_SECRET,
  { expiresIn: '7d' },
)}`;
