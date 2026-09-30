import {
  ESTADOS_CUSTOMER,
  ESTADOS_PEDIDO,
  MOTIVOS_CANCELACION_PANEL,
  TELEFONO_REGEX,
  getFranjasDeFecha,
  getJornada,
  puedeTransicionar,
  type AdminCategoriesResponse,
  type AdminCustomersQuery,
  type AdminCustomersResponse,
  type AdminExtrasResponse,
  type AdminOrdersQuery,
  type AdminOrdersResponse,
  type AdminProductsResponse,
  type AdminSettingsResponse,
  type AdminSlot,
  type AdminSlotsQuery,
  type AdminSlotsResponse,
  type Category,
  type CreateCategoryRequest,
  type CreateExtraRequest,
  type CreateProductRequest,
  type ExtendOrderResponse,
  type Extra,
  type FranjaPosible,
  type Horario,
  type OkResponse,
  type Order,
  type Product,
  type ReprintOrderResponse,
  type Settings,
  type UpdateCategoryRequest,
  type UpdateCustomerRequest,
  type UpdateCustomerResponse,
  type UpdateDisponibleRequest,
  type UpdateExtraRequest,
  type UpdateOrderEstadoRequest,
  type UpdateOrderEstadoResponse,
  type UpdateProductRequest,
  type UpdateSettingsRequest,
  type UpdateSettingsResponse,
  type UpdateSlotRequest,
  type UpdateSlotResponse,
} from '@blackstation/shared';
import type { ProductPhoto } from '../types';
import { isForceOpen, liberarCupo, requireAuth, sumarAlCustomer, vencerPendientes } from './common';
import { latency, mockError, newObjectId } from './mockUtils';
import { getDb, saveDb, type MockDb } from './store';

// Endpoints admin (MODELO_DATOS §8). Misma firma que services/api; todos piden sesión (401).

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function validar(condicion: boolean, message: string): asserts condicion {
  if (!condicion) throw mockError('VALIDATION_ERROR', message);
}

const esEntero = (valor: unknown, min: number): valor is number =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= min;

function texto(valor: unknown, campo: string): string {
  validar(typeof valor === 'string' && valor.trim() !== '', `Falta ${campo}.`);
  return valor.trim();
}

function incluye<T extends string>(lista: readonly T[], valor: unknown): valor is T {
  return typeof valor === 'string' && (lista as readonly string[]).includes(valor);
}

// ─── Pedidos (§8.1) ─────────────────────────────────────────────────────────────────────────────

/**
 * Margen hacia atrás de `serverTime`. En la API el `since` es exacto; acá un pedido creado en otra
 * pestaña llega por el evento `storage` un instante después de su `updatedAt`, y sin margen se
 * perdería. Traer de nuevo lo que ya estaba no molesta: el panel mergea por `_id`.
 */
const MARGEN_SINCE_MS = 2_000;

/** Tiempo que tarda el print server simulado en imprimir y mandar el `ack` (§5.7). */
const ACK_MS = 3_000;

function simularAck(orderId: string): void {
  setTimeout(() => {
    const db = getDb();
    const order = db.orders.find((o) => o._id === orderId);
    if (order?.estado !== 'confirmado' || order.impresoAt) return;
    const ahoraIso = new Date().toISOString();
    order.impresoAt = ahoraIso;
    order.updatedAt = ahoraIso;
    saveDb();
  }, ACK_MS);
}

function buscarOrder(db: MockDb, id: string): Order {
  const order = db.orders.find((o) => o._id === id);
  if (!order) throw mockError('ORDER_NOT_FOUND', 'No encontramos ese pedido.');
  return order;
}

