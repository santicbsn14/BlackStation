import { ESTADOS_CUSTOMER, TELEFONO_REGEX, type EstadoCustomer } from '@blackstation/shared';
import { z } from 'zod';
import { AppError } from '../lib/AppError';
import { esBooleano, esObjeto, regla } from './common';

// §8.5. Mismas reglas y mensajes que `getCustomers`/`updateCustomer` de los mocks del front.

export const Q_MIN = 2;

const esBusqueda = (valor: unknown): valor is string =>
  typeof valor === 'string' && (valor.trim() === '' || valor.trim().length >= Q_MIN);

export const customersQuerySchema = z.object({
  q: regla(esBusqueda, `La búsqueda necesita al menos ${Q_MIN} caracteres.`)
    .transform((q) => q.trim())
    .optional(),
});

/** `:telefono` que no cumple `TELEFONO_REGEX` no puede existir: 404 sin ir a la base. */
export const telefonoParams = z.object({
  telefono: z.string().transform((telefono) => {
    if (!TELEFONO_REGEX.test(telefono)) {
      throw new AppError('CUSTOMER_NOT_FOUND', 'No encontramos ese cliente.');
    }
    return telefono;
  }),
});

const esEstadoCustomer = (valor: unknown): valor is EstadoCustomer =>
  typeof valor === 'string' && (ESTADOS_CUSTOMER as readonly string[]).includes(valor);

/** Primero que haya algo para cambiar, después cada campo (el orden del mock). */
export const updateCustomerBodySchema = z
  .unknown()
  .transform((body, ctx) => {
    const obj = esObjeto(body) ? body : {};
    if (obj.estado === undefined && obj.estadoManual === undefined) {
      ctx.addIssue({ code: 'custom', message: 'No hay cambios para aplicar.' });
      return z.NEVER;
    }
    return obj;
  })
  .pipe(
    z.object({
      estado: regla(esEstadoCustomer, 'El estado no es válido.').optional(),
      estadoManual: regla(esBooleano, '`estadoManual` tiene que ser true o false.').optional(),
    }),
  );

export type UpdateCustomerInput = z.output<typeof updateCustomerBodySchema>;
