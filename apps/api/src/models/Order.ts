import {
  ACLARACION_MAX,
  ESTADOS_PEDIDO,
  METODOS_PAGO,
  MOTIVOS_CANCELACION,
} from '@blackstation/shared';
import { model, Schema, type InferSchemaType } from 'mongoose';

// §3.4. `items` es un snapshot: nombre y precios al momento del pedido.
const orderItemExtraSchema = new Schema(
  {
    extraId: { type: Schema.Types.ObjectId, ref: 'Extra', required: true },
    nombre: { type: String, required: true },
    precio: { type: Number, required: true },
    cantidad: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const orderItemSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    nombre: { type: String, required: true },
    precioUnitario: { type: Number, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    quitados: { type: [String], default: [] },
    extras: { type: [orderItemExtraSchema], default: [] },
    subtotal: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    codigo: { type: String, required: true },
    numero: { type: Number, required: true },
    fecha: { type: String, required: true },
    cliente: {
      type: new Schema(
        {
          nombre: { type: String, required: true },
          telefono: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: 'El pedido necesita al menos 1 ítem.',
      },
    },
    aclaracion: { type: String, default: null, maxlength: ACLARACION_MAX },
    slotId: { type: Schema.Types.ObjectId, ref: 'PickupSlot', required: true },
    horaRetiro: { type: String, required: true },
    metodoPago: { type: String, enum: [...METODOS_PAGO], required: true },
    estado: { type: String, enum: [...ESTADOS_PEDIDO], required: true, default: 'pendiente' },
    expiresAt: { type: Date, default: null },
    total: { type: Number, required: true },
    confirmadoAt: { type: Date, default: null },
    entregadoAt: { type: Date, default: null },
    canceladoAt: { type: Date, default: null },
    // `null` en el enum: el validador de Mongoose rechaza `null` si no está en la lista.
    motivoCancelacion: { type: String, enum: [...MOTIVOS_CANCELACION, null], default: null },
    impresoAt: { type: Date, default: null },
  },
  { collection: 'orders', timestamps: true, versionKey: false },
);

orderSchema.index({ codigo: 1 }, { unique: true });
orderSchema.index({ fecha: 1, numero: 1 }, { unique: true });
orderSchema.index({ estado: 1, expiresAt: 1 });
orderSchema.index({ 'cliente.telefono': 1 });
orderSchema.index({ updatedAt: 1 });

export type OrderDoc = InferSchemaType<typeof orderSchema>;
export const OrderModel = model('Order', orderSchema);