export async function getAdminOrders(query: AdminOrdersQuery = {}): Promise<AdminOrdersResponse> {
  await latency();
  requireAuth();
  const db = getDb();
  const ahora = new Date();
  // Igual que `GET /orders/:codigo`: el job de vencimiento corre antes de responder.
  vencerPendientes(db, ahora);

  const { estado, since } = query;
  validar(query.fecha === undefined || FECHA_REGEX.test(query.fecha), 'La fecha no es válida.');
  validar(estado === undefined || incluye(ESTADOS_PEDIDO, estado), 'El estado no es válido.');
  const sinceMs = since === undefined ? null : Date.parse(since);
  validar(sinceMs === null || !Number.isNaN(sinceMs), '`since` no es una fecha válida.');

  const fecha = query.fecha ?? getJornada(db.settings, ahora, isForceOpen()).fecha;
  const orders = db.orders
    .filter(
      (o) =>
        o.fecha === fecha &&
        (estado === undefined || o.estado === estado) &&
        (sinceMs === null || Date.parse(o.updatedAt) > sinceMs),
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return structuredClone({
    orders,
    serverTime: new Date(ahora.getTime() - MARGEN_SINCE_MS).toISOString(),
  });
}

export async function updateOrderEstado(
  id: string,
  request: UpdateOrderEstadoRequest,
): Promise<UpdateOrderEstadoResponse> {
  await latency();
  requireAuth();
  const db = getDb();
  const ahora = new Date();
  vencerPendientes(db, ahora);

  const { estado } = request;
  const motivo = request.estado === 'cancelado' ? request.motivoCancelacion : null;
  validar(incluye(ESTADOS_PEDIDO, estado), 'El estado no es válido.');
  validar(
    estado !== 'cancelado' || incluye(MOTIVOS_CANCELACION_PANEL, motivo),
    'Para cancelar hace falta el motivo: `manual` o `no_retiro`.',
  );

  const order = buscarOrder(db, id);
  if (!puedeTransicionar(order.estado, estado, motivo, 'panel')) {
    throw mockError('INVALID_TRANSITION', 'El pedido cambió de estado y ya no admite esa acción.');
  }

  const ahoraIso = ahora.toISOString();
  order.estado = estado;
  order.updatedAt = ahoraIso;
  if (estado === 'confirmado') {
    // Entra en la cola de impresión (§5.7).
    order.confirmadoAt = ahoraIso;
    order.impresoAt = null;
    simularAck(order._id);
  } else if (estado === 'entregado') {
    order.entregadoAt = ahoraIso;
    sumarAlCustomer(db, order.cliente.telefono, 'entregados', ahoraIso);
  } else {
    order.canceladoAt = ahoraIso;
    order.motivoCancelacion = motivo;
    liberarCupo(db, order, ahoraIso);
    if (motivo === 'no_retiro') sumarAlCustomer(db, order.cliente.telefono, 'noShows', ahoraIso);
  }
  saveDb();
  return structuredClone(order);
}

/** `PATCH /orders/:id/extender` (§8.1): `expiresAt = max(expiresAt, now) + minutosTransferencia`. */
export async function extendOrder(id: string): Promise<ExtendOrderResponse> {
  await latency();
  requireAuth();
  const db = getDb();
  const ahora = new Date();
  // Un pendiente ya vencido pasa a cancelado antes: extenderlo da 409 `INVALID_TRANSITION`.
  vencerPendientes(db, ahora);

  const order = buscarOrder(db, id);
  if (order.estado !== 'pendiente') {
    throw mockError('INVALID_TRANSITION', 'El pedido ya no está pendiente.');
  }
  if (!order.expiresAt) {
    throw mockError('NOT_EXTENDABLE', 'El pedido se paga al retirar: no tiene plazo.');
  }

  const desde = Math.max(Date.parse(order.expiresAt), ahora.getTime());
  order.expiresAt = new Date(desde + db.settings.minutosTransferencia * 60_000).toISOString();
  order.updatedAt = ahora.toISOString();
  saveDb();
  return structuredClone(order);
}

export async function reprintOrder(id: string): Promise<ReprintOrderResponse> {
  await latency();
  requireAuth();
  const db = getDb();
  const order = buscarOrder(db, id);
  if (order.estado !== 'confirmado') {
    throw mockError('NOT_CONFIRMED', 'Solo se reimprimen pedidos confirmados.');
  }
  order.impresoAt = null;
  order.updatedAt = new Date().toISOString();
  saveDb();
  simularAck(order._id);
  return { ok: true };
}

// ─── Catálogo (§8.2) ────────────────────────────────────────────────────────────────────────────

const porOrden = (a: { orden: number }, b: { orden: number }) => a.orden - b.orden;

function orden(valor: unknown): number {
  validar(esEntero(valor, 0), 'El orden tiene que ser un entero mayor o igual a 0.');
  return valor;
}

function precio(valor: unknown): number {
  validar(esEntero(valor, 0), 'El precio tiene que ser un entero mayor o igual a 0.');
  return valor;
}

function booleano(valor: unknown, campo: string): boolean {
  validar(typeof valor === 'boolean', `\`${campo}\` tiene que ser true o false.`);
  return valor;
}

function buscar<T extends { _id: string }>(lista: T[], id: string, message: string): T {
  const item = lista.find((x) => x._id === id);
  if (!item) throw mockError('NOT_FOUND', message);
  return item;
}

// Categorías

export async function getAdminCategories(): Promise<AdminCategoriesResponse> {
  await latency();
  requireAuth();
  return structuredClone({ categories: [...getDb().categories].sort(porOrden) });
}

export async function createCategory(request: CreateCategoryRequest): Promise<Category> {
  await latency();
  requireAuth();
  const db = getDb();
  const ahoraIso = new Date().toISOString();
  const category: Category = {
    _id: newObjectId(),
    nombre: texto(request.nombre, 'el nombre'),
    orden: request.orden === undefined ? 0 : orden(request.orden),
    activa: true,
    createdAt: ahoraIso,
    updatedAt: ahoraIso,
  };
  db.categories.push(category);
  saveDb();
  return structuredClone(category);
}

export async function updateCategory(
  id: string,
  request: UpdateCategoryRequest,
): Promise<Category> {
  await latency();
  requireAuth();
  const db = getDb();
  const category = buscar(db.categories, id, 'No encontramos esa categoría.');
  const cambios: Partial<Category> = {};
  if (request.nombre !== undefined) cambios.nombre = texto(request.nombre, 'el nombre');
  if (request.orden !== undefined) cambios.orden = orden(request.orden);
  if (request.activa !== undefined) cambios.activa = booleano(request.activa, 'activa');
  Object.assign(category, cambios, { updatedAt: new Date().toISOString() });
  saveDb();
  return structuredClone(category);
}

export async function deleteCategory(id: string): Promise<OkResponse> {
  await latency();
  requireAuth();
  const db = getDb();
  const category = buscar(db.categories, id, 'No encontramos esa categoría.');
  category.activa = false;
  category.updatedAt = new Date().toISOString();
  saveDb();
  return { ok: true };
}

// Productos

/** Valida los campos presentes de un create/update de producto. */
function camposProducto(db: MockDb, request: UpdateProductRequest): Partial<Product> {
  const cambios: Partial<Product> = {};
  if (request.nombre !== undefined) cambios.nombre = texto(request.nombre, 'el nombre');
  if (request.descripcion !== undefined) {
    validar(typeof request.descripcion === 'string', 'La descripción no es válida.');
    cambios.descripcion = request.descripcion.trim();
  }
  if (request.categoriaId !== undefined) {
    validar(
      db.categories.some((c) => c._id === request.categoriaId),
      'La categoría no existe.',
    );
    cambios.categoriaId = request.categoriaId;
  }
  if (request.precio !== undefined) cambios.precio = precio(request.precio);
  if (request.fotoUrl !== undefined) {
    validar(request.fotoUrl === null || typeof request.fotoUrl === 'string', 'Foto inválida.');
    cambios.fotoUrl = request.fotoUrl;
  }
  if (request.fotoPublicId !== undefined) {
    validar(
      request.fotoPublicId === null || typeof request.fotoPublicId === 'string',
      'Foto inválida.',
    );
    cambios.fotoPublicId = request.fotoPublicId;
  }
  if (request.orden !== undefined) cambios.orden = orden(request.orden);
  if (request.ingredientesQuitables !== undefined) {
    const lista: unknown = request.ingredientesQuitables;
    validar(
      Array.isArray(lista) && lista.every((i) => typeof i === 'string' && i.trim() !== ''),
      'Los ingredientes quitables tienen que ser textos no vacíos.',
    );
    cambios.ingredientesQuitables = [...new Set(lista.map((i: string) => i.trim()))];
  }
  if (request.extrasIds !== undefined) {
    const lista: unknown = request.extrasIds;
    validar(
      Array.isArray(lista) && lista.every((id) => db.extras.some((e) => e._id === id)),
      'Uno de los extras no existe.',
    );
    cambios.extrasIds = [...new Set(lista as string[])];
  }
  if (request.activo !== undefined) cambios.activo = booleano(request.activo, 'activo');
  return cambios;
}

export async function getAdminProducts(): Promise<AdminProductsResponse> {
  await latency();
  requireAuth();
  return structuredClone({ products: [...getDb().products].sort(porOrden) });
}

export async function createProduct(request: CreateProductRequest): Promise<Product> {
  await latency();
  requireAuth();
  const db = getDb();
  validar(request.nombre !== undefined, 'Falta el nombre.');
  validar(request.categoriaId !== undefined, 'Falta la categoría.');
  validar(request.precio !== undefined, 'Falta el precio.');
  const ahoraIso = new Date().toISOString();
  const product: Product = {
    _id: newObjectId(),
    nombre: '',
    descripcion: '',
    categoriaId: '',
    precio: 0,
    fotoUrl: null,
    fotoPublicId: null,
    disponible: true,
    activo: true,
    orden: 0,
    ingredientesQuitables: [],
    extrasIds: [],
    ...camposProducto(db, request),
    createdAt: ahoraIso,
    updatedAt: ahoraIso,
  };
  db.products.push(product);
  saveDb();
  return structuredClone(product);
}

export async function updateProduct(id: string, request: UpdateProductRequest): Promise<Product> {
  await latency();
  requireAuth();
  const db = getDb();
  const product = buscar(db.products, id, 'No encontramos ese producto.');
  Object.assign(product, camposProducto(db, request), { updatedAt: new Date().toISOString() });
  saveDb();
  return structuredClone(product);
}

export async function deleteProduct(id: string): Promise<OkResponse> {
  await latency();
  requireAuth();
  const db = getDb();
  const product = buscar(db.products, id, 'No encontramos ese producto.');
  product.activo = false;
  product.updatedAt = new Date().toISOString();
  saveDb();
  return { ok: true };
}

export async function updateProductDisponible(
  id: string,
  request: UpdateDisponibleRequest,
): Promise<Product> {
  await latency();
  requireAuth();
  const db = getDb();
  const product = buscar(db.products, id, 'No encontramos ese producto.');
  product.disponible = booleano(request.disponible, 'disponible');
  product.updatedAt = new Date().toISOString();
  saveDb();
  return structuredClone(product);
}

// Extras

function camposExtra(request: UpdateExtraRequest): Partial<Extra> {
  const cambios: Partial<Extra> = {};
  if (request.nombre !== undefined) cambios.nombre = texto(request.nombre, 'el nombre');
  if (request.precio !== undefined) cambios.precio = precio(request.precio);
  if (request.cantidadMax !== undefined) {
    validar(esEntero(request.cantidadMax, 1), 'La cantidad máxima tiene que ser 1 o más.');
    cambios.cantidadMax = request.cantidadMax;
  }
  if (request.activo !== undefined) cambios.activo = booleano(request.activo, 'activo');
  return cambios;
}

export async function getAdminExtras(): Promise<AdminExtrasResponse> {
  await latency();
  requireAuth();
  return structuredClone({ extras: getDb().extras });
}

export async function createExtra(request: CreateExtraRequest): Promise<Extra> {
  await latency();
  requireAuth();
  const db = getDb();
  validar(request.nombre !== undefined, 'Falta el nombre.');
  validar(request.precio !== undefined, 'Falta el precio.');
  const ahoraIso = new Date().toISOString();
  const extra: Extra = {
    _id: newObjectId(),
    nombre: '',
    precio: 0,
    disponible: true,
    cantidadMax: 1,
    activo: true,
    ...camposExtra(request),
    createdAt: ahoraIso,
    updatedAt: ahoraIso,
  };
  db.extras.push(extra);
  saveDb();
  return structuredClone(extra);
}

export async function updateExtra(id: string, request: UpdateExtraRequest): Promise<Extra> {
  await latency();
  requireAuth();
  const db = getDb();
  const extra = buscar(db.extras, id, 'No encontramos ese extra.');
  Object.assign(extra, camposExtra(request), { updatedAt: new Date().toISOString() });
  saveDb();
  return structuredClone(extra);
}

export async function deleteExtra(id: string): Promise<OkResponse> {
  await latency();
  requireAuth();
  const db = getDb();
  const extra = buscar(db.extras, id, 'No encontramos ese extra.');
  extra.activo = false;
  extra.updatedAt = new Date().toISOString();
  saveDb();
  return { ok: true };
}

export async function updateExtraDisponible(
  id: string,
  request: UpdateDisponibleRequest,
): Promise<Extra> {
  await latency();
  requireAuth();
  const db = getDb();
  const extra = buscar(db.extras, id, 'No encontramos ese extra.');
  extra.disponible = booleano(request.disponible, 'disponible');
  extra.updatedAt = new Date().toISOString();
  saveDb();
  return structuredClone(extra);
}

// Foto: sin Cloudinary. Se achica con canvas y se guarda como data URL en el producto.

const FOTO_LADO_MAX = 400;
const FOTO_CALIDAD = 0.8;

export async function uploadProductPhoto(file: File): Promise<ProductPhoto> {
  await latency();
  requireAuth();
  validar(file.type.startsWith('image/'), 'El archivo no es una imagen.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw mockError('VALIDATION_ERROR', 'No pudimos leer la imagen.');
  }
  const escala = Math.min(1, FOTO_LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw mockError('VALIDATION_ERROR', 'No pudimos procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return {
    fotoUrl: canvas.toDataURL('image/jpeg', FOTO_CALIDAD),
    fotoPublicId: `mock/products/${newObjectId()}`,
  };
}

// ─── Franjas (§8.3) ─────────────────────────────────────────────────────────────────────────────

/** Franjas posibles de `fecha` (default: la jornada actual). */
function franjasPosibles(db: MockDb, fecha: string | undefined, ahora: Date) {
  const jornada = getJornada(db.settings, ahora, isForceOpen());
  const f = fecha ?? jornada.fecha;
  const franjas: FranjaPosible[] =
    f === jornada.fecha ? jornada.franjas : getFranjasDeFecha(db.settings, f);
  return { fecha: f, franjas };
}

const aMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/**
 * Documento fuera de la secuencia de franjas. Con `VITE_MOCK_FORCE_OPEN` la secuencia arranca en
 * "ahora" y se corre con el reloj: ahí solo es huérfana una hora que no cae en el intervalo.
 */
function esHuerfana(db: MockDb, hora: string): boolean {
  return isForceOpen() ? aMinutos(hora) % db.settings.intervaloMin !== 0 : true;
}

export async function getAdminSlots(query: AdminSlotsQuery = {}): Promise<AdminSlotsResponse> {
  await latency();
  requireAuth();
  const db = getDb();
  const ahora = new Date();
  vencerPendientes(db, ahora);
  validar(query.fecha === undefined || FECHA_REGEX.test(query.fecha), 'La fecha no es válida.');

  const { fecha, franjas } = franjasPosibles(db, query.fecha, ahora);
  const docs = db.pickupSlots.filter((s) => s.fecha === fecha);
  const horas = new Set(franjas.map((f) => f.hora));

  const slots: AdminSlot[] = franjas.map((f) => {
    const doc = docs.find((d) => d.hora === f.hora);
    const slot: AdminSlot = {
      hora: f.hora,
      inicio: f.inicio.toISOString(),
      cupoMax: doc?.cupoMax ?? db.settings.cupoMaxDefault,
      ocupados: doc?.ocupados ?? 0,
      cerrada: doc?.cerrada ?? false,
      huerfana: false,
    };
    return doc ? { _id: doc._id, ...slot } : slot;
  });
  for (const doc of docs) {
    if (horas.has(doc.hora)) continue;
    const { _id, hora, inicio, cupoMax, ocupados, cerrada } = doc;
    slots.push({ _id, hora, inicio, cupoMax, ocupados, cerrada, huerfana: esHuerfana(db, hora) });
  }
  slots.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));

  return structuredClone({ fecha, slots });
}

