import { ERROR_STATUS, type ApiErrorBody, type ErrorCode } from '@blackstation/shared';
import { ApiError, toApiError } from '../http';

/**
 * Latencia simulada de red: 300–600 ms. Sin conexión (`navigator.onLine`) falla como `http.ts`,
 * con `NETWORK_ERROR`, para probar los estados offline también con mocks.
 */
export async function latency(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 300));
  if (!navigator.onLine) {
    throw new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectarnos. Revisá tu conexión.');
  }
}

/**
 * Error con el mismo formato y status que la API, parseado igual que en `http.ts`.
 * El status sale de `ERROR_STATUS` (MODELO_DATOS §10).
 */
export function mockError(code: ErrorCode, message: string): ApiError {
  const body: ApiErrorBody = { error: { code, message } };
  return toApiError(ERROR_STATUS[code], body);
}

/** ObjectId falso: 8 hex de timestamp + 16 hex aleatorios. */
export function newObjectId(): string {
  const timestamp = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, '0');
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  return timestamp + random;
}

/** Alfabeto de `codigo` sin caracteres ambiguos (0/O, 1/I/L). */
const CODIGO_ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODIGO_LARGO = 8;

export function newCodigo(): string {
  return Array.from(
    crypto.getRandomValues(new Uint32Array(CODIGO_LARGO)),
    (n) => CODIGO_ALFABETO[n % CODIGO_ALFABETO.length],
  ).join('');
}
