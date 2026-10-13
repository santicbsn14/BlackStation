import { model, Schema, type InferSchemaType } from 'mongoose';

// §3.1
const categorySchema = new Schema(
  {
    nombre: { type: String, required: true },
    orden: { type: Number, required: true, default: 0 },
    activa: { type: Boolean, required: true, default: true },
  },
  { collection: 'categories', timestamps: true, versionKey: false },
);

categorySchema.index({ orden: 1 });

export type CategoryDoc = InferSchemaType<typeof categorySchema>;
export const CategoryModel = model('Category', categorySchema);
