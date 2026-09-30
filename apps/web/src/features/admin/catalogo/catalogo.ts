import type { Category, Product } from '@blackstation/shared';

export const TABS = ['productos', 'categorias', 'extras'] as const;
export type Tab = (typeof TABS)[number];

export const TITULO_TAB: Record<Tab, string> = {
  productos: 'Productos',
  categorias: 'Categorías',
  extras: 'Extras',
};

export const porOrden = (a: { orden: number }, b: { orden: number }) => a.orden - b.orden;

/** `orden` para un alta: al final de la lista. */
export function siguienteOrden(lista: readonly { orden: number }[]): number {
  return lista.reduce((max, item) => Math.max(max, item.orden), 0) + 1;
}

export type GrupoProductos = {
  categoria: Category | null;
  productos: Product[];
};

/**
 * Productos agrupados por categoría (en el orden de las categorías, y cada grupo por `orden`).
 * Sin `mostrarInactivos`, se ocultan los productos y las categorías inactivas. Un producto cuya
 * categoría no existe va a un grupo "Sin categoría" al final.
 */
export function agruparProductos(
  categories: Category[],
  products: Product[],
  mostrarInactivos: boolean,
): GrupoProductos[] {
  const visibles = products.filter((p) => mostrarInactivos || p.activo);
  const grupos: GrupoProductos[] = [...categories]
    .sort(porOrden)
    .filter((c) => mostrarInactivos || c.activa)
    .map((categoria) => ({
      categoria,
      productos: visibles.filter((p) => p.categoriaId === categoria._id).sort(porOrden),
    }));
  const ids = new Set(categories.map((c) => c._id));
  const huerfanos = visibles.filter((p) => !ids.has(p.categoriaId)).sort(porOrden);
  if (huerfanos.length > 0) grupos.push({ categoria: null, productos: huerfanos });
  return grupos;
}

/** Texto de un input numérico → entero ≥ `min`, o `null` si no es válido. */
export function parseEntero(texto: string, min = 0): number | null {
  if (!/^\d+$/.test(texto.trim())) return null;
  const n = Number(texto.trim());
  return Number.isSafeInteger(n) && n >= min ? n : null;
}
