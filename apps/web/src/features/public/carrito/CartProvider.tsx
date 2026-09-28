import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useCatalog } from '../hooks/useCatalog';
import {
  cartReducer,
  guardarCarrito,
  leerCarrito,
  sanearCarrito,
  verCarrito,
  type CartLine,
} from './cart';
import { CartContext, type CartContextValue } from './cartContext';

export function CartProvider({ children }: { children: ReactNode }) {
  const [lineas, dispatch] = useReducer(cartReducer, undefined, leerCarrito);
  const [notas, setNotas] = useState<Record<string, string[]>>({});
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [pulso, setPulso] = useState(0);
  const { data: catalogo, refetch } = useCatalog();

  // Últimos valores para `revalidar`, que corre después de un await.
  const lineasRef = useRef(lineas);
  const catalogoRef = useRef(catalogo);
  useEffect(() => {
    lineasRef.current = lineas;
    guardarCarrito(lineas);
  }, [lineas]);
  useEffect(() => {
    catalogoRef.current = catalogo;
  }, [catalogo]);

  // Todas las acciones son estables: se pueden usar como dependencia de effects.
  const revalidar = useCallback(async () => {
    const anterior = catalogoRef.current;
    const { data } = await refetch();
    if (!data) return null;
    const saneado = sanearCarrito(lineasRef.current, data, anterior);
    dispatch({ type: 'setear', lineas: saneado.lineas });
    setNotas(saneado.notas);
    return verCarrito(saneado.lineas, data);
  }, [refetch]);

  const agregar = useCallback((linea: CartLine) => {
    dispatch({ type: 'agregar', linea });
    setPulso((p) => p + 1);
  }, []);
  const reemplazar = useCallback(
    (index: number, linea: CartLine) => dispatch({ type: 'reemplazar', index, linea }),
    [],
  );
  const setCantidad = useCallback(
    (index: number, cantidad: number) => dispatch({ type: 'cantidad', index, cantidad }),
    [],
  );
  const quitar = useCallback((indices: number[]) => dispatch({ type: 'quitar', indices }), []);
  const vaciar = useCallback(() => {
    dispatch({ type: 'vaciar' });
    setNotas({});
  }, []);
  const abrirDrawer = useCallback(() => {
    setDrawerAbierto(true);
    void revalidar();
  }, [revalidar]);
  const cerrarDrawer = useCallback(() => setDrawerAbierto(false), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lineas,
      unidades: lineas.reduce((acc, l) => acc + l.cantidad, 0),
      agregar,
      reemplazar,
      setCantidad,
      quitar,
      vaciar,
      notas,
      drawerAbierto,
      abrirDrawer,
      cerrarDrawer,
      pulso,
      revalidar,
    }),
    [
      lineas,
      agregar,
      reemplazar,
      setCantidad,
      quitar,
      vaciar,
      notas,
      drawerAbierto,
      abrirDrawer,
      cerrarDrawer,
      pulso,
      revalidar,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
