import {
  getFranjasDeFecha,
  type AdminSlot,
  type AdminSlotsResponse,
  type FranjaPosible,
  type PickupSlot,
  type SlotsResponse,
} from '@blackstation/shared';
import { mongo, type Types } from 'mongoose';
import { getEnv } from '../config/env';
import { AppError } from '../lib/AppError';
import { now } from '../lib/clock';
import { toSlot, type PickupSlotLean } from '../mappers/slots';
import { PickupSlotModel } from '../models';
import type { SettingsLean } from '../mappers/settings';
import type { UpdateSlotInput } from '../validators/slots';
import { jornadaActual } from './jornada';
import { findSettings } from './settings';
import { vencerPendientes } from './vencimiento';

// §3.5, §5.2, §6 (`GET /api/slots`) y §8.3. Mismas reglas y mensajes que los mocks del front.

export type FranjaConCupo = FranjaPosible & {
  doc: PickupSlotLean | undefined;
  cupoMax: number;
  ocupados: number;
  cerrada: boolean;
};

/**
 * Une las franjas posibles con los documentos de `pickupSlots` de `fecha`. Sin documento, la franja
 * tiene `ocupados: 0`, `cupoMax: cupoMaxDefault` y `cerrada: false` (§3.5).
 */
export async function franjasConCupo(
  fecha: string,
  franjas: FranjaPosible[],
  cupoMaxDefault: number,
): Promise<FranjaConCupo[]> {
  const docs = await PickupSlotModel.find({ fecha }).lean<PickupSlotLean[]>();
  return franjas.map((f) => {
    const doc = docs.find((d) => d.hora === f.hora);
    return {
      ...f,
      doc,
      cupoMax: doc?.cupoMax ?? cupoMaxDefault,
      ocupados: doc?.ocupados ?? 0,
      cerrada: doc?.cerrada ?? false,
    };
  });
}

/** `inicio ≥ ahora + anticipacionMinMin` (§5.2). */
export function cumpleAnticipacion(inicio: Date, ahora: Date, anticipacionMinMin: number): boolean {
  return inicio.getTime() >= ahora.getTime() + anticipacionMinMin * 60_000;
}

/** `GET /api/slots` (§6). */
export async function getPublicSlots(): Promise<SlotsResponse> {
  await vencerPendientes();
  const settings = await findSettings();
  const ahora = now();
  const jornada = jornadaActual(settings, ahora);
  const abierto = settings.pedidosHabilitados && jornada.activa && jornada.abierta;
  if (!abierto) return { fecha: jornada.fecha, abierto, slots: [] };

  const franjas = await franjasConCupo(jornada.fecha, jornada.franjas, settings.cupoMaxDefault);
  const slots = franjas
    .filter(
      (f) =>
        cumpleAnticipacion(f.inicio, ahora, settings.anticipacionMinMin) &&
        !f.cerrada &&
        f.ocupados < f.cupoMax,
    )
    .map((f) => ({
      hora: f.hora,
      inicio: f.inicio.toISOString(),
      disponibles: f.cupoMax - f.ocupados,
    }));
  return { fecha: jornada.fecha, abierto, slots };
}

const esDuplicado = (err: unknown) => err instanceof mongo.MongoServerError && err.code === 11000;

/**
 * §3.5 paso 1: asegura que exista el documento de la franja. Upsert que solo inicializa si inserta.
 * Dos upserts simultáneos pueden chocar con el índice único: el que pierde encuentra el documento.
 */
async function asegurarSlot(
  fecha: string,
  franja: FranjaPosible,
  cupoMaxDefault: number,
): Promise<void> {
  const ahora = now();
  try {
    await PickupSlotModel.updateOne(
      { fecha, hora: franja.hora },
      {
        $setOnInsert: {
          inicio: franja.inicio,
          cupoMax: cupoMaxDefault,
          ocupados: 0,
          cerrada: false,
          createdAt: ahora,
          updatedAt: ahora,
        },
      },
      { upsert: true, timestamps: false, setDefaultsOnInsert: false },
    );
  } catch (err) {
    if (!esDuplicado(err)) throw err;
  }
}

/**
 * Reserva atómica del cupo (§3.5 pasos 1 y 2). Si no matchea: 409 `SLOT_CLOSED` o `SLOT_FULL`,
 * según el estado del documento.
 */
export async function reservarCupo(
  fecha: string,
  franja: FranjaPosible,
  cupoMaxDefault: number,
): Promise<PickupSlotLean> {
  await asegurarSlot(fecha, franja, cupoMaxDefault);

  const slot = await PickupSlotModel.findOneAndUpdate(
    { fecha, hora: franja.hora, cerrada: false, $expr: { $lt: ['$ocupados', '$cupoMax'] } },
    { $inc: { ocupados: 1 }, $set: { updatedAt: now() } },
    { returnDocument: 'after', timestamps: false },
  ).lean<PickupSlotLean>();
  if (slot) return slot;

  const actual = await PickupSlotModel.findOne({ fecha, hora: franja.hora }).lean<PickupSlotLean>();
  if (actual?.cerrada) throw new AppError('SLOT_CLOSED', 'La franja elegida está cerrada.');
  throw new AppError('SLOT_FULL', 'La franja elegida ya no tiene cupo.');
}

