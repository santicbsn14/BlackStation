import { ESTADOS_CUSTOMER } from '@blackstation/shared';
import { model, Schema, type InferSchemaType } from 'mongoose';

// §3.6
const customerSchema = new Schema(
  {
    telefono: { type: String, required: true },
    nombre: { type: String, required: true },
    /**
     * Interno, no se expone en la API: `normalizarBusqueda(nombre)`. Se setea explícito en cada
     * escritura que toque `nombre` (sin hook de `save`: los `findOneAndUpdate` no lo disparan).
     */
    nombreBusqueda: { type: String, required: true },
    pedidosTotal: { type: Number, required: true, default: 0 },
    entregados: { type: Number, required: true, default: 0 },
    noShows: { type: Number, required: true, default: 0 },
    estado: { type: String, enum: [...ESTADOS_CUSTOMER], required: true, default: 'normal' },
    estadoManual: { type: Boolean, required: true, default: false },
    ultimoPedidoAt: { type: Date, default: null },
  },
  { collection: 'customers', timestamps: true, versionKey: false },
);

customerSchema.index({ telefono: 1 }, { unique: true });

export type CustomerDoc = InferSchemaType<typeof customerSchema>;
export const CustomerModel = model('Customer', customerSchema);
