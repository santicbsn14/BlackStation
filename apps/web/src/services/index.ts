import * as api from './api';
import * as mocks from './mocks';
import { startSimulador as startMockSimulador } from './mocks/simulador';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// Misma firma en api/ y mocks/: el tipo lo garantiza.
const services: typeof api = USE_MOCKS ? mocks : api;

export const {
  getCatalog,
  getSlots,
  getPublicSettings,
  createOrder,
  getOrderByCodigo,
  cancelOrder,
  login,
  // Admin
  getAdminOrders,
  updateOrderEstado,
  extendOrder,
  reprintOrder,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductDisponible,
  getAdminExtras,
  createExtra,
  updateExtra,
  deleteExtra,
  updateExtraDisponible,
  uploadProductPhoto,
  getAdminSlots,
  updateSlot,
  getAdminSettings,
  updateSettings,
  getCustomers,
  updateCustomer,
} = services;

/**
 * Simulador de pedidos: solo con mocks y `VITE_MOCK_SIMULAR=true`. Devuelve la función que lo
 * frena. Con la API real no hace nada.
 */
export const startSimulador: () => () => void =
  USE_MOCKS && import.meta.env.VITE_MOCK_SIMULAR === 'true' ? startMockSimulador : () => () => {};

/**
 * `VITE_FORCE_OPEN=true`: la jornada ignora los horarios. Con mocks, igual que el mock; con la API
 * real, indica que la API corre con `FORCE_OPEN`. El panel la calcula con esto para pedir la misma
 * `fecha`.
 */
export const jornadaForzada: boolean = import.meta.env.VITE_FORCE_OPEN === 'true';

export { ApiError } from './http';
export type { ProductPhoto } from './types';
