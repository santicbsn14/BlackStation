import type { PublicSettings, Settings } from '@blackstation/shared';
import { AppError } from '../lib/AppError';
import { now } from '../lib/clock';
import { toPublicSettings, toSettings, type SettingsLean } from '../mappers/settings';
import { SettingsModel } from '../models';
import type { UpdateSettingsInput } from '../validators/settings';

/** Sin documento `settings` la API no puede operar: 500 genérico y el motivo al log. */
function faltaSettings(): AppError {
  console.error(
    'No existe el documento `settings`: falta correr el seed (npm run seed -w @blackstation/api).',
  );
  return new AppError('INTERNAL_ERROR', 'Ocurrió un error inesperado.');
}

/** Documento `settings` plano. Sin documento: 500 genérico (ver `faltaSettings`). */
export async function findSettings(): Promise<SettingsLean> {
  const doc = await SettingsModel.findOne().lean<SettingsLean>();
  if (!doc) throw faltaSettings();
  return doc;
}

export async function getSettings(): Promise<Settings> {
  return toSettings(await findSettings());
}

export async function getPublicSettings(): Promise<PublicSettings> {
  return toPublicSettings(await findSettings());
}

/**
 * §8.4: reemplaza los campos editables. `reputacion` no viene en el input (se conserva la
 * guardada) y `cupoMaxDefault` solo aplica a franjas que todavía no existen como documento.
 */
export async function updateSettings(input: UpdateSettingsInput): Promise<Settings> {
  const doc = await SettingsModel.findOneAndUpdate(
    {},
    { $set: { ...input, updatedAt: now() } },
    { returnDocument: 'after', timestamps: false, runValidators: true },
  ).lean<SettingsLean>();
  if (!doc) throw faltaSettings();
  return toSettings(doc);
}
