import {
  calcularSubtotal,
  type CatalogProduct,
  type CatalogResponse,
  type CreateOrderItem,
} from '@blackstation/shared';
import { esObjeto, guardarJson, leerJson } from '../../../lib/storage';

// Modelo del carrito. Se guarda solo lo que elige el cliente (mismo shape que `CreateOrderItem`):
// precio y disponibilidad se recalculan siempre contra el catálogo.

export type CartLine = CreateOrderItem;

const STORAGE_KEY = 'bs-cart';

/** Quitados y extras ordenados, sin extras en 0: dos personalizaciones iguales quedan idénticas. */
export function normalizarLinea(linea: CartLine): CartLine {
  return {
    productoId: linea.productoId,
    cantidad: linea.cantidad,
    quitados: [...new Set(linea.quitados)].sort(),
    extras: linea.extras
      .filter((e) => e.cantidad > 0)
      .map((e) => ({ extraId: e.extraId, cantidad: e.cantidad }))
      .sort((a, b) => a.extraId.localeCompare(b.extraId)),
  };
}

/** Identidad de la línea para la fusión: producto + quitados + extras (sin la cantidad). */
export function lineKey(linea: CartLine): string {
  return JSON.stringify([linea.productoId, linea.quitados, linea.extras]);
}

/** Inserta `linea` en `index`, o la suma a una línea igual si ya existe. */
function fusionar(lineas: CartLine[], linea: CartLine, index = lineas.length): CartLine[] {
  const key = lineKey(linea);
  const igual = lineas.findIndex((l) => lineKey(l) === key);
  if (igual === -1) return lineas.toSpliced(index, 0, linea);
  return lineas.map((l, i) => (i === igual ? { ...l, cantidad: l.cantidad + linea.cantidad } : l));
}

export type CartAction =
  | { type: 'agregar'; linea: CartLine }
  | { type: 'reemplazar'; index: number; linea: CartLine }
  | { type: 'cantidad'; index: number; cantidad: number }
  | { type: 'quitar'; indices: number[] }
  | { type: 'setear'; lineas: CartLine[] }
  | { type: 'vaciar' };

export function cartReducer(lineas: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'agregar':
      return fusionar(lineas, normalizarLinea(action.linea));
    case 'reemplazar': {
      if (!lineas[action.index]) return lineas;
      const resto = lineas.toSpliced(action.index, 1);
      return fusionar(resto, normalizarLinea(action.linea), action.index);
    }
    case 'cantidad':
      if (action.cantidad < 1) return lineas;
      return lineas.map((l, i) => (i === action.index ? { ...l, cantidad: action.cantidad } : l));
    case 'quitar':
      return lineas.filter((_, i) => !action.indices.includes(i));
    case 'setear':
      return action.lineas.reduce<CartLine[]>((acc, l) => fusionar(acc, normalizarLinea(l)), []);
    case 'vaciar':
      return [];
  }
}

// Persistencia

function esLinea(valor: unknown): valor is CartLine {
  return (
    esObjeto(valor) &&
    typeof valor.productoId === 'string' &&
    Number.isInteger(valor.cantidad) &&
    (valor.cantidad as number) >= 1 &&
    Array.isArray(valor.quitados) &&
    valor.quitados.every((q) => typeof q === 'string') &&
    Array.isArray(valor.extras) &&
    valor.extras.every(
      (e) => esObjeto(e) && typeof e.extraId === 'string' && Number.isInteger(e.cantidad),
    )
  );
}

function esCarrito(valor: unknown): valor is CartLine[] {
  return Array.isArray(valor) && valor.every(esLinea);
}

export function leerCarrito(): CartLine[] {
  return cartReducer([], { type: 'setear', lineas: leerJson(STORAGE_KEY, esCarrito) ?? [] });
}

export function guardarCarrito(lineas: CartLine[]): void {
  guardarJson(STORAGE_KEY, lineas);
}

// Vista contra el catálogo

