import type { Customer } from '@blackstation/shared';
import type { Types } from 'mongoose';
import type { CustomerDoc } from '../models';

/** `customers` leído con `lean()`. */
export type CustomerLean = CustomerDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

/** §8.5. Recorte explícito: `nombreBusqueda` es interno y nunca sale en la API. */
export function toCustomer(doc: CustomerLean): Customer {
  return {
    _id: doc._id.toString(),
    telefono: doc.telefono,
    nombre: doc.nombre,
    pedidosTotal: doc.pedidosTotal,
    entregados: doc.entregados,
    noShows: doc.noShows,
    estado: doc.estado,
    estadoManual: doc.estadoManual,
    ultimoPedidoAt: doc.ultimoPedidoAt ? doc.ultimoPedidoAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