export async function updateSlot(request: UpdateSlotRequest): Promise<UpdateSlotResponse> {
  await latency();
  requireAuth();
  const db = getDb();
  const ahora = new Date();
  vencerPendientes(db, ahora);

  const { fecha, hora, cupoMax, cerrada } = request;
  validar(typeof fecha === 'string' && FECHA_REGEX.test(fecha), 'La fecha no es válida.');
  validar(typeof hora === 'string' && HORA_REGEX.test(hora), 'La hora no es válida.');
  validar(
    cupoMax === undefined || esEntero(cupoMax, 0),
    'El cupo tiene que ser un entero mayor o igual a 0.',
  );
  if (cerrada !== undefined) booleano(cerrada, 'cerrada');

  const ahoraIso = ahora.toISOString();
  let doc = db.pickupSlots.find((s) => s.fecha === fecha && s.hora === hora);
  if (!doc) {
    const franja = franjasPosibles(db, fecha, ahora).franjas.find((f) => f.hora === hora);
    if (!franja) throw mockError('INVALID_SLOT', 'Esa franja no existe para esa fecha.');
    doc = {
      _id: newObjectId(),
      fecha,
      hora,
      inicio: franja.inicio.toISOString(),
      cupoMax: db.settings.cupoMaxDefault,
      ocupados: 0,
      cerrada: false,
      createdAt: ahoraIso,
      updatedAt: ahoraIso,
    };
    db.pickupSlots.push(doc);
  }
  if (cupoMax !== undefined && cupoMax < doc.ocupados) {
    throw mockError(
      'CUPO_BELOW_OCUPADOS',
      `El cupo no puede ser menor a los ${doc.ocupados} pedidos que ya tiene la franja.`,
    );
  }

  if (cupoMax !== undefined) doc.cupoMax = cupoMax;
  if (cerrada !== undefined) doc.cerrada = cerrada;
  doc.updatedAt = ahoraIso;
  saveDb();
  return structuredClone(doc);
}

