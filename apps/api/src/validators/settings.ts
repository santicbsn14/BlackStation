import { TELEFONO_REGEX, type Horario, type UpdateSettingsRequest } from '@blackstation/shared';
import { z } from 'zod';
import { esBooleano, esEntero, esHora, esObjeto, regla, textoRequerido } from './common';

// §8.4. Mismas reglas y mensajes que `validarSettings` de los mocks del front.

const DIAS = 7;

/** Devuelve los horarios ordenados por `dia`, o el mensaje de la primera regla que no cumplen. */
function validarHorarios(valor: unknown): Horario[] | string {
  if (!Array.isArray(valor) || valor.length !== DIAS) return 'Tiene que haber un horario por día.';
  const lista: Horario[] = [];
  for (const [i, h] of valor.entries()) {
    const n = i + 1;
    if (!esObjeto(h)) return `El horario ${n} no es válido.`;
    const { dia, activo, abre, cierra } = h;
    if (!esEntero(0, 6)(dia)) return `El día del horario ${n} no es válido.`;
    if (!esBooleano(activo)) return `\`activo\` del horario ${n} no es válido.`;
    if (!esHora(abre)) return `La hora de apertura del horario ${n} no es válida.`;
    if (!esHora(cierra)) return `La hora de cierre del horario ${n} no es válida.`;
    if (abre === cierra) return 'La apertura y el cierre no pueden ser la misma hora.';
    lista.push({ dia, activo, abre, cierra });
  }
  if (new Set(lista.map((h) => h.dia)).size !== DIAS) return 'Hay días repetidos en los horarios.';
  return lista.sort((a, b) => a.dia - b.dia);
}

const horariosSchema = z.unknown().transform((valor, ctx) => {
  const resultado = validarHorarios(valor);
  if (typeof resultado === 'string') {
    ctx.addIssue({ code: 'custom', message: resultado });
    return z.NEVER;
  }
  return resultado;
});

const mensajesSchema = regla(esObjeto, 'Faltan los mensajes.').pipe(
  z.object({
    confirmacion: textoRequerido('Falta el mensaje de confirmación.'),
    pedirTransferencia: textoRequerido('Falta el mensaje de transferencia.'),
    recordatorio: textoRequerido('Falta el mensaje de recordatorio.'),
  }),
);

/**
 * Body del `PUT /api/admin/settings`. `reputacion` no está: hasta la Etapa 06 se ignora y se
 * conserva la guardada. Los campos de más (`_id`, `updatedAt`) se descartan.
 */
export const updateSettingsBodySchema = regla(esObjeto, 'Faltan los ajustes.').pipe(
  z.object({
    intervaloMin: regla(esEntero(5, 120), 'El intervalo tiene que estar entre 5 y 120 minutos.'),
    cupoMaxDefault: regla(esEntero(1), 'El cupo por defecto tiene que ser 1 o más.'),
    anticipacionMinMin: regla(esEntero(0), 'La anticipación mínima tiene que ser 0 o más.'),
    minutosTransferencia: regla(esEntero(1), 'Los minutos para transferir tienen que ser 1 o más.'),
    telefonoLocal: regla(
      (valor): valor is string => typeof valor === 'string' && TELEFONO_REGEX.test(valor),
      'El teléfono del local no es válido.',
    ),
    horarios: horariosSchema,
    pedidosHabilitados: regla(esBooleano, '`pedidosHabilitados` tiene que ser true o false.'),
    alias: textoRequerido('Falta el alias.'),
    cbu: textoRequerido('Falta el CBU.'),
    titular: textoRequerido('Falta el titular.'),
    mensajes: mensajesSchema,
  }),
) satisfies z.ZodType<Omit<UpdateSettingsRequest, 'reputacion'>>;

export type UpdateSettingsInput = z.output<typeof updateSettingsBodySchema>;
