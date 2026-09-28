import * as api from './api';
import * as mocks from './mocks';

// Misma firma en api/ y mocks/: el tipo lo garantiza.
const services: typeof api = import.meta.env.VITE_USE_MOCKS === 'true' ? mocks : api;

export const { getCatalog, getSlots, getPublicSettings, createOrder, getOrderByCodigo, login } =
  services;

export { ApiError } from './http';
