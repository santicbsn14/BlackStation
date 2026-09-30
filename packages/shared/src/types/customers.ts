import type { EstadoCustomer } from '../enums';
import type { Id, IsoDate } from './common';

export type Customer = {
  _id: Id;
  telefono: string;
  nombre: string;
  pedidosTotal: number;
  entregados: number;
  noShows: number;
  estado: EstadoCustomer;
  estadoManual: boolean;
  ultimoPedidoAt: IsoDate | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
};

export type AdminCustomersQuery = {
  /** Solo dígitos: busca en `telefono`. Si no: en `nombre` (sin mayúsculas ni tildes). Mínimo 2 caracteres. */
  q?: string;
};

export type AdminCustomersResponse = {
  customers: Customer[];
};

export type UpdateCustomerRequest = {
  estado?: EstadoCustomer;
  estadoManual?: boolean;
};

export type UpdateCustomerResponse = Customer;