export function buscarProducto(
  catalogo: CatalogResponse | undefined,
  productoId: string,
): CatalogProduct | undefined {
  for (const categoria of catalogo?.categories ?? []) {
    const producto = categoria.products.find((p) => p._id === productoId);
    if (producto) return producto;
  }
  return undefined;
}

export type LineaVista = {
  index: number;
  key: string;
  linea: CartLine;
  /** `null` si el producto ya no está en el catálogo (inactivo o de categoría inactiva). */
  producto: CatalogProduct | null;
  disponible: boolean;
  nombre: string;
  quitados: string[];
  extras: { extraId: string; nombre: string; precio: number; cantidad: number }[];
  subtotal: number;
};

/**
 * Precio y disponibilidad de cada línea con el catálogo actual. Los extras que ya no se ofrecen
 * no se muestran ni suman (los saca `sanearCarrito`), y las cantidades se topean a `cantidadMax`.
 */
export function verCarrito(lineas: CartLine[], catalogo: CatalogResponse | undefined) {
  const vistas = lineas.map((linea, index): LineaVista => {
    const producto = buscarProducto(catalogo, linea.productoId) ?? null;
    const extras = linea.extras.flatMap((e) => {
      const extra = producto?.extras.find((x) => x._id === e.extraId);
      if (!extra) return [];
      return [
        {
          extraId: extra._id,
          nombre: extra.nombre,
          precio: extra.precio,
          cantidad: Math.min(e.cantidad, extra.cantidadMax),
        },
      ];
    });
    const quitados = linea.quitados.filter((q) => producto?.ingredientesQuitables.includes(q));
    return {
      index,
      key: lineKey(linea),
      linea,
      producto,
      disponible: Boolean(producto?.disponible),
      nombre: producto?.nombre ?? 'Producto',
      quitados,
      extras,
      subtotal: producto
        ? calcularSubtotal({ precioUnitario: producto.precio, cantidad: linea.cantidad, extras })
        : 0,
    };
  });

  return {
    lineas: vistas,
    total: vistas.reduce((acc, l) => acc + (l.disponible ? l.subtotal : 0), 0),
    noDisponibles: vistas.filter((l) => !l.disponible).map((l) => l.index),
  };
}

/**
 * Corrige las líneas contra el catálogo nuevo: saca extras que ya no se ofrecen y quitados
 * inválidos (con una nota por línea) y ajusta extras por encima de `cantidadMax`.
 * `anterior` sirve para nombrar lo que se sacó. Los productos no disponibles no se tocan.
 */
export function sanearCarrito(
  lineas: CartLine[],
  catalogo: CatalogResponse,
  anterior: CatalogResponse | undefined,
): { lineas: CartLine[]; notas: Record<string, string[]> } {
  const notas: Record<string, string[]> = {};
  const saneadas = lineas.map((linea) => {
    const producto = buscarProducto(catalogo, linea.productoId);
    if (!producto) return linea;
    const productoAnterior = buscarProducto(anterior, linea.productoId);
    const avisos: string[] = [];

    const quitados = linea.quitados.filter((q) => {
      const valido = producto.ingredientesQuitables.includes(q);
      if (!valido) avisos.push(`Se quitó "Sin ${q}" (no disponible)`);
      return valido;
    });

    const extras = linea.extras.flatMap((e) => {
      const extra = producto.extras.find((x) => x._id === e.extraId);
      if (!extra) {
        const nombre = productoAnterior?.extras.find((x) => x._id === e.extraId)?.nombre;
        avisos.push(`Se quitó ${nombre ?? 'un extra'} (no disponible)`);
        return [];
      }
      return [{ extraId: e.extraId, cantidad: Math.min(e.cantidad, extra.cantidadMax) }];
    });

    const saneada = normalizarLinea({ ...linea, quitados, extras });
    if (avisos.length > 0) notas[lineKey(saneada)] = avisos;
    return saneada;
  });

  return { lineas: cartReducer([], { type: 'setear', lineas: saneadas }), notas };
}
