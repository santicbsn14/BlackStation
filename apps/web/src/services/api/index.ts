import type {
  AdminCategoriesResponse,
  AdminCustomersQuery,
  AdminCustomersResponse,
  AdminExtrasResponse,
  AdminOrdersQuery,
  AdminOrdersResponse,
  AdminProductsResponse,
  AdminSettingsResponse,
  AdminSlotsQuery,
  AdminSlotsResponse,
  CatalogResponse,
  Category,
  CreateCategoryRequest,
  CreateExtraRequest,
  CreateOrderRequest,
  CreateOrderResponse,
  CreateProductRequest,
  ExtendOrderResponse,
  Extra,
  LoginRequest,
  LoginResponse,
  OkResponse,
  Product,
  PublicOrder,
  PublicSettings,
  ReprintOrderResponse,
  SlotsResponse,
  UpdateCategoryRequest,
  UpdateCustomerRequest,
  UpdateCustomerResponse,
  UpdateDisponibleRequest,
  UpdateExtraRequest,
  UpdateOrderEstadoRequest,
  UpdateOrderEstadoResponse,
  UpdateProductRequest,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
  UpdateSlotRequest,
  UpdateSlotResponse,
  UploadSignatureRequest,
  UploadSignatureResponse,
} from '@blackstation/shared';
import { ApiError, http, toQueryString } from '../http';
import type { ProductPhoto } from '../types';

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

export function cancelOrder(codigo: string): Promise<PublicOrder> {
  return http(`/api/orders/${encodeURIComponent(codigo)}/cancelar`, { method: 'POST' });
}

export function login(request: LoginRequest): Promise<LoginResponse> {
  return http('/api/auth/login', { method: 'POST', body: request });
}

// Admin (MODELO_DATOS §8). Todas con `auth: true`: JWT y manejo del 401.

// Pedidos

export function getAdminOrders(query: AdminOrdersQuery = {}): Promise<AdminOrdersResponse> {
  return http(`/api/admin/orders${toQueryString(query)}`, { auth: true });
}

export function updateOrderEstado(
  id: string,
  request: UpdateOrderEstadoRequest,
): Promise<UpdateOrderEstadoResponse> {
  return http(`/api/admin/orders/${encodeURIComponent(id)}/estado`, {
    method: 'PATCH',
    body: request,
    auth: true,
  });
}

export function extendOrder(id: string): Promise<ExtendOrderResponse> {
  return http(`/api/admin/orders/${encodeURIComponent(id)}/extender`, {
    method: 'PATCH',
    auth: true,
  });
}

export function reprintOrder(id: string): Promise<ReprintOrderResponse> {
  return http(`/api/admin/orders/${encodeURIComponent(id)}/reprint`, {
    method: 'POST',
    auth: true,
  });
}

// Categorías

export function getAdminCategories(): Promise<AdminCategoriesResponse> {
  return http('/api/admin/categories', { auth: true });
}

export function createCategory(request: CreateCategoryRequest): Promise<Category> {
  return http('/api/admin/categories', { method: 'POST', body: request, auth: true });
}

export function updateCategory(id: string, request: UpdateCategoryRequest): Promise<Category> {
  return http(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: request,
    auth: true,
  });
}

export function deleteCategory(id: string): Promise<OkResponse> {
  return http(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

// Productos

export function getAdminProducts(): Promise<AdminProductsResponse> {
  return http('/api/admin/products', { auth: true });
}

export function createProduct(request: CreateProductRequest): Promise<Product> {
  return http('/api/admin/products', { method: 'POST', body: request, auth: true });
}

export function updateProduct(id: string, request: UpdateProductRequest): Promise<Product> {
  return http(`/api/admin/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: request,
    auth: true,
  });
}

export function deleteProduct(id: string): Promise<OkResponse> {
  return http(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

export function updateProductDisponible(
  id: string,
  request: UpdateDisponibleRequest,
): Promise<Product> {
  return http(`/api/admin/products/${encodeURIComponent(id)}/disponible`, {
    method: 'PATCH',
    body: request,
    auth: true,
  });
}

// Extras

export function getAdminExtras(): Promise<AdminExtrasResponse> {
  return http('/api/admin/extras', { auth: true });
}

export function createExtra(request: CreateExtraRequest): Promise<Extra> {
  return http('/api/admin/extras', { method: 'POST', body: request, auth: true });
}

export function updateExtra(id: string, request: UpdateExtraRequest): Promise<Extra> {
  return http(`/api/admin/extras/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: request,
    auth: true,
  });
}

export function deleteExtra(id: string): Promise<OkResponse> {
  return http(`/api/admin/extras/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

export function updateExtraDisponible(
  id: string,
  request: UpdateDisponibleRequest,
): Promise<Extra> {
  return http(`/api/admin/extras/${encodeURIComponent(id)}/disponible`, {
    method: 'PATCH',
    body: request,
    auth: true,
  });
}

// Foto de producto: firma en la API y subida directa a Cloudinary (§8.2).

const CARPETA_FOTOS = 'products';

type CloudinaryUpload = { secure_url: string; public_id: string };

function isCloudinaryUpload(value: unknown): value is CloudinaryUpload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.secure_url === 'string' && typeof v.public_id === 'string';
}

export async function uploadProductPhoto(file: File): Promise<ProductPhoto> {
  const request: UploadSignatureRequest = { folder: CARPETA_FOTOS };
  const firma = await http<UploadSignatureResponse>('/api/admin/uploads/signature', {
    method: 'POST',
    body: request,
    auth: true,
  });

  const form = new FormData();
  form.set('file', file);
  form.set('api_key', firma.apiKey);
  form.set('timestamp', String(firma.timestamp));
  form.set('signature', firma.signature);
  form.set('folder', firma.folder);

  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${firma.cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No pudimos subir la foto. Revisá tu conexión.');
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok || !isCloudinaryUpload(data)) {
    throw new ApiError(res.status, 'UPLOAD_ERROR', 'No pudimos subir la foto.');
  }
  return { fotoUrl: data.secure_url, fotoPublicId: data.public_id };
}

// Franjas

export function getAdminSlots(query: AdminSlotsQuery = {}): Promise<AdminSlotsResponse> {
  return http(`/api/admin/slots${toQueryString(query)}`, { auth: true });
}

export function updateSlot(request: UpdateSlotRequest): Promise<UpdateSlotResponse> {
  return http('/api/admin/slots', { method: 'PATCH', body: request, auth: true });
}

// Configuración

export function getAdminSettings(): Promise<AdminSettingsResponse> {
  return http('/api/admin/settings', { auth: true });
}

export function updateSettings(request: UpdateSettingsRequest): Promise<UpdateSettingsResponse> {
  return http('/api/admin/settings', { method: 'PUT', body: request, auth: true });
}

// Clientes

export function getCustomers(query: AdminCustomersQuery = {}): Promise<AdminCustomersResponse> {
  return http(`/api/admin/customers${toQueryString(query)}`, { auth: true });
}

export function updateCustomer(
  telefono: string,
  request: UpdateCustomerRequest,
): Promise<UpdateCustomerResponse> {
  return http(`/api/admin/customers/${encodeURIComponent(telefono)}`, {
    method: 'PATCH',
    body: request,
    auth: true,
  });
}
