import { ERROR_STATUS, type ErrorCode } from '@blackstation/shared';

export type AppErrorOptions = {
  /** Segundos para el header `Retry-After` (lo agrega el `errorHandler`). */
  retryAfter?: number;
};

/** Error de negocio con `code` de §10. El status HTTP sale de `ERROR_STATUS`. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryAfter: number | undefined;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.retryAfter = options.retryAfter;
  }
}
