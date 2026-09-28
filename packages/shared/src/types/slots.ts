import type { Fecha, Hora, Id, IsoDate } from './common';

export type PickupSlot = {
  _id: Id;
  fecha: Fecha;
  hora: Hora;
  inicio: IsoDate;
  cupoMax: number;
  ocupados: number;
  cerrada: boolean;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

// GET /api/slots

export type PublicSlot = {
  hora: Hora;
  inicio: IsoDate;
  disponibles: number;
};

export type SlotsResponse = {
  fecha: Fecha;
  /** Si ahora se pueden tomar pedidos (§6). Si es `false`, `slots` viene vacío. */
  abierto: boolean;
  slots: PublicSlot[];
};

// Admin

export type AdminSlotsQuery = {
  fecha?: Fecha;
};

/** Franja posible: `_id` solo si ya existe el documento. */
export type AdminSlot = {
  _id?: Id;
  hora: Hora;
  inicio: IsoDate;
  cupoMax: number;
  ocupados: number;
  cerrada: boolean;
};

export type AdminSlotsResponse = {
  fecha: Fecha;
  slots: AdminSlot[];
};

export type UpdateSlotRequest = {
  fecha: Fecha;
  hora: Hora;
  cupoMax?: number;
  cerrada?: boolean;
};

export type UpdateSlotResponse = PickupSlot;
