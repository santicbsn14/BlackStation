import { useContext, useMemo } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import { verCarrito } from '../cart';
import { CartContext, type CartContextValue } from '../cartContext';

export function useCart(): CartContextValue {
  const cart = useContext(CartContext);
  if (!cart) throw new Error('useCart requiere CartProvider');
  return cart;
}

/** Líneas con precio y disponibilidad según el catálogo en caché. */
export function useCartView() {
  const { lineas } = useCart();
  const catalog = useCatalog();
  const vista = useMemo(() => verCarrito(lineas, catalog.data), [lineas, catalog.data]);
  return {
    ...vista,
    catalogCargando: catalog.isPending,
    catalogError: catalog.isError && !catalog.data,
  };
}
