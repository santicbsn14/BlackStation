import type { PrintAckResponse, PrintQueueResponse } from '@blackstation/shared';
import { AppError } from '../lib/AppError';
import { now } from '../lib/clock';
import { toAdminOrder, type OrderLean } from '../mappers/orders';
import { OrderModel } from '../models';
import { jornadaActual } from './jornada';
import { findSettings } from './settings';

// §5.7 y §9.

/**
 * `GET /api/print/queue`: `confirmado` sin imprimir de la jornada actual, por `confirmadoAt`. Los de
 * jornadas anteriores no se imprimen solos.
 */
export async function getPrintQueue(): Promise<PrintQueueResponse> {
  const settings = await findSettings();
  const { fecha } = jornadaActual(settings, now());
  const docs = await OrderModel.find({ fecha, estado: 'confirmado', impresoAt: null })
    .sort({ confirmadoAt: 1, _id: 1 })
    .lean<OrderLean[]>();
  return { orders: docs.map(toAdminOrder) };
}

/**
 * `POST /api/print/:id/ack`: setea `impresoAt` con condición atómica sobre el estado. Idempotente:
 * si ya estaba impreso, devuelve el `impresoAt` que tiene.
 */
export async function ackPrint(id: string): Promise<PrintAckResponse> {
  const ahora = now();
  const order = await OrderModel.findOneAndUpdate(
    { _id: id, estado: 'confirmado', impresoAt: null },
    { $set: { impresoAt: ahora, updatedAt: ahora } },
    { returnDocument: 'after', projection: { impresoAt: 1 }, timestamps: false },
  ).lean();
  if (order?.impresoAt) return { ok: true, impresoAt: order.impresoAt.toISOString() };

  const actual = await OrderModel.findById(id, { estado: 1, impresoAt: 1 }).lean();
  if (!actual) throw new AppError('ORDER_NOT_FOUND', 'No encontramos ese pedido.');
  if (actual.estado !== 'confirmado') {
    throw new AppError('NOT_CONFIRMED', 'El pedido ya no está confirmado.');
  }
  // Lo reimprimieron entre las dos lecturas (`impresoAt` volvió a `null`): se intenta de nuevo.
  if (!actual.impresoAt) return ackPrint(id);
  return { ok: true, impresoAt: actual.impresoAt.toISOString() };
}
