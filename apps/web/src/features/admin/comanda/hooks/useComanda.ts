import { esEstadoFinal, type EstadoPedido, type Order } from '@blackstation/shared';
import { hashKey, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/Toast';
import { getAdminOrders } from '../../../../services';
import { orderKeys } from '../../../../services/queryKeys';
import { mergeOrders } from '../comanda';

/** Lo que guarda la query de la comanda: los pedidos, el próximo `since` y la última carga completa. */
export type ComandaData = {
  orders: Order[];
  serverTime: string;
  completaAt: number;
};

const POLLING_MS = 5_000;
/** Resync completo (sin `since`) cada 5 min. */
const RESYNC_MS = 5 * 60_000;
/** Al volver a la pestaña o a la ventana después de este rato, resync completo. */
const AUSENCIA_MS = 60_000;
/** Cuánto dura el pulso de un pedido nuevo si nadie toca la card. */
const NUEVO_MS = 30_000;

const SIN_NUEVOS: ReadonlySet<string> = new Set();

type Nuevos = { fecha: string | undefined; ids: ReadonlySet<string> };

type Opciones = {
  /** Llegaron pedidos nuevos en este polling (se llama una sola vez aunque sean varios). */
  onNuevos: () => void;
};

/**
 * Comanda en vivo de la jornada `fecha` (MODELO_DATOS §5.6).
 * - Carga completa al principio; después cada 5 s con `?since=<serverTime>`, mergeando por `_id`.
 * - Resync completo cada 5 min, al volver después de un rato y al cambiar la jornada (otra key).
 * - Detecta pedidos nuevos (no los de la carga inicial) y cancelaciones externas (`vencido`,
 *   `cliente`) comparando cada versión de la query con la anterior.
 */
export function useComanda(fecha: string | undefined, { onNuevos }: Opciones) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const forzarCompleta = useRef(false);
  const onNuevosRef = useRef(onNuevos);
  const [nuevos, setNuevos] = useState<Nuevos>({ fecha, ids: SIN_NUEVOS });

  useEffect(() => {
    onNuevosRef.current = onNuevos;
  }, [onNuevos]);

  const query = useQuery({
    queryKey: orderKeys.list(fecha ?? ''),
    enabled: fecha !== undefined,
    queryFn: async ({ queryKey }): Promise<ComandaData> => {
      const previo = queryClient.getQueryData<ComandaData>(queryKey);
      const since =
        previo && !forzarCompleta.current && Date.now() - previo.completaAt < RESYNC_MS
          ? previo.serverTime
          : undefined;
      const res = await getAdminOrders({ fecha, since });
      // Releer el cache: una mutación pudo guardar una versión más nueva mientras viajaba esto.
      const actual = queryClient.getQueryData<ComandaData>(queryKey) ?? previo;

      if (since === undefined || !actual) {
        forzarCompleta.current = false;
        const ids = new Set(res.orders.map((o) => o._id));
        const cacheados = actual?.orders.filter((o) => ids.has(o._id)) ?? [];
        return {
          orders: mergeOrders(res.orders, cacheados),
          serverTime: res.serverTime,
          completaAt: Date.now(),
        };
      }
      return {
        ...actual,
        orders: mergeOrders(actual.orders, res.orders),
        serverTime: res.serverTime,
      };
    },
    refetchInterval: POLLING_MS,
    refetchIntervalInBackground: true,
    // El polling ya reintenta cada 5 s: un error se muestra enseguida (banner), sin backoff.
    retry: false,
    // Sin red, TanStack pausaría la query sin error y el banner no aparecería: se intenta igual.
    networkMode: 'always',
  });

  // Diff entre versiones de la query: pedidos nuevos y cancelaciones externas.
  useEffect(() => {
    if (fecha === undefined) return;
    const key = orderKeys.list(fecha);
    const hash = hashKey(key);
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const inicial = queryClient.getQueryData<ComandaData>(key);
    let ultima: ComandaData | undefined = inicial;
    // Sin datos todavía: la primera versión que llegue es la carga inicial (no hay nuevos).
    let previos: Map<string, EstadoPedido> | null = inicial ? estados(inicial.orders) : null;

    const quitar = (ids: string[]) =>
      setNuevos((prev) =>
        prev.fecha === fecha
          ? { fecha, ids: new Set([...prev.ids].filter((id) => !ids.includes(id))) }
          : prev,
      );

    function procesar(orders: Order[]) {
      const anteriores = previos;
      previos = estados(orders);
      if (!anteriores) return;

      const llegados: string[] = [];
      for (const order of orders) {
        const antes = anteriores.get(order._id);
        if (antes === undefined) {
          if (!esEstadoFinal(order.estado)) llegados.push(order._id);
        } else if (antes === 'pendiente' && order.estado === 'cancelado') {
          if (order.motivoCancelacion === 'vencido') toast(`#${order.numero} venció`);
          if (order.motivoCancelacion === 'cliente')
            toast(`#${order.numero} lo canceló el cliente`);
        }
      }
      if (llegados.length === 0) return;

      setNuevos((prev) => ({
        fecha,
        ids: new Set([...(prev.fecha === fecha ? prev.ids : []), ...llegados]),
      }));
      const timer = setTimeout(() => {
        timers.delete(timer);
        quitar(llegados);
      }, NUEVO_MS);
      timers.add(timer);
      onNuevosRef.current();
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.query.queryHash !== hash) return;
      const data = event.query.state.data as ComandaData | undefined;
      if (!data || data === ultima) return;
      ultima = data;
      procesar(data.orders);
    });
    return () => {
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
    };
  }, [fecha, queryClient, toast]);

  // Volver a la pestaña o a la ventana después de un rato: resync completo.
  useEffect(() => {
    if (fecha === undefined) return;
    const key = orderKeys.list(fecha);
    let ausenteDesde: number | null = null;

    function salir() {
      ausenteDesde ??= Date.now();
    }
    function volver() {
      if (ausenteDesde !== null && Date.now() - ausenteDesde >= AUSENCIA_MS) {
        forzarCompleta.current = true;
        void queryClient.refetchQueries({ queryKey: key });
      }
      ausenteDesde = null;
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') salir();
      else volver();
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', salir);
    window.addEventListener('focus', volver);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', salir);
      window.removeEventListener('focus', volver);
    };
  }, [fecha, queryClient]);

  /** La card se tocó: deja de pulsar. */
  const marcarVisto = useCallback(
    (id: string) =>
      setNuevos((prev) =>
        prev.ids.has(id)
          ? { ...prev, ids: new Set([...prev.ids].filter((nuevo) => nuevo !== id)) }
          : prev,
      ),
    [],
  );

  // Un nuevo que ya terminó (venció, lo canceló el cliente) deja de pulsar y de contar.
  const orders = query.data?.orders;
  const idsNuevos = nuevos.fecha === fecha ? nuevos.ids : SIN_NUEVOS;
  const nuevosActivos = useMemo(() => {
    if (idsNuevos.size === 0 || !orders) return SIN_NUEVOS;
    return new Set(
      orders.filter((o) => idsNuevos.has(o._id) && !esEstadoFinal(o.estado)).map((o) => o._id),
    );
  }, [idsNuevos, orders]);

  return {
    orders,
    isPending: query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    /** Última respuesta buena (para "última actualización HH:mm"). */
    actualizadoAt: query.dataUpdatedAt,
    nuevos: nuevosActivos,
    marcarVisto,
  };
}

function estados(orders: Order[]): Map<string, EstadoPedido> {
  return new Map(orders.map((o) => [o._id, o.estado]));
}
