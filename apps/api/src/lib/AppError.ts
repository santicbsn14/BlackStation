import { ERROR_STATUS, type ErrorCode } from '@blackstation/shared';

/** Error de negocio con `code` de §10. El status HTTP sale de `ERROR_STATUS`. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
  }
}
