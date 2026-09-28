import { createContext } from 'react';
import type { CartLine, verCarrito } from './cart';

export type CartContextValue = {
  lineas: CartLine[];
  /** Suma de cantidades, para el contador del header. */
  unidades: number;
  agregar: (linea: CartLine) => void;
  reemplazar: (index: number, linea: CartLine) => void;
  setCantidad: (index: number, cantidad: number) => void;
  quitar: (indices: number[]) => void;
  vaciar: () => void;
  /** Avisos de la última revalidación, por `lineKey`. */
  notas: Record<string, string[]>;
  drawerAbierto: boolean;
  /** Abre el drawer y revalida contra el catálogo. */
  abrirDrawer: () => void;
  cerrarDrawer: () => void;
  /** Cambia cada vez que se agrega algo: dispara el pulso del contador. */
  pulso: number;
  /** Refetch del catálogo + saneamiento. Devuelve la vista resultante (o `null` si falló). */
  revalidar: () => Promise<ReturnType<typeof verCarrito> | null>;
};

export const CartContext = createContext<CartContextValue | null>(null);
