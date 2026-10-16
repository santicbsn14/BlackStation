import type { CatalogExtra, CatalogResponse, Category, Extra, Product } from '@blackstation/shared';
import type { Types } from 'mongoose';
import type { CategoryDoc, ExtraDoc, ProductDoc } from '../models';

type Lean<T> = T & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

/** Documentos leídos con `lean()`. */
export type CategoryLean = Lean<CategoryDoc>;
export type ProductLean = Lean<ProductDoc>;
export type ExtraLean = Lean<ExtraDoc>;

export function toCategory(doc: CategoryLean): Category {
  return {
    _id: doc._id.toString(),
    nombre: doc.nombre,
    orden: doc.orden,
    activa: doc.activa,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toProduct(doc: ProductLean): Product {
  return {
    _id: doc._id.toString(),
    nombre: doc.nombre,
    descripcion: doc.descripcion ?? '',
    categoriaId: doc.categoriaId.toString(),
    precio: doc.precio,
    fotoUrl: doc.fotoUrl ?? null,
    fotoPublicId: doc.fotoPublicId ?? null,
    disponible: doc.disponible,
    activo: doc.activo,
    orden: doc.orden,
    ingredientesQuitables: [...doc.ingredientesQuitables],
    extrasIds: doc.extrasIds.map((id) => id.toString()),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toExtra(doc: ExtraLean): Extra {
  return {
    _id: doc._id.toString(),
    nombre: doc.nombre,
    precio: doc.precio,
    disponible: doc.disponible,
    cantidadMax: doc.cantidadMax,
    activo: doc.activo,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * `GET /api/catalog` (§6). Recibe las categorías `activa` y los productos `activo` ya ordenados por
 * `(orden, _id)`, y los extras `activo` + `disponible` (en cualquier orden): los de cada producto
 * salen en el orden de su `extrasIds`. Recorte explícito: sin `activo`, `categoriaId`,
 * `fotoPublicId` ni `extrasIds`.
 */
export function toCatalog(
  categories: CategoryLean[],
  products: ProductLean[],
  extras: ExtraLean[],
): CatalogResponse {
  const extrasPorId = new Map<string, CatalogExtra>(
    extras.map((e) => [
      e._id.toString(),
      { _id: e._id.toString(), nombre: e.nombre, precio: e.precio, cantidadMax: e.cantidadMax },
    ]),
  );

  return {
    categories: categories.map((c) => ({
      _id: c._id.toString(),
      nombre: c.nombre,
      orden: c.orden,
      products: products
        .filter((p) => p.categoriaId.equals(c._id))
        .map((p) => ({
          _id: p._id.toString(),
          nombre: p.nombre,
          descripcion: p.descripcion ?? '',
          precio: p.precio,
          fotoUrl: p.fotoUrl ?? null,
          disponible: p.disponible,
          ingredientesQuitables: [...p.ingredientesQuitables],
          extras: p.extrasIds.flatMap((id) => {
            const extra = extrasPorId.get(id.toString());
            return extra ? [{ ...extra }] : [];
          }),
        })),
    })),
  };
}
