import type { ApiErrorBody, ErrorCode } from '@blackstation/shared';
import { ERROR_STATUS } from '@blackstation/shared';
import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../lib/AppError';

type ErrorResponse = { status: number; body: ApiErrorBody };

function response(code: ErrorCode, message: string): ErrorResponse {
  return { status: ERROR_STATUS[code], body: { error: { code, message } } };
}

/** Errores de `express.json()` (body-parser): traen `type` (`entity.parse.failed`, etc.). */
function isBodyParserError(err: unknown): err is { type: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    typeof err.type === 'string' &&
    err.type.startsWith('entity.')
  );
}

function toResponse(err: unknown): ErrorResponse {
  if (err instanceof AppError) return response(err.code, err.message);

  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const campo = issue && issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return response('VALIDATION_ERROR', `Datos inválidos. ${campo}${issue?.message ?? ''}`.trim());
  }

  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      return response('VALIDATION_ERROR', 'El cuerpo no es un JSON válido.');
    }
    if (err.type === 'entity.too.large') {
      return response('VALIDATION_ERROR', 'El cuerpo es demasiado grande.');
    }
  }

  if (err instanceof mongoose.Error.CastError) {
    return response('VALIDATION_ERROR', `Valor inválido para ${err.path}.`);
  }

  // No previsto: el detalle va al log, nunca a la respuesta.
  console.error(err);
  return response('INTERNAL_ERROR', 'Ocurrió un error inesperado.');
}

/** Toda respuesta de error sale con el formato de §10: `{ error: { code, message } }`. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const { status, body } = toResponse(err);
  res.status(status).json(body);
};
