import {
  ACLARACION_MAX,
  METODOS_PAGO,
  TELEFONO_REGEX,
  calcularSubtotal,
  calcularTotal,
  getJornada,
  puedeTransicionar,
  type CatalogResponse,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type LoginRequest,
  type LoginResponse,
  type Order,
  type OrderItem,
  type PickupSlot,
  type PublicOrder,
  type PublicSettings,
  type SlotsResponse,
} from '@blackstation/shared';
import { latency, mockError, newCodigo, newObjectId } from './mockUtils';
import {
  cumpleAnticipacion,
  franjasConCupo,
  isForceOpen,
  liberarCupo,
  upsertCustomer,
  vencerPendientes,
  type FranjaConCupo,
} from './common';
import { getDb, saveDb, type MockDb } from './store';

export * from './admin';

// Misma firma que services/api. Devuelven exactamente el JSON de la API (MODELO_DATOS §6–7).

export async function getCatalog(): Promise<CatalogResponse> {
  await latency();
  const { categories, products, extras } = getDb();
  const porOrden = (a: { orden: number }, b: { orden: number }) => a.orden - b.orden;

  return structuredClone({
    categories: categories
      .filter((c) => c.activa)
      .sort(porOrden)
      .map((c) => ({
        _id: c._id,
        nombre: c.nombre,
        orden: c.orden,
        products: products
          .filter((p) => p.categoriaId === c._id && p.activo)
          .sort(porOrden)
          .map((p) => ({
            _id: p._id,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio: p.precio,
            fotoUrl: p.fotoUrl,
            disponible: p.disponible,
            ingredientesQuitables: p.ingredientesQuitables,
            extras: p.extrasIds.flatMap((id) => {
              const e = extras.find((x) => x._id === id);
              if (!e?.activo || !e.disponible) return [];
              return [
                { _id: e._id, nombre: e.nombre, precio: e.precio, cantidadMax: e.cantidadMax },
              ];
            }),
          })),
      })),
  });
}

export async function getSlots(): Promise<SlotsResponse> {
  await latency();
  const db = getDb();
  const ahora = new Date();
  vencerPendientes(db, ahora);
  const jornada = getJornada(db.settings, ahora, isForceOpen());
  const abierto = db.settings.pedidosHabilitados && jornada.activa && jornada.abierta;
  if (!abierto) return { fecha: jornada.fecha, abierto, slots: [] };

  const slots = franjasConCupo(db, jornada.fecha, jornada.franjas)
    .filter((f) => cumpleAnticipacion(db, f.inicio, ahora) && !f.cerrada && f.ocupados < f.cupoMax)
    .map((f) => ({
      hora: f.hora,
      inicio: f.inicio.toISOString(),
      disponibles: f.cupoMax - f.ocupados,
    }));
  return { fecha: jornada.fecha, abierto, slots };
}

export async function getPublicSettings(): Promise<PublicSettings> {
  await latency();
  const s = getDb().settings;
  return structuredClone({
    pedidosHabilitados: s.pedidosHabilitados,
    horarios: s.horarios,
    anticipacionMinMin: s.anticipacionMinMin,
    minutosTransferencia: s.minutosTransferencia,
    alias: s.alias,
    cbu: s.cbu,
    titular: s.titular,
    telefonoLocal: s.telefonoLocal,
  });
}

const esEnteroPositivo = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1;

