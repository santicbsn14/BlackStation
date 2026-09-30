import { isErrorCode, type ApiErrorBody } from '@blackstation/shared';
import { clearSession, getSession } from '../lib/session';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const { error } = body;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    isErrorCode(error.code) &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

/** Convierte una respuesta de error (`{ error: { code, message } }`) en `ApiError`. */
export function toApiError(status: number, body: unknown): ApiError {
  if (isApiErrorBody(body)) return new ApiError(status, body.error.code, body.error.message);
  return new ApiError(status, 'HTTP_ERROR', 'Ocurrió un error inesperado.');
}

let onUnauthorized: () => void = () => {};

/** Qué hacer ante un 401 en una ruta admin (lo registra `main.tsx`: ir a `/admin/login`). */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

type HttpOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Ruta admin: agrega el JWT y maneja el 401. */
  auth?: boolean;
  signal?: AbortSignal;
};

/** 401 en una ruta admin: borra el token y avisa (redirige a `/admin/login`). También lo usan los mocks. */
export function notifyUnauthorized(): void {
  clearSession();
  onUnauthorized();
}

function unauthorized(): ApiError {
  notifyUnauthorized();
  return new ApiError(401, 'UNAUTHORIZED', 'Tu sesión venció. Volvé a ingresar.');
}

/** `{ fecha: '2026-09-29', since: undefined }` → `?fecha=2026-09-29`. Omite los vacíos. */
export function toQueryString(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false, signal } = options;
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  if (auth) {
    const session = getSession();
    if (!session) throw unauthorized();
    headers.set('Authorization', `Bearer ${session.token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectarnos. Revisá tu conexión.');
  }

  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && auth) throw unauthorized();
    throw toApiError(res.status, data);
  }
  return data as T;
}
