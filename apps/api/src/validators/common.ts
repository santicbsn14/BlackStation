import { z } from 'zod';

/**
 * Regla con mensaje para el usuario: genera un issue `custom`, que el `errorHandler` responde tal
 * cual (sin el prefijo `Datos inválidos. campo:` de los errores genéricos de zod).
 */
export function regla<T>(check: (valor: unknown) => valor is T, message: string) {
  return z.custom<T>((valor) => check(valor), { error: message });
}

export const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

export const esEntero =
  (min: number, max = Infinity) =>
  (valor: unknown): valor is number =>
    typeof valor === 'number' && Number.isInteger(valor) && valor >= min && valor <= max;

const OBJECT_ID_REGEX = /^[0-9a-f]{24}$/i;

/** String con formato de ObjectId (24 hex). `isValidObjectId` de Mongoose acepta más cosas. */
export const esObjectId = (valor: unknown): valor is string =>
  typeof valor === 'string' && OBJECT_ID_REGEX.test(valor);

export const esBooleano = (valor: unknown): valor is boolean => typeof valor === 'boolean';

export const esTextoNoVacio = (valor: unknown): valor is string =>
  typeof valor === 'string' && valor.trim() !== '';

/** String no vacío (con trim); se devuelve recortado. */
export function textoRequerido(message: string) {
  return regla(esTextoNoVacio, message).transform((s) => s.trim());
}

/**
 * Body como objeto (sin body o con algo que no es un objeto cuenta como `{}`). Los obligatorios
 * del create se chequean antes que el resto de las reglas, en orden, como en el mock.
 */
export function cuerpo<T extends z.ZodType<unknown, Record<string, unknown>>>(
  schema: T,
  requeridos: [campo: string, mensaje: string][] = [],
) {
  return z
    .unknown()
    .transform((body, ctx) => {
      const obj = esObjeto(body) ? body : {};
      const falta = requeridos.find(([campo]) => obj[campo] === undefined);
      if (falta) {
        ctx.addIssue({ code: 'custom', message: falta[1] });
        return z.NEVER;
      }
      return obj;
    })
    .pipe(schema);
}

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** `HH:mm` (00:00–23:59). */
export const esHora = (valor: unknown): valor is string =>
  typeof valor === 'string' && HORA_REGEX.test(valor);

/** `YYYY-MM-DD` (solo el formato, como los mocks). */
export const esFecha = (valor: unknown): valor is string =>
  typeof valor === 'string' && FECHA_REGEX.test(valor);