/** Valida los ítems (§5.3 punto 3) y arma el snapshot con precios del store. */
function armarItems(db: MockDb, items: CreateOrderRequest['items']): OrderItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw mockError('EMPTY_ORDER', 'El pedido no tiene productos.');
  }

  return items.map((item) => {
    const producto = db.products.find((p) => p._id === item.productoId);
    const categoria = db.categories.find((c) => c._id === producto?.categoriaId);
    if (!producto?.activo || !producto.disponible || !categoria?.activa) {
      throw mockError('PRODUCT_UNAVAILABLE', 'Uno de los productos ya no está disponible.');
    }
    if (!esEnteroPositivo(item.cantidad)) {
      throw mockError('INVALID_QUANTITY', `La cantidad de "${producto.nombre}" no es válida.`);
    }
    if (!item.quitados.every((q) => producto.ingredientesQuitables.includes(q))) {
      throw mockError(
        'INVALID_REMOVED',
        `Hay ingredientes que no se pueden quitar de "${producto.nombre}".`,
      );
    }

    const extras = item.extras.map((pedido) => {
      const extra = db.extras.find((e) => e._id === pedido.extraId);
      if (!extra?.activo || !extra.disponible || !producto.extrasIds.includes(extra._id)) {
        throw mockError(
          'EXTRA_UNAVAILABLE',
          `Uno de los extras de "${producto.nombre}" no está disponible.`,
        );
      }
      if (!esEnteroPositivo(pedido.cantidad) || pedido.cantidad > extra.cantidadMax) {
        throw mockError('INVALID_EXTRA_QUANTITY', `La cantidad de "${extra.nombre}" no es válida.`);
      }
      return {
        extraId: extra._id,
        nombre: extra.nombre,
        precio: extra.precio,
        cantidad: pedido.cantidad,
      };
    });

    const snapshot = {
      productoId: producto._id,
      nombre: producto.nombre,
      precioUnitario: producto.precio,
      cantidad: item.cantidad,
      quitados: [...item.quitados],
      extras,
    };
    return { ...snapshot, subtotal: calcularSubtotal(snapshot) };
  });
}

/** Reserva atómica del cupo (§3.5): crea el documento si no existe y suma `ocupados`. */
function reservarCupo(db: MockDb, fecha: string, franja: FranjaConCupo, ahora: string): PickupSlot {
  if (franja.cerrada) throw mockError('SLOT_CLOSED', 'La franja elegida está cerrada.');
  if (franja.ocupados >= franja.cupoMax) {
    throw mockError('SLOT_FULL', 'La franja elegida ya no tiene cupo.');
  }

  let doc = franja.doc;
  if (!doc) {
    doc = {
      _id: newObjectId(),
      fecha,
      hora: franja.hora,
      inicio: franja.inicio.toISOString(),
      cupoMax: franja.cupoMax,
      ocupados: 0,
      cerrada: false,
      createdAt: ahora,
      updatedAt: ahora,
    };
    db.pickupSlots.push(doc);
  }
  doc.ocupados += 1;
  doc.updatedAt = ahora;
  return doc;
}

export async function createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
  await latency();
  const db = getDb();
  const { settings } = db;
  const ahora = new Date();
  const jornada = getJornada(settings, ahora, isForceOpen());

  // 1. Pedidos habilitados, día activo y local abierto ahora.
  if (!settings.pedidosHabilitados) {
    throw mockError('ORDERS_DISABLED', 'En este momento no estamos tomando pedidos.');
  }
  if (!jornada.activa) throw mockError('CLOSED', 'Hoy el local está cerrado.');
  if (!jornada.abierta) {
    throw mockError(
      'CLOSED',
      'El local está cerrado en este momento. Volvé en el horario de atención.',
    );
  }

  // 2. Estado del customer. El upsert va al final, cuando el pedido se crea.
  const customer = db.customers.find((c) => c.telefono === request.cliente.telefono);
  if (customer?.estado === 'bloqueado') {
    throw mockError('CUSTOMER_BLOCKED', 'No podemos tomar tu pedido online.');
  }
  if (customer?.estado === 'requiereTransferencia' && request.metodoPago !== 'transferencia') {
    throw mockError('TRANSFER_REQUIRED', 'Para este número el pago es por transferencia.');
  }

  // 3. Ítems.
  const items = armarItems(db, request.items);

  // 4. Aclaración, nombre, teléfono y método de pago.
  const aclaracion = request.aclaracion?.trim() || null;
  if (aclaracion && aclaracion.length > ACLARACION_MAX) {
    throw mockError(
      'INVALID_ACLARACION',
      `La aclaración no puede superar los ${ACLARACION_MAX} caracteres.`,
    );
  }
  const nombre = request.cliente.nombre.trim();
  if (!nombre) throw mockError('INVALID_NOMBRE', 'Falta el nombre.');
  if (!TELEFONO_REGEX.test(request.cliente.telefono)) {
    throw mockError('INVALID_TELEFONO', 'El teléfono no es válido.');
  }
  if (!METODOS_PAGO.includes(request.metodoPago)) {
    throw mockError('INVALID_METODO_PAGO', 'El método de pago no es válido.');
  }

  // 5. Franja de la jornada actual con la anticipación mínima.
  const franja = franjasConCupo(db, jornada.fecha, jornada.franjas).find(
    (f) => f.hora === request.hora,
  );
  if (!franja) throw mockError('INVALID_SLOT', 'La franja elegida no existe para hoy.');
  if (!cumpleAnticipacion(db, franja.inicio, ahora)) {
    throw mockError('SLOT_TOO_SOON', 'La franja elegida ya no está disponible.');
  }

  // 6. Reserva del cupo.
  const createdAt = ahora.toISOString();
  const slot = reservarCupo(db, jornada.fecha, franja, createdAt);

  let codigo = newCodigo();
  while (db.orders.some((o) => o.codigo === codigo)) codigo = newCodigo();
  const numero =
    Math.max(0, ...db.orders.filter((o) => o.fecha === jornada.fecha).map((o) => o.numero)) + 1;

  const order: Order = {
    _id: newObjectId(),
    codigo,
    numero,
    fecha: jornada.fecha,
    cliente: { nombre, telefono: request.cliente.telefono },
    items,
    aclaracion,
    slotId: slot._id,
    horaRetiro: franja.hora,
    metodoPago: request.metodoPago,
    estado: 'pendiente',
    expiresAt:
      request.metodoPago === 'transferencia'
        ? new Date(ahora.getTime() + settings.minutosTransferencia * 60_000).toISOString()
        : null,
    total: calcularTotal(items),
    confirmadoAt: null,
    entregadoAt: null,
    canceladoAt: null,
    motivoCancelacion: null,
    impresoAt: null,
    createdAt,
    updatedAt: createdAt,
  };
  db.orders.push(order);
  upsertCustomer(db, order.cliente, createdAt);
  saveDb();

  return {
    codigo: order.codigo,
    numero: order.numero,
    estado: order.estado,
    horaRetiro: order.horaRetiro,
    total: order.total,
    expiresAt: order.expiresAt,
  };
}

