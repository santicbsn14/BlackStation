import type { PickupSlot } from '@blackstation/shared';
import type { Types } from 'mongoose';
import type { PickupSlotDoc } from '../models';

/** `pickupSlots` leído con `lean()`. */
export type PickupSlotLean = PickupSlotDoc & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export function toSlot(doc: PickupSlotLean): PickupSlot {
  return {
    _id: doc._id.toString(),
    fecha: doc.fecha,
    hora: doc.hora,
    inicio: doc.inicio.toISOString(),
    cupoMax: doc.cupoMax,
    ocupados: doc.ocupados,
    cerrada: doc.cerrada,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
