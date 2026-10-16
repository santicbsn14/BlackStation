import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { normalizarBusqueda } from '../lib/texto';
import {
  ALL_MODELS,
  CategoryModel,
  CustomerModel,
  ExtraModel,
  ProductModel,
  SettingsModel,
  UserModel,
} from '../models';

export type SeedOptions = {
  demo: boolean;
  admin: { usuario: string; password: string; nombre: string };
};

export type SeedResult = {
  settingsCreado: boolean;
  /** Colecciones del `--demo` que se cargaron (las que estaban vacías). */
  demoCargado: string[];
};

const BCRYPT_COSTO = 10;

const documentos = z.array(z.looseObject({}));
const customers = z.array(z.looseObject({ nombre: z.string() }));

/** JSON de `seed/data/` (copias de los fixtures de los mocks del front, con sus `_id`). */
function leerData(nombre: string): unknown {
  return JSON.parse(readFileSync(new URL(`./data/${nombre}.json`, import.meta.url), 'utf8'));
}

type Coleccion = {
  countDocuments: () => PromiseLike<number>;
  insertMany: (docs: object[]) => PromiseLike<unknown>;
};

/** Inserta solo si la colección está vacía. Devuelve si cargó algo. */
async function cargarSiVacia(model: Coleccion, docs: object[]): Promise<boolean> {
  if ((await model.countDocuments()) > 0) return false;
  await model.insertMany(docs);
  return true;
}

/**
 * Seed idempotente:
 * - `settings`: se crea con los defaults de §3.7 solo si no existe (nunca pisa uno existente).
 * - Usuario admin: upsert por `usuario` (actualiza nombre y contraseña).
 * - `demo`: categorías, productos, extras y clientes, cada colección solo si está vacía.
 */
export async function runSeed(options: SeedOptions): Promise<SeedResult> {
  await Promise.all(ALL_MODELS.map((model) => model.syncIndexes()));

  // Los defaults de §3.7 son los mismos que usan los mocks (`settings.json`).
  const defaults: Record<string, unknown> = z.looseObject({}).parse(leerData('settings'));
  delete defaults._id;
  delete defaults.updatedAt;
  const settings = await SettingsModel.updateOne({}, { $setOnInsert: defaults }, { upsert: true });

  const passwordHash = await bcrypt.hash(options.admin.password, BCRYPT_COSTO);
  await UserModel.updateOne(
    { usuario: options.admin.usuario },
    { $set: { nombre: options.admin.nombre, passwordHash } },
    { upsert: true },
  );

  const demoCargado: string[] = [];
  if (options.demo) {
    const cargas: [string, Coleccion, object[]][] = [
      ['categories', CategoryModel, documentos.parse(leerData('categories'))],
      ['products', ProductModel, documentos.parse(leerData('products'))],
      ['extras', ExtraModel, documentos.parse(leerData('extras'))],
      [
        'customers',
        CustomerModel,
        customers
          .parse(leerData('customers'))
          .map((c) => ({ ...c, nombreBusqueda: normalizarBusqueda(c.nombre) })),
      ],
    ];
    for (const [nombre, model, docs] of cargas) {
      if (await cargarSiVacia(model, docs)) demoCargado.push(nombre);
    }
  }

  return { settingsCreado: settings.upsertedCount > 0, demoCargado };
}
