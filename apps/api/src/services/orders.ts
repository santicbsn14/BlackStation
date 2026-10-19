import { randomInt } from 'node:crypto';
import {
  calcularSubtotal,
  calcularTotal,
  puedeTransicionar,
  type AdminOrdersResponse,
  type CreateOrderResponse,
  type Order,
  type PublicOrder,
  type ReprintOrderResponse,
} from '@blackstation/shared';
import { mongo, type Types } from 'mongoose';
import { AppError } from '../lib/AppError';
import { now } from '../lib/clock';
import { orderLimiter } from '../lib/orderLimiter';
import { normalizarBusqueda } from '../lib/texto';
import type { CategoryLean, ExtraLean, ProductLean } from '../mappers/catalog';
import { toAdminOrder, toPublicOrder, type OrderLean } from '../mappers/orders';
import { CategoryModel, CustomerModel, ExtraModel, OrderModel, ProductModel } from '../models';
import { esEntero, esObjectId, esObjeto } from '../validators/common';
import {
  CODIGO_ALFABETO,
  CODIGO_LARGO,
  telefonoValido,
  validarDatosPedido,
  type AdminOrdersInput,
  type CreateOrderInput,
  type UpdateOrderEstadoInput,
} from '../validators/orders';
import { nextNumero } from './counters';
import { sumarAlCustomer } from './customers';
import { jornadaActual } from './jornada';
import { findSettings } from './settings';
import { cumpleAnticipacion, liberarCupo, reservarCupo } from './slots';
import { vencerPendientes } from './vencimiento';

// §5.3–5.5 y §6. Mismas reglas y mensajes que `createOrder`, `getOrderByCodigo` y `cancelOrder` de
// los mocks del front.

/** §5.3: tope de pedidos `pendiente` por teléfono. */
export const PENDIENTES_MAX_POR_TELEFONO = 2;
/** Reintentos del insert si el `codigo` choca con el índice único. */
const CODIGO_REINTENTOS = 5;

const NO_ENCONTRADO = 'No encontramos ese pedido.';

type ItemSnapshot = {
  productoId: Types.ObjectId;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  quitados: string[];
  extras: { extraId: Types.ObjectId; nombre: string; precio: number; cantidad: number }[];
  subtotal: number;
};

const lista = (valor: unknown): unknown[] => (Array.isArray(valor) ? valor : []);
const comoObjeto = (valor: unknown) => (esObjeto(valor) ? valor : {});

/**
 * §5.3 paso 3: valida los ítems y arma el snapshot con precios de la base (los precios del body se
 * ignoran). Mismo orden de chequeos que `armarItems` del mock.
 */
