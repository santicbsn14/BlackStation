import type { Category, Extra, Order, PickupSlot, Product, Settings } from '@blackstation/shared';
import categoriesJson from './data/categories.json';
import extrasJson from './data/extras.json';
import productsJson from './data/products.json';
import settingsJson from './data/settings.json';

const STORAGE_KEY = 'bs-mock-db';
/** Subir si cambian los fixtures o la forma del store: fuerza un reseed. */
const VERSION = 1;

export type MockDb = {
  version: number;
  categories: Category[];
  products: Product[];
  extras: Extra[];
  settings: Settings;
  pickupSlots: PickupSlot[];
  orders: Order[];
};

function seed(): MockDb {
  const categories: Category[] = categoriesJson;
  const products: Product[] = productsJson;
  const extras: Extra[] = extrasJson;
  const settings: Settings = settingsJson;
  return structuredClone({
    version: VERSION,
    categories,
    products,
    extras,
    settings,
    pickupSlots: [],
    orders: [],
  });
}

function load(): MockDb | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      parsed.version === VERSION
    ) {
      return parsed as MockDb;
    }
  } catch {
    // JSON corrupto: se resiembra.
  }
  return null;
}

let db: MockDb | null = null;

/** Store en memoria, inicializado perezosamente desde `localStorage` o los fixtures. */
export function getDb(): MockDb {
  db ??= load() ?? seed();
  return db;
}

export function saveDb(): void {
  if (db) localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}
