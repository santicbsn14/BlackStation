import { model, Schema, type InferSchemaType } from 'mongoose';

// §3.3
const extraSchema = new Schema(
  {
    nombre: { type: String, required: true },
    precio: { type: Number, required: true, min: 0 },
    disponible: { type: Boolean, required: true, default: true },
    cantidadMax: { type: Number, required: true, default: 1, min: 1 },
    activo: { type: Boolean, required: true, default: true },
  },
  { collection: 'extras', timestamps: true, versionKey: false },
);

extraSchema.index({ activo: 1 });

export type ExtraDoc = InferSchemaType<typeof extraSchema>;
export const ExtraModel = model('Extra', extraSchema);
