import { useQuery } from '@tanstack/react-query';
import { getAdminOrders } from '../../../services';
import { orderKeys } from '../../../services/queryKeys';

const POLLING_MS = 10_000;

/** Cantidad de pedidos pendientes de la jornada actual, para el badge del menú. */
export function usePendientesCount(): number {
  const { data } = useQuery({
    queryKey: orderKeys.pendientes(),
    queryFn: () => getAdminOrders({ estado: 'pendiente' }),
    refetchInterval: POLLING_MS,
    refetchIntervalInBackground: true,
    select: (res) => res.orders.length,
  });
  return data ?? 0;
}
