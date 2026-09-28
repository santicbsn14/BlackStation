import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelOrder } from '../../../../services';
import { orderKeys, slotKeys } from '../../../../services/queryKeys';
import { borrarPedidoActivo } from '../../storage';

/** Cancelación por el cliente (`POST /orders/:codigo/cancelar`, solo desde `pendiente`). */
export function useCancelOrder(codigo: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelOrder(codigo),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.public(codigo), order);
      borrarPedidoActivo(codigo);
    },
    // Con éxito se liberó un cupo; con 409 el pedido cambió de estado: refrescar en ambos casos.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.public(codigo) }),
        queryClient.invalidateQueries({ queryKey: slotKeys.all }),
      ]),
  });
}
