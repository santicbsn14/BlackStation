import type { EstadoPedido, MetodoPago, MotivoCancelacion, MotivoCancelacionPanel } from '../enums';
import type { Fecha, Hora, Id, IsoDate, OkResponse } from './common';

// Snapshot de ítems

export type OrderItemExtra = {
  extraId: Id;
  nombre: string;
  precio: number;
  cantidad: number;
};

export type OrderItem = {
  productoId: Id;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  quitados: string[];
  extras: OrderItemExtra[];
  subtotal: number;
};

// Entidad completa (admin y print server)

export type Order = {
  _id: Id;
  codigo: string;
  numero: number;
  fecha: Fecha;
  cliente: {
    nombre: string;
    telefono: string;
  };
  items: OrderItem[];
  aclaracion: string | null;
  slotId: Id;
  horaRetiro: Hora;
  metodoPago: MetodoPago;
  estado: EstadoPedido;
  expiresAt: IsoDate | null;
  total: number;
  confirmadoAt: IsoDate | null;
  entregadoAt: IsoDate | null;
  canceladoAt: IsoDate | null;
  motivoCancelacion: MotivoCancelacion | null;
  impresoAt: IsoDate | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

// POST /api/orders

export type CreateOrderItemExtra = {
  extraId: Id;
  cantidad: number;
};

export type CreateOrderItem = {
  productoId: Id;
  cantidad: number;
  quitados: string[];
  extras: CreateOrderItemExtra[];
};

export type CreateOrderRequest = {
  cliente: {
    nombre: string;
    /** Ya normalizado con `normalizarTelefono`. */
    telefono: string;
  };
  items: CreateOrderItem[];
  aclaracion?: string;
  hora: Hora;
  metodoPago: MetodoPago;
};

export type CreateOrderResponse = {
  codigo: string;
  numero: number;
  estado: EstadoPedido;
  horaRetiro: Hora;
  total: number;
  expiresAt: IsoDate | null;
};

// GET /api/orders/:codigo — recorte público, sin teléfono ni campos internos.

export type PublicOrder = {
  codigo: string;
  numero: number;
  fecha: Fecha;
  horaRetiro: Hora;
  cliente: {
    nombre: string;
  };
  items: OrderItem[];
  aclaracion: string | null;
  metodoPago: MetodoPago;
  estado: EstadoPedido;
  motivoCancelacion: MotivoCancelacion | null;
  total: number;
  expiresAt: IsoDate | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

// Admin

export type AdminOrdersQuery = {
  fecha?: Fecha;
  estado?: EstadoPedido;
  since?: IsoDate;
};

export type AdminOrdersResponse = {
  orders: Order[];
  serverTime: IsoDate;
};

export type UpdateOrderEstadoRequest =
  | { estado: 'confirmado' | 'entregado' }
  | { estado: 'cancelado'; motivoCancelacion: MotivoCancelacionPanel };

export type UpdateOrderEstadoResponse = Order;

/** PATCH /api/admin/orders/:id/extender (sin body). */
export type ExtendOrderResponse = Order;

export type ReprintOrderResponse = OkResponse;

// Print server

export type PrintQueueResponse = {
  orders: Order[];
};

export type PrintAckResponse = {
  ok: true;
  impresoAt: IsoDate;
};
