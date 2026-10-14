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

export const esBooleano = (valor: unknown): valor is boolean => typeof valor === 'boolean';

export const esTextoNoVacio = (valor: unknown): valor is string =>
  typeof valor === 'string' && valor.trim() !== '';

/** String no vacío (con trim); se devuelve recortado. */
export function textoRequerido(message: string) {
  return regla(esTextoNoVacio, message).transform((s) => s.trim());
}