export async function getOrderByCodigo(codigo: string): Promise<PublicOrder> {
  await latency();
  const db = getDb();
  vencerPendientes(db, new Date());
  const order = db.orders.find((o) => o.codigo === codigo);
  if (!order) throw mockError('ORDER_NOT_FOUND', 'No encontramos ese pedido.');
  return toPublicOrder(order);
}

/** `POST /orders/:codigo/cancelar` (§6): solo desde `pendiente`, con motivo `cliente`. */
export async function cancelOrder(codigo: string): Promise<PublicOrder> {
  await latency();
  const db = getDb();
  const ahora = new Date();
  // Como el job corre antes: un `pendiente` ya vencido no se puede cancelar (409).
  vencerPendientes(db, ahora);
  const order = db.orders.find((o) => o.codigo === codigo);
  if (!order) throw mockError('ORDER_NOT_FOUND', 'No encontramos ese pedido.');
  if (!puedeTransicionar(order.estado, 'cancelado', 'cliente', 'cliente')) {
    throw mockError('INVALID_TRANSITION', 'El pedido ya no se puede cancelar.');
  }

  const ahoraIso = ahora.toISOString();
  order.estado = 'cancelado';
  order.motivoCancelacion = 'cliente';
  order.canceladoAt = ahoraIso;
  order.updatedAt = ahoraIso;
  liberarCupo(db, order, ahoraIso);
  saveDb();
  return toPublicOrder(order);
}

function toPublicOrder(order: Order): PublicOrder {
  return structuredClone({
    codigo: order.codigo,
    numero: order.numero,
    fecha: order.fecha,
    horaRetiro: order.horaRetiro,
    cliente: { nombre: order.cliente.nombre },
    items: order.items,
    aclaracion: order.aclaracion,
    metodoPago: order.metodoPago,
    estado: order.estado,
    motivoCancelacion: order.motivoCancelacion,
    total: order.total,
    expiresAt: order.expiresAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  });
}

const MOCK_USER = {
  _id: '66f1e0000000000000000001',
  nombre: 'Black Station',
  rol: 'admin',
} as const;
const TOKEN_HORAS = 12;

export async function login({ usuario, password }: LoginRequest): Promise<LoginResponse> {
  await latency();
  if (usuario !== 'admin' || password !== 'admin') {
    throw mockError('INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
  }
  return {
    token: `mock.${newObjectId()}`,
    expiresAt: new Date(Date.now() + TOKEN_HORAS * 3_600_000).toISOString(),
    user: { ...MOCK_USER },
  };
}
