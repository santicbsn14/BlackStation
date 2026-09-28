import { useQuery } from '@tanstack/react-query';
import { getOrderByCodigo } from '../../../services';
import { orderKeys } from '../../../services/queryKeys';

const POLLING_MS = 10_000;

/** Seguimiento público del pedido con polling (MODELO_DATOS §5.5). */
export function useOrder(codigo: string) {
  return useQuery({
    queryKey: orderKeys.detail(codigo),
    queryFn: () => getOrderByCodigo(codigo),
    refetchInterval: POLLING_MS,
  });
}
