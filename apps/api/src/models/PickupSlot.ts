import { model, Schema, type InferSchemaType } from 'mongoose';

// §3.5. `cupoMax` no tiene default fijo: el service lo inicializa con `settings.cupoMaxDefault`.
const pickupSlotSchema = new Schema(
  {
    fecha: { type: String, required: true },
    hora: { type: String, required: true },
    inicio: { type: Date, required: true },
    cupoMax: { type: Number, required: true, min: 0 },
    ocupados: { type: Number, required: true, default: 0, min: 0 },
    cerrada: { type: Boolean, required: true, default: false },
  },
  { collection: 'pickupSlots', timestamps: true, versionKey: false },
);

pickupSlotSchema.index({ fecha: 1, hora: 1 }, { unique: true });

export type PickupSlotDoc = InferSchemaType<typeof pickupSlotSchema>;
export const PickupSlotModel = model('PickupSlot', pickupSlotSchema);