// ─── Configuración (§8.4) ───────────────────────────────────────────────────────────────────────

function horarios(valor: unknown): Horario[] {
  validar(Array.isArray(valor) && valor.length === 7, 'Tiene que haber un horario por día.');
  const lista = valor.map((h: unknown, i): Horario => {
    validar(typeof h === 'object' && h !== null, `El horario ${i + 1} no es válido.`);
    const { dia, activo, abre, cierra } = h as Record<string, unknown>;
    validar(esEntero(dia, 0) && dia <= 6, `El día del horario ${i + 1} no es válido.`);
    validar(typeof activo === 'boolean', `\`activo\` del horario ${i + 1} no es válido.`);
    validar(
      typeof abre === 'string' && HORA_REGEX.test(abre),
      `La hora de apertura del horario ${i + 1} no es válida.`,
    );
    validar(
      typeof cierra === 'string' && HORA_REGEX.test(cierra),
      `La hora de cierre del horario ${i + 1} no es válida.`,
    );
    validar(abre !== cierra, 'La apertura y el cierre no pueden ser la misma hora.');
    return { dia, activo, abre, cierra };
  });
  validar(new Set(lista.map((h) => h.dia)).size === 7, 'Hay días repetidos en los horarios.');
  return lista.sort((a, b) => a.dia - b.dia);
}

