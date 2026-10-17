import type { AdminSlotsQuery, UpdateSlotRequest } from '@blackstation/shared';
import { z } from 'zod';
import { cuerpo, esBooleano, esEntero, esFecha, esHora, regla } from './common';

// §8.3. Mismas reglas y mensajes que `getAdminSlots`/`updateSlot` de los mocks del front.

const fecha = regla(esFecha, 'La fecha no es válida.');

export const adminSlotsQuerySchema = z.object({
  fecha: fecha.optional(),
}) satisfies z.ZodType<AdminSlotsQuery>;

export const updateSlotBodySchema = cuerpo(
  z.object({
    fecha,
    hora: regla(esHora, 'La hora no es válida.'),
    cupoMax: regla(esEntero(0), 'El cupo tiene que ser un entero mayor o igual a 0.').optional(),
    cerrada: regla(esBooleano, '`cerrada` tiene que ser true o false.').optional(),
  }),
) satisfies z.ZodType<UpdateSlotRequest>;

export type UpdateSlotInput = z.output<typeof updateSlotBodySchema>;