async function armarItems(items: unknown): Promise<ItemSnapshot[]> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('EMPTY_ORDER', 'El pedido no tiene productos.');
  }
  const pedidos = items.map(comoObjeto);

  const productoIds = pedidos.map((i) => i.productoId).filter(esObjectId);
  const extraIds = pedidos
    .flatMap((i) => lista(i.extras))
    .map((e) => comoObjeto(e).extraId)
    .filter(esObjectId);
  const [products, extras] = await Promise.all([
    ProductModel.find({ _id: { $in: productoIds } }).lean<ProductLean[]>(),
    ExtraModel.find({ _id: { $in: extraIds } }).lean<ExtraLean[]>(),
  ]);
  const categories = await CategoryModel.find({
    _id: { $in: products.map((p) => p.categoriaId) },
  }).lean<CategoryLean[]>();

  return pedidos.map((item) => {
    const producto = products.find((p) => p._id.toString() === item.productoId);
    const categoria = producto && categories.find((c) => c._id.equals(producto.categoriaId));
    if (!producto?.activo || !producto.disponible || !categoria?.activa) {
      throw new AppError('PRODUCT_UNAVAILABLE', 'Uno de los productos ya no está disponible.');
    }
    if (!esEntero(1)(item.cantidad)) {
      throw new AppError('INVALID_QUANTITY', `La cantidad de "${producto.nombre}" no es válida.`);
    }
    const quitados = item.quitados ?? [];
    if (
      !Array.isArray(quitados) ||
      !quitados.every((q) => typeof q === 'string' && producto.ingredientesQuitables.includes(q))
    ) {
      throw new AppError(
        'INVALID_REMOVED',
        `Hay ingredientes que no se pueden quitar de "${producto.nombre}".`,
      );
    }

    const extrasPedidos = item.extras ?? [];
    const noDisponible = () =>
      new AppError(
        'EXTRA_UNAVAILABLE',
        `Uno de los extras de "${producto.nombre}" no está disponible.`,
      );
    if (!Array.isArray(extrasPedidos)) throw noDisponible();
    const extrasSnapshot = extrasPedidos.map(comoObjeto).map((pedido) => {
      const extra = extras.find((e) => e._id.toString() === pedido.extraId);
      if (
        !extra?.activo ||
        !extra.disponible ||
        !producto.extrasIds.some((id) => id.equals(extra._id))
      ) {
        throw noDisponible();
      }
      if (!esEntero(1, extra.cantidadMax)(pedido.cantidad)) {
        throw new AppError(
          'INVALID_EXTRA_QUANTITY',
          `La cantidad de "${extra.nombre}" no es válida.`,
        );
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
      quitados: [...(quitados as string[])],
      extras: extrasSnapshot,
    };
    return { ...snapshot, subtotal: calcularSubtotal(snapshot) };
  });
}

/** `codigo` aleatorio de §3.4 con `crypto.randomInt`. */
function generarCodigo(): string {
  let codigo = '';
  for (let i = 0; i < CODIGO_LARGO; i++)
    codigo += CODIGO_ALFABETO[randomInt(CODIGO_ALFABETO.length)];
  return codigo;
}

const esCodigoDuplicado = (err: unknown) =>
  err instanceof mongo.MongoServerError &&
  err.code === 11000 &&
  esObjeto(err.keyPattern) &&
  'codigo' in err.keyPattern;

type NuevoPedido = Omit<OrderLean, '_id' | 'codigo' | 'items'> & { items: ItemSnapshot[] };

/** Inserta el pedido con un `codigo` nuevo; si choca con el índice único, reintenta con otro. */
async function insertarPedido(pedido: NuevoPedido): Promise<OrderLean> {
  for (let intento = 0; ; intento++) {
    const doc = new OrderModel({ ...pedido, codigo: generarCodigo() });
    try {
      await doc.save({ timestamps: false });
      return doc.toObject() as OrderLean;
    } catch (err) {
      if (intento >= CODIGO_REINTENTOS || !esCodigoDuplicado(err)) throw err;
    }
  }
}

/** §3.6: upsert por `telefono` con el último nombre usado, `pedidosTotal++` y `ultimoPedidoAt`. */
async function upsertCustomer(nombre: string, telefono: string, ahora: Date): Promise<void> {
  await CustomerModel.updateOne(
    { telefono },
    {
      $set: {
        nombre,
        nombreBusqueda: normalizarBusqueda(nombre),
        ultimoPedidoAt: ahora,
        updatedAt: ahora,
      },
      $inc: { pedidosTotal: 1 },
      $setOnInsert: {
        entregados: 0,
        noShows: 0,
        estado: 'normal',
        estadoManual: false,
        createdAt: ahora,
      },
    },
    { upsert: true, timestamps: false, setDefaultsOnInsert: false },
  );
}

/** `POST /api/orders` (§5.3). `ip` es la de la request, para el tope por IP. */
export async function createOrder(
  input: CreateOrderInput,
  ip: string,
): Promise<CreateOrderResponse> {
  await vencerPendientes();
  const settings = await findSettings();
  const ahora = now();
  const jornada = jornadaActual(settings, ahora);

  // 1. Pedidos habilitados, día activo y local abierto ahora.
  if (!settings.pedidosHabilitados) {
    throw new AppError('ORDERS_DISABLED', 'En este momento no estamos tomando pedidos.');
  }
  if (!jornada.activa) throw new AppError('CLOSED', 'Hoy el local está cerrado.');
  if (!jornada.abierta) {
    throw new AppError(
      'CLOSED',
      'El local está cerrado en este momento. Volvé en el horario de atención.',
    );
  }

  // 2. Estado del customer. El upsert va al final, cuando el pedido se crea.
  const telefono = telefonoValido(input);
  const customer = telefono
    ? await CustomerModel.findOne({ telefono }, { estado: 1 }).lean()
    : null;
  if (customer?.estado === 'bloqueado') {
    throw new AppError('CUSTOMER_BLOCKED', 'No podemos tomar tu pedido online.');
  }
  if (customer?.estado === 'requiereTransferencia' && input.metodoPago !== 'transferencia') {
    throw new AppError('TRANSFER_REQUIRED', 'Para este número el pago es por transferencia.');
  }

  // 3. Ítems.
  const items = await armarItems(input.items);

  // 4. Aclaración, nombre, teléfono y método de pago.
  const datos = validarDatosPedido(input);

  // Topes anti-spam: pedidos en curso del teléfono y pedidos creados por la IP.
  const enCurso = await OrderModel.countDocuments({
    'cliente.telefono': datos.telefono,
    estado: 'pendiente',
  });
  if (enCurso >= PENDIENTES_MAX_POR_TELEFONO) {
    throw new AppError(
      'TOO_MANY_ORDERS',
      'Ya tenés 2 pedidos en curso. Esperá a que los confirmen o cancelá uno.',
    );
  }
  const retryAfter = orderLimiter.check(ip);
  if (retryAfter !== null) {
    throw new AppError(
      'TOO_MANY_ORDERS',
      'Hiciste muchos pedidos seguidos. Probá de nuevo más tarde.',
      { retryAfter },
    );
  }

  // 5. Franja de la jornada actual con la anticipación mínima.
  const franja = jornada.franjas.find((f) => f.hora === input.hora);
  if (!franja) throw new AppError('INVALID_SLOT', 'La franja elegida no existe para hoy.');
  if (!cumpleAnticipacion(franja.inicio, ahora, settings.anticipacionMinMin)) {
    throw new AppError('SLOT_TOO_SOON', 'La franja elegida ya no está disponible.');
  }

  // 6. Reserva del cupo. Si algo falla antes de que el pedido quede guardado, se libera (§3.5).
  const slot = await reservarCupo(jornada.fecha, franja, settings.cupoMaxDefault);
  let order: OrderLean;
  try {
    const numero = await nextNumero(jornada.fecha);
    order = await insertarPedido({
      numero,
      fecha: jornada.fecha,
      cliente: { nombre: datos.nombre, telefono: datos.telefono },
      items,
      aclaracion: datos.aclaracion,
      slotId: slot._id,
      horaRetiro: franja.hora,
      metodoPago: datos.metodoPago,
      estado: 'pendiente',
      expiresAt:
        datos.metodoPago === 'transferencia'
          ? new Date(ahora.getTime() + settings.minutosTransferencia * 60_000)
          : null,
      total: calcularTotal(items),
      confirmadoAt: null,
      entregadoAt: null,
      canceladoAt: null,
      motivoCancelacion: null,
      impresoAt: null,
      createdAt: ahora,
      updatedAt: ahora,
    });
  } catch (err) {
    await liberarCupo(slot._id);
    throw err;
  }

  orderLimiter.registrar(ip);
  // El pedido ya existe: si falla el customer, solo log. Un 500 haría que el cliente reintente y lo
  // duplique (§5.3).
  try {
    await upsertCustomer(datos.nombre, datos.telefono, ahora);
  } catch (err) {
    console.error(`No se pudo actualizar el customer del pedido ${order.codigo}:`, err);
  }

  return {
    codigo: order.codigo,
    numero: order.numero,
    estado: order.estado,
    horaRetiro: order.horaRetiro,
    total: order.total,
    expiresAt: order.expiresAt ? order.expiresAt.toISOString() : null,
  };
}

/** `GET /api/orders/:codigo` (§6). */
export async function getPublicOrder(codigo: string): Promise<PublicOrder> {
  await vencerPendientes();
  const order = await OrderModel.findOne({ codigo }).lean<OrderLean>();
  if (!order) throw new AppError('ORDER_NOT_FOUND', NO_ENCONTRADO);
  return toPublicOrder(order);
}

/**
 * `POST /api/orders/:codigo/cancelar` (§6): solo desde `pendiente`, con motivo `cliente`. Con
 * condición sobre el estado para no pisarse con el job de vencimiento. Libera el cupo y no toca
 * `customers` (no es no-show).
 */
export async function cancelPublicOrder(codigo: string): Promise<PublicOrder> {
  // Como el job corre antes: un `pendiente` ya vencido no se puede cancelar (409).
  await vencerPendientes();
  const ahora = now();
  const order = await OrderModel.findOneAndUpdate(
    { codigo, estado: 'pendiente' },
    {
      $set: {
        estado: 'cancelado',
        motivoCancelacion: 'cliente',
        canceladoAt: ahora,
        updatedAt: ahora,
      },
    },
    { returnDocument: 'after', timestamps: false },
  ).lean<OrderLean>();

  if (!order) {
    if (await OrderModel.exists({ codigo })) {
      throw new AppError('INVALID_TRANSITION', 'El pedido ya no se puede cancelar.');
    }
    throw new AppError('ORDER_NOT_FOUND', NO_ENCONTRADO);
  }

  await liberarCupo(order.slotId);
  return toPublicOrder(order);
}

// Panel (§8.1). Mismas reglas y mensajes que `getAdminOrders`, `updateOrderEstado`, `extendOrder` y
// `reprintOrder` de los mocks del front. Los cuatro corren antes el vencimiento perezoso (§5.4).

/** Margen hacia atrás de `serverTime`: no perder una escritura que termine durante la query. */
export const MARGEN_SINCE_MS = 2_000;

const CAMBIO_ESTADO = 'El pedido cambió de estado y ya no admite esa acción.';

/** `GET /api/admin/orders`: por `createdAt`, con polling incremental por `updatedAt > since`. */
export async function getAdminOrders(query: AdminOrdersInput): Promise<AdminOrdersResponse> {
  await vencerPendientes();
  // Antes de la query: lo que se escriba mientras corre queda después de `serverTime`.
  const ahora = now();
  const fecha = query.fecha ?? jornadaActual(await findSettings(), ahora).fecha;
  const docs = await OrderModel.find({
    fecha,
    ...(query.estado && { estado: query.estado }),
    ...(query.since && { updatedAt: { $gt: query.since } }),
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean<OrderLean[]>();

  return {
    orders: docs.map(toAdminOrder),
    serverTime: new Date(ahora.getTime() - MARGEN_SINCE_MS).toISOString(),
  };
}

async function buscarOrder(id: string): Promise<OrderLean> {
  const order = await OrderModel.findById(id).lean<OrderLean>();
  if (!order) throw new AppError('ORDER_NOT_FOUND', NO_ENCONTRADO);
  return order;
}

/**
 * `PATCH /api/admin/orders/:id/estado` (§4). Se aplica con condición sobre el estado leído y los
 * efectos (cupo, contadores del customer) corren solo si el update matcheó: dos requests a la vez
 * no los duplican.
 */
export async function updateOrderEstado(id: string, input: UpdateOrderEstadoInput): Promise<Order> {
  await vencerPendientes();
  const { estado, motivoCancelacion } = input;
  const actual = await buscarOrder(id);
  if (!puedeTransicionar(actual.estado, estado, motivoCancelacion, 'panel')) {
    throw new AppError('INVALID_TRANSITION', CAMBIO_ESTADO);
  }

  const ahora = now();
  const cambios =
    estado === 'confirmado'
      ? { confirmadoAt: ahora, impresoAt: null } // Entra en la cola de impresión (§5.7).
      : estado === 'entregado'
        ? { entregadoAt: ahora }
        : { canceladoAt: ahora, motivoCancelacion };
  const order = await OrderModel.findOneAndUpdate(
    { _id: actual._id, estado: actual.estado },
    { $set: { estado, ...cambios, updatedAt: ahora } },
    { returnDocument: 'after', timestamps: false },
  ).lean<OrderLean>();
  if (!order) throw new AppError('INVALID_TRANSITION', CAMBIO_ESTADO);

  if (estado === 'entregado') {
    await sumarAlCustomer(order.cliente.telefono, 'entregados');
  } else if (estado === 'cancelado') {
    await liberarCupo(order.slotId);
    if (motivoCancelacion === 'no_retiro') {
      await sumarAlCustomer(order.cliente.telefono, 'noShows');
    }
  }
  return toAdminOrder(order);
}

/**
 * `PATCH /api/admin/orders/:id/extender` (§5.4): `expiresAt = max(expiresAt, now) +
 * minutosTransferencia`, atómico con condición `{ estado: 'pendiente', expiresAt: { $ne: null } }`.
 */
export async function extendOrder(id: string): Promise<Order> {
  // Un pendiente ya vencido pasa antes a cancelado: extenderlo da 409 `INVALID_TRANSITION`.
  await vencerPendientes();
  const actual = await buscarOrder(id);
  const noPendiente = () => new AppError('INVALID_TRANSITION', 'El pedido ya no está pendiente.');
  if (actual.estado !== 'pendiente') throw noPendiente();
  if (!actual.expiresAt) {
    throw new AppError('NOT_EXTENDABLE', 'El pedido se paga al retirar: no tiene plazo.');
  }

  const { minutosTransferencia } = await findSettings();
  const ahora = now();
  const desde = Math.max(actual.expiresAt.getTime(), ahora.getTime());
  const order = await OrderModel.findOneAndUpdate(
    { _id: actual._id, estado: 'pendiente', expiresAt: { $ne: null } },
    {
      $set: {
        expiresAt: new Date(desde + minutosTransferencia * 60_000),
        updatedAt: ahora,
      },
    },
    { returnDocument: 'after', timestamps: false },
  ).lean<OrderLean>();
  if (!order) throw noPendiente();
  return toAdminOrder(order);
}

/** `POST /api/admin/orders/:id/reprint` (§5.7): vuelve `impresoAt` a `null`, solo si `confirmado`. */
export async function reprintOrder(id: string): Promise<ReprintOrderResponse> {
  await vencerPendientes();
  const ahora = now();
  const order = await OrderModel.findOneAndUpdate(
    { _id: id, estado: 'confirmado' },
    { $set: { impresoAt: null, updatedAt: ahora } },
    { projection: { _id: 1 }, timestamps: false },
  ).lean();
  if (!order) {
    if (await OrderModel.exists({ _id: id })) {
      throw new AppError('NOT_CONFIRMED', 'Solo se reimprimen pedidos confirmados.');
    }
    throw new AppError('ORDER_NOT_FOUND', NO_ENCONTRADO);
  }
  return { ok: true };
}