function validarSettings(request: UpdateSettingsRequest): Omit<Settings, '_id' | 'updatedAt'> {
  validar(typeof request === 'object' && request !== null, 'Faltan los ajustes.');
  const { mensajes } = request;
  validar(typeof mensajes === 'object' && mensajes !== null, 'Faltan los mensajes.');
  validar(
    esEntero(request.intervaloMin, 5) && request.intervaloMin <= 120,
    'El intervalo tiene que estar entre 5 y 120 minutos.',
  );
  validar(esEntero(request.cupoMaxDefault, 1), 'El cupo por defecto tiene que ser 1 o más.');
  validar(esEntero(request.anticipacionMinMin, 0), 'La anticipación mínima tiene que ser 0 o más.');
  validar(
    esEntero(request.minutosTransferencia, 1),
    'Los minutos para transferir tienen que ser 1 o más.',
  );
  validar(
    typeof request.telefonoLocal === 'string' && TELEFONO_REGEX.test(request.telefonoLocal),
    'El teléfono del local no es válido.',
  );
  validar(
    request.reputacion === undefined ||
      (typeof request.reputacion === 'object' && request.reputacion !== null),
    '`reputacion` no es válida.',
  );

  return {
    horarios: horarios(request.horarios),
    intervaloMin: request.intervaloMin,
    cupoMaxDefault: request.cupoMaxDefault,
    anticipacionMinMin: request.anticipacionMinMin,
    pedidosHabilitados: booleano(request.pedidosHabilitados, 'pedidosHabilitados'),
    minutosTransferencia: request.minutosTransferencia,
    alias: texto(request.alias, 'el alias'),
    cbu: texto(request.cbu, 'el CBU'),
    titular: texto(request.titular, 'el titular'),
    telefonoLocal: request.telefonoLocal,
    mensajes: {
      confirmacion: texto(mensajes.confirmacion, 'el mensaje de confirmación'),
      pedirTransferencia: texto(mensajes.pedirTransferencia, 'el mensaje de transferencia'),
      recordatorio: texto(mensajes.recordatorio, 'el mensaje de recordatorio'),
    },
    ...(request.reputacion ? { reputacion: request.reputacion } : {}),
  };
}

