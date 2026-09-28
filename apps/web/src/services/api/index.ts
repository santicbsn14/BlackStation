import type {
  CatalogResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  LoginRequest,
  LoginResponse,
  PublicOrder,
  PublicSettings,
  SlotsResponse,
} from '@blackstation/shared';
import { http } from '../http';

export function getCatalog(): Promise<CatalogResponse> {
  return http('/api/catalog');
}

export function getSlots(): Promise<SlotsResponse> {
  return http('/api/slots');
}

export function getPublicSettings(): Promise<PublicSettings> {
  return http('/api/public-settings');
}

export function createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
  return http('/api/orders', { method: 'POST', body: request });
}

export function getOrderByCodigo(codigo: string): Promise<PublicOrder> {
  return http(`/api/orders/${encodeURIComponent(codigo)}`);
}

export function login(request: LoginRequest): Promise<LoginResponse> {
  return http('/api/auth/login', { method: 'POST', body: request });
}