/** Toda cancelación libera el cupo de la franja (§3.5), sin bajar de 0. */
export async function liberarCupo(slotId: Types.ObjectId): Promise<void> {
  await PickupSlotModel.updateOne(
    { _id: slotId, ocupados: { $gt: 0 } },
    { $inc: { ocupados: -1 }, $set: { updatedAt: now() } },
    { timestamps: false },
  );
}

// Panel (§8.3)

/** Franjas posibles de `fecha`: la jornada actual (respeta `FORCE_OPEN`) o el horario de ese día. */
function franjasPosibles(settings: SettingsLean, fecha: string | undefined, ahora: Date) {
  const jornada = jornadaActual(settings, ahora);
  const f = fecha ?? jornada.fecha;
  const franjas = f === jornada.fecha ? jornada.franjas : getFranjasDeFecha(settings, f);
  return { fecha: f, franjas };
}

const aMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/**
 * Documento fuera de la secuencia de franjas. Con `FORCE_OPEN` la secuencia arranca en "ahora" y se
 * corre con el reloj: ahí solo es huérfana una hora que no cae en el intervalo.
 */
function esHuerfana(settings: SettingsLean, hora: string): boolean {
  return getEnv().FORCE_OPEN ? aMinutos(hora) % settings.intervaloMin !== 0 : true;
}

/** `GET /api/admin/slots` (§8.3): unión de las franjas posibles y los documentos de la fecha. */
export async function getAdminSlots(fecha?: string): Promise<AdminSlotsResponse> {
  await vencerPendientes();
  const settings = await findSettings();
  const posibles = franjasPosibles(settings, fecha, now());
  const docs = await PickupSlotModel.find({ fecha: posibles.fecha }).lean<PickupSlotLean[]>();
  const horas = new Set(posibles.franjas.map((f) => f.hora));

  const slots: AdminSlot[] = posibles.franjas.map((f) => {
    const doc = docs.find((d) => d.hora === f.hora);
    const slot: AdminSlot = {
      hora: f.hora,
      inicio: f.inicio.toISOString(),
      cupoMax: doc?.cupoMax ?? settings.cupoMaxDefault,
      ocupados: doc?.ocupados ?? 0,
      cerrada: doc?.cerrada ?? false,
      huerfana: false,
    };
    return doc ? { _id: doc._id.toString(), ...slot } : slot;
  });
  for (const doc of docs) {
    if (horas.has(doc.hora)) continue;
    slots.push({
      _id: doc._id.toString(),
      hora: doc.hora,
      inicio: doc.inicio.toISOString(),
      cupoMax: doc.cupoMax,
      ocupados: doc.ocupados,
      cerrada: doc.cerrada,
      huerfana: esHuerfana(settings, doc.hora),
    });
  }
  slots.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));

  return { fecha: posibles.fecha, slots };
}

/**
 * `PATCH /api/admin/slots` (§8.3). Crea el documento si no existe (solo para una franja posible de
 * la fecha). El cambio de `cupoMax` va con condición atómica `ocupados ≤ cupoMax`, para no pisarse
 * con una reserva.
 */
export async function updateSlot(input: UpdateSlotInput): Promise<PickupSlot> {
  await vencerPendientes();
  const { fecha, hora, cupoMax, cerrada } = input;

  const existe = await PickupSlotModel.exists({ fecha, hora });
  if (!existe) {
    const settings = await findSettings();
    const franja = franjasPosibles(settings, fecha, now()).franjas.find((f) => f.hora === hora);
    if (!franja) throw new AppError('INVALID_SLOT', 'Esa franja no existe para esa fecha.');
    await asegurarSlot(fecha, franja, settings.cupoMaxDefault);
  }

  const slot = await PickupSlotModel.findOneAndUpdate(
    { fecha, hora, ...(cupoMax !== undefined && { ocupados: { $lte: cupoMax } }) },
    {
      $set: {
        ...(cupoMax !== undefined && { cupoMax }),
        ...(cerrada !== undefined && { cerrada }),
        updatedAt: now(),
      },
    },
    { returnDocument: 'after', timestamps: false },
  ).lean<PickupSlotLean>();
  if (slot) return toSlot(slot);

  const actual = await PickupSlotModel.findOne({ fecha, hora }).lean<PickupSlotLean>();
  throw new AppError(
    'CUPO_BELOW_OCUPADOS',
    `El cupo no puede ser menor a los ${actual?.ocupados ?? 0} pedidos que ya tiene la franja.`,
  );
}