export async function getAdminSettings(): Promise<AdminSettingsResponse> {
  await latency();
  requireAuth();
  return structuredClone(getDb().settings);
}

export async function updateSettings(
  request: UpdateSettingsRequest,
): Promise<UpdateSettingsResponse> {
  await latency();
  requireAuth();
  const db = getDb();
  db.settings = {
    _id: db.settings._id,
    ...validarSettings(request),
    updatedAt: new Date().toISOString(),
  };
  saveDb();
  return structuredClone(db.settings);
}

// ─── Clientes (§8.5) ────────────────────────────────────────────────────────────────────────────

const MAX_CLIENTES = 50;
const Q_MIN = 2;

/** Minúsculas y sin tildes: "Juán" → "juan". */
const plano = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export async function getCustomers(
  query: AdminCustomersQuery = {},
): Promise<AdminCustomersResponse> {
  await latency();
  requireAuth();
  const q = query.q?.trim() ?? '';
  validar(q === '' || q.length >= Q_MIN, `La búsqueda necesita al menos ${Q_MIN} caracteres.`);

  let customers = getDb().customers;
  if (/^\d+$/.test(q)) {
    customers = customers.filter((c) => c.telefono.includes(q));
  } else if (q) {
    const buscado = plano(q);
    customers = customers.filter((c) => plano(c.nombre).includes(buscado));
  }
  const ultimo = (iso: string | null) => (iso ? Date.parse(iso) : -Infinity);
  customers = [...customers]
    .sort((a, b) => ultimo(b.ultimoPedidoAt) - ultimo(a.ultimoPedidoAt))
    .slice(0, MAX_CLIENTES);

  return structuredClone({ customers });
}

export async function updateCustomer(
  telefono: string,
  request: UpdateCustomerRequest,
): Promise<UpdateCustomerResponse> {
  await latency();
  requireAuth();
  const { estado, estadoManual } = request;
  validar(estado !== undefined || estadoManual !== undefined, 'No hay cambios para aplicar.');
  validar(estado === undefined || incluye(ESTADOS_CUSTOMER, estado), 'El estado no es válido.');
  if (estadoManual !== undefined) booleano(estadoManual, 'estadoManual');

  const db = getDb();
  const customer = db.customers.find((c) => c.telefono === telefono);
  if (!customer) throw mockError('CUSTOMER_NOT_FOUND', 'No encontramos ese cliente.');

  // Cambiar `estado` desde el panel lo marca manual, salvo `estadoManual: false` explícito.
  if (estado !== undefined) {
    customer.estado = estado;
    customer.estadoManual = estadoManual ?? true;
  } else if (estadoManual !== undefined) {
    customer.estadoManual = estadoManual;
  }
  customer.updatedAt = new Date().toISOString();
  saveDb();
  return structuredClone(customer);
}
