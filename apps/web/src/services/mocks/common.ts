import type { FranjaPosible, Order, PickupSlot } from '@blackstation/shared';
import { getSession } from '../../lib/session';
import { notifyUnauthorized } from '../http';
import { mockError, newObjectId } from './mockUtils';
import { saveDb, type MockDb } from './store';

// Reglas compartidas por los mocks públicos y admin.

/** `VITE_MOCK_FORCE_OPEN=true`: ignora `horarios` y genera franjas desde ahora. */
export function isForceOpen(): boolean {
  return import.meta.env.VITE_MOCK_FORCE_OPEN === 'true';
}

/** Toda cancelación libera el cupo de la franja (§4). */
export function liberarCupo(db: MockDb, order: Order, ahoraIso: string): void {
  const slot = db.pickupSlots.find((s) => s._id === order.slotId);
  if (!slot) return;
  slot.ocupados = Math.max(0, slot.ocupados - 1);
  slot.updatedAt = ahoraIso;
}

/**
 * Reemplazo del job de vencimiento (§5.4) mientras no hay API: se aplica al leer.
 * Todo pedido `pendiente` con `expiresAt ≤ ahora` pasa a `cancelado`/`vencido` y libera su cupo.
 */
export function vencerPendientes(db: MockDb, ahora: Date): void {
  const ahoraIso = ahora.toISOString();
  let cambio = false;
  for (const order of db.orders) {
    if (order.estado !== 'pendiente' || !order.expiresAt) continue;
    if (Date.parse(order.expiresAt) > ahora.getTime()) continue;
    order.estado = 'cancelado';
    order.motivoCancelacion = 'vencido';
    order.canceladoAt = ahoraIso;
    order.updatedAt = ahoraIso;
    liberarCupo(db, order, ahoraIso);
    cambio = true;
  }
  if (cambio) saveDb();
}

export type FranjaConCupo = FranjaPosible & {
  doc: PickupSlot | undefined;
  cupoMax: number;
  ocupados: number;
  cerrada: boolean;
};

export function franjasConCupo(
  db: MockDb,
  fecha: string,
  franjas: FranjaPosible[],
): FranjaConCupo[] {
  return franjas.map((f) => {
    const doc = db.pickupSlots.find((s) => s.fecha === fecha && s.hora === f.hora);
    return {
      ...f,
      doc,
      cupoMax: doc?.cupoMax ?? db.settings.cupoMaxDefault,
      ocupados: doc?.ocupados ?? 0,
      cerrada: doc?.cerrada ?? false,
    };
  });
}

export function cumpleAnticipacion(db: MockDb, inicio: Date, ahora: Date): boolean {
  return inicio.getTime() >= ahora.getTime() + db.settings.anticipacionMinMin * 60_000;
}

/**
 * Rutas admin (§8): sin token o con token vencido → 401 `UNAUTHORIZED`, y el mismo manejo que
 * `http.ts` (borra el token y redirige a `/admin/login`).
 */
export function requireAuth(): void {
  if (getSession()) return;
  notifyUnauthorized();
  throw mockError('UNAUTHORIZED', 'Tu sesión venció. Volvé a ingresar.');
}

/** Crear pedido (§3.6): upsert por `telefono`, último nombre usado, `pedidosTotal++`. */
export function upsertCustomer(db: MockDb, cliente: Order['cliente'], ahoraIso: string): void {
  const customer = db.customers.find((c) => c.telefono === cliente.telefono);
  if (customer) {
    customer.nombre = cliente.nombre;
    customer.pedidosTotal += 1;
    customer.ultimoPedidoAt = ahoraIso;
    customer.updatedAt = ahoraIso;
    return;
  }
  db.customers.push({
    _id: newObjectId(),
    telefono: cliente.telefono,
    nombre: cliente.nombre,
    pedidosTotal: 1,
    entregados: 0,
    noShows: 0,
    estado: 'normal',
    estadoManual: false,
    ultimoPedidoAt: ahoraIso,
    createdAt: ahoraIso,
    updatedAt: ahoraIso,
  });
}

/** Contadores del customer del pedido: `entregados` al entregar, `noShows` con `no_retiro` (§3.6). */
export function sumarAlCustomer(
  db: MockDb,
  telefono: string,
  contador: 'entregados' | 'noShows',
  ahoraIso: string,
): void {
  const customer = db.customers.find((c) => c.telefono === telefono);
  if (!customer) return;
  customer[contador] += 1;
  customer.updatedAt = ahoraIso;
}
