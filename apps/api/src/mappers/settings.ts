import type { Horario, PublicSettings, Settings } from '@blackstation/shared';
import type { Types } from 'mongoose';
import type { SettingsDoc } from '../models';

/** `settings` leído con `lean()`. */
export type SettingsLean = SettingsDoc & { _id: Types.ObjectId; updatedAt: Date };

const toHorarios = (doc: SettingsLean): Horario[] =>
  doc.horarios.map(({ dia, activo, abre, cierra }) => ({ dia, activo, abre, cierra }));

export function toSettings(doc: SettingsLean): Settings {
  return {
    _id: doc._id.toString(),
    horarios: toHorarios(doc),
    intervaloMin: doc.intervaloMin,
    cupoMaxDefault: doc.cupoMaxDefault,
    anticipacionMinMin: doc.anticipacionMinMin,
    pedidosHabilitados: doc.pedidosHabilitados,
    minutosTransferencia: doc.minutosTransferencia,
    alias: doc.alias,
    cbu: doc.cbu,
    titular: doc.titular,
    telefonoLocal: doc.telefonoLocal,
    mensajes: {
      confirmacion: doc.mensajes.confirmacion,
      pedirTransferencia: doc.mensajes.pedirTransferencia,
      recordatorio: doc.mensajes.recordatorio,
    },
    ...(doc.reputacion ? { reputacion: doc.reputacion } : {}),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Recorte explícito para `GET /api/public-settings` (§6). */
export function toPublicSettings(doc: SettingsLean): PublicSettings {
  return {
    pedidosHabilitados: doc.pedidosHabilitados,
    horarios: toHorarios(doc),
    anticipacionMinMin: doc.anticipacionMinMin,
    minutosTransferencia: doc.minutosTransferencia,
    alias: doc.alias,
    cbu: doc.cbu,
    titular: doc.titular,
    telefonoLocal: doc.telefonoLocal,
  };
}
