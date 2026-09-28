import { esEstadoFinal } from '@blackstation/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError, getOrderByCodigo } from '../../../services';
import { orderKeys } from '../../../services/queryKeys';

const POLLING_MS = 10_000;

/**
 * Seguimiento público del pedido con polling (MODELO_DATOS §5.5).
 * El polling se corta en un estado final o si el pedido no existe. Sin `codigo` no consulta.
 */
export function useOrder(codigo: string | null) {
  return useQuery({
    queryKey: orderKeys.public(codigo ?? ''),
    queryFn: () => getOrderByCodigo(codigo ?? ''),
    enabled: codigo !== null,
    refetchInterval: ({ state }) => {
      if (state.data && esEstadoFinal(state.data.estado)) return false;
      if (state.error instanceof ApiError && state.error.status === 404) return false;
      return POLLING_MS;
    },
  });
}
