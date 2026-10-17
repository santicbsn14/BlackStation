import type { OrderItem, PublicOrder } from '@blackstation/shared';
import type { Types } from 'mongoose';
import type { OrderDoc } from '../models';

/** `orders` leído con `lean()`. */
export type OrderLean = OrderDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

const iso = (fecha: Date | null | undefined) => (fecha ? fecha.toISOString() : null);

function toItems(doc: OrderLean): OrderItem[] {
  return doc.items.map((item) => ({
    productoId: item.productoId.toString(),
    nombre: item.nombre,
    precioUnitario: item.precioUnitario,
    cantidad: item.cantidad,
    quitados: [...item.quitados],
    extras: item.extras.map((extra) => ({
      extraId: extra.extraId.toString(),
      nombre: extra.nombre,
      precio: extra.precio,
      cantidad: extra.cantidad,
    })),
    subtotal: item.subtotal,
  }));
}

/** `GET /api/orders/:codigo` (§6). Recorte explícito: sin teléfono ni campos internos. */
export function toPublicOrder(doc: OrderLean): PublicOrder {
  return {
    codigo: doc.codigo,
    numero: doc.numero,
    fecha: doc.fecha,
    horaRetiro: doc.horaRetiro,
    cliente: { nombre: doc.cliente.nombre },
    items: toItems(doc),
    aclaracion: doc.aclaracion ?? null,
    metodoPago: doc.metodoPago,
    estado: doc.estado,
    motivoCancelacion: doc.motivoCancelacion ?? null,
    total: doc.total,
    expiresAt: iso(doc.expiresAt),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
