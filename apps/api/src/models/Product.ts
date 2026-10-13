import { model, Schema, type InferSchemaType } from 'mongoose';

// §3.2
const productSchema = new Schema(
  {
    nombre: { type: String, required: true },
    descripcion: { type: String, default: '' },
    categoriaId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    precio: { type: Number, required: true, min: 0 },
    fotoUrl: { type: String, default: null },
    fotoPublicId: { type: String, default: null },
    disponible: { type: Boolean, required: true, default: true },
    activo: { type: Boolean, required: true, default: true },
    orden: { type: Number, required: true, default: 0 },
    ingredientesQuitables: { type: [String], default: [] },
    extrasIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Extra' }], default: [] },
  },
  { collection: 'products', timestamps: true, versionKey: false },
);

productSchema.index({ categoriaId: 1, orden: 1 });
productSchema.index({ activo: 1 });

export type ProductDoc = InferSchemaType<typeof productSchema>;
export const ProductModel = model('Product', productSchema);
