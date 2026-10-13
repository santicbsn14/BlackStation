import type { ErrorCode } from '../errors';

/** ObjectId serializado. */
export type Id = string;
/** Timestamp ISO 8601 en UTC (`2026-09-25T21:30:00.000Z`). */
export type IsoDate = string;
/** Jornada operativa, `YYYY-MM-DD` en hora local. */
export type Fecha = string;
/** Hora local, `HH:mm`. */
export type Hora = string;

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
  };
};

export type OkResponse = { ok: true };

/** `GET /health`: `ok: false` (con 503) si la base no está conectada. */
export type HealthResponse = { ok: boolean; time: IsoDate };
