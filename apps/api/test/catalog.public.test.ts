import { readFileSync } from 'node:fs';
import type { CatalogResponse, Category, Extra, Product } from '@blackstation/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { CategoryModel, ExtraModel, ProductModel } from '../src/models';
import { runSeed } from '../src/seed/runSeed';
import { clearDb, useTestDb } from './db';

useTestDb();

const app = createApp();

function leerData<T>(nombre: string): T {
  return JSON.parse(
    readFileSync(new URL(`../src/seed/data/${nombre}.json`, import.meta.url), 'utf8'),
  ) as T;
}

/**
 * Snapshot armado desde los JSON con el mismo algoritmo que `getCatalog` de los mocks del front
 * (`apps/web/src/services/mocks/index.ts`).
 */
function catalogoDelMock(
  categories: Category[],
  products: Product[],
  extras: Extra[],
): CatalogResponse {
  const porOrden = (a: { orden: number }, b: { orden: number }) => a.orden - b.orden;
  return {
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
  };
}

const getCatalog = async () => {
  const res = await request(app).get('/api/catalog');
  expect(res.status).toBe(200);
  return res.body as CatalogResponse;
};

const productIds = (catalog: CatalogResponse) =>
  catalog.categories.flatMap((c) => c.products.map((p) => p._id));

beforeEach(async () => {
  await clearDb();
  await runSeed({
    demo: true,
    admin: { usuario: 'admin', password: 'clave-de-prueba', nombre: 'Black Station' },
  });
});

describe('GET /api/catalog', () => {
  it('con el seed --demo es igual al getCatalog del mock', async () => {
    const esperado = catalogoDelMock(
      leerData<Category[]>('categories'),
      leerData<Product[]>('products'),
      leerData<Extra[]>('extras'),
    );
    expect(await getCatalog()).toEqual(esperado);
  });

  it('excluye categorías inactivas y productos inactivos', async () => {
    await CategoryModel.updateOne({ _id: '66f1a0000000000000000004' }, { activa: false });
    const catalog = await getCatalog();
    expect(catalog.categories.map((c) => c._id)).not.toContain('66f1a0000000000000000004');
    // El 13 es el inactivo del fixture; el 10 es de la categoría que quedó inactiva.
    expect(productIds(catalog)).not.toContain('66f1c0000000000000000013');
    expect(productIds(catalog)).not.toContain('66f1c0000000000000000010');
  });

  it('incluye los productos no disponibles', async () => {
    await ProductModel.updateOne({ _id: '66f1c0000000000000000001' }, { disponible: false });
    const catalog = await getCatalog();
    const lomito = catalog.categories[0]?.products.find(
      (p) => p._id === '66f1c0000000000000000001',
    );
    expect(lomito?.disponible).toBe(false);
  });

  it('excluye los extras inactivos o no disponibles', async () => {
    await ExtraModel.updateOne({ _id: '66f1b0000000000000000001' }, { activo: false });
    await ExtraModel.updateOne({ _id: '66f1b0000000000000000002' }, { disponible: false });
    const catalog = await getCatalog();
    const extras = catalog.categories.flatMap((c) =>
      c.products.flatMap((p) => p.extras.map((e) => e._id)),
    );
    expect(extras).not.toContain('66f1b0000000000000000001');
    expect(extras).not.toContain('66f1b0000000000000000002');
    expect(extras).toContain('66f1b0000000000000000005');
  });

  it('ordena categorías y productos por (orden, _id) y extras según extrasIds', async () => {
    // Empate de orden: decide el _id. Categoría 4 pasa adelante de todo.
    await CategoryModel.updateOne({ _id: '66f1a0000000000000000004' }, { orden: 0 });
    await CategoryModel.updateOne({ _id: '66f1a0000000000000000003' }, { orden: 0 });
    await ProductModel.updateOne({ _id: '66f1c0000000000000000003' }, { orden: 1 });
    await ProductModel.updateOne(
      { _id: '66f1c0000000000000000001' },
      { extrasIds: ['66f1b0000000000000000005', '66f1b0000000000000000001'] },
    );

    const catalog = await getCatalog();
    expect(catalog.categories.map((c) => c._id)).toEqual([
      '66f1a0000000000000000003',
      '66f1a0000000000000000004',
      '66f1a0000000000000000001',
      '66f1a0000000000000000002',
    ]);
    const lomitos = catalog.categories[2]?.products ?? [];
    expect(lomitos.map((p) => p._id)).toEqual([
      '66f1c0000000000000000001',
      '66f1c0000000000000000003',
      '66f1c0000000000000000002',
    ]);
    expect(lomitos[0]?.extras.map((e) => e._id)).toEqual([
      '66f1b0000000000000000005',
      '66f1b0000000000000000001',
    ]);
  });

  it('incluye categorías activas sin productos', async () => {
    await ProductModel.updateMany({ categoriaId: '66f1a0000000000000000004' }, { activo: false });
    const catalog = await getCatalog();
    const bebidas = catalog.categories.find((c) => c._id === '66f1a0000000000000000004');
    expect(bebidas?.products).toEqual([]);
  });

  it('no expone campos internos', async () => {
    await ProductModel.updateOne(
      { _id: '66f1c0000000000000000001' },
      {
        fotoUrl: 'https://res.cloudinary.com/test/image/upload/v1/blackstation/products/a.jpg',
        fotoPublicId: 'blackstation/products/a',
      },
    );
    const catalog = await getCatalog();
    const category = catalog.categories[0];
    expect(Object.keys(category ?? {}).sort()).toEqual(['_id', 'nombre', 'orden', 'products']);
    const product = category?.products[0];
    expect(Object.keys(product ?? {}).sort()).toEqual(
      [
        '_id',
        'descripcion',
        'disponible',
        'extras',
        'fotoUrl',
        'ingredientesQuitables',
        'nombre',
        'precio',
      ].sort(),
    );
    expect(product?.fotoUrl).toContain('blackstation/products/a');
    expect(Object.keys(product?.extras[0] ?? {}).sort()).toEqual(
      ['_id', 'cantidadMax', 'nombre', 'precio'].sort(),
    );
  });
});
