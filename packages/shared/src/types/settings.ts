import type { Hora, Id, IsoDate } from './common';

export type Horario = {
  /** 0 = domingo … 6 = sábado. */
  dia: number;
  activo: boolean;
  abre: Hora;
  /** Si `cierra < abre`, la jornada cruza la medianoche. */
  cierra: Hora;
};

export type MensajesSettings = {
  confirmacion: string;
  pedirTransferencia: string;
  recordatorio: string;
};

export type Settings = {
  _id: Id;
  horarios: Horario[];
  intervaloMin: number;
  cupoMaxDefault: number;
  anticipacionMinMin: number;
  pedidosHabilitados: boolean;
  minutosTransferencia: number;
  alias: string;
  cbu: string;
  titular: string;
  telefonoLocal: string;
  mensajes: MensajesSettings;
  /** Forma a definir en la Etapa 06. */
  reputacion?: Record<string, unknown>;
  updatedAt: IsoDate;
};

// GET /api/public-settings

export type PublicSettings = {
  pedidosHabilitados: boolean;
  horarios: Horario[];
  anticipacionMinMin: number;
  minutosTransferencia: number;
  alias: string;
  cbu: string;
  titular: string;
  telefonoLocal: string;
};

// Admin

export type AdminSettingsResponse = Settings;

export type UpdateSettingsRequest = Omit<Settings, '_id' | 'updatedAt'>;

export type UpdateSettingsResponse = Settings;
