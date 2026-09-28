import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, createOrder } from '../../../../services';
import { settingsKeys, slotKeys } from '../../../../services/queryKeys';

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    onError: (error) => {
      // Cerrado o pedidos deshabilitados: el checkout pasa a cerrado con los settings al día.
      if (
        error instanceof ApiError &&
        (error.code === 'CLOSED' || error.code === 'ORDERS_DISABLED')
      ) {
        void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      }
    },
    // Un pedido ocupa cupo, y un 409 significa que las franjas cambiaron: refrescar en ambos casos.
    onSettled: () => queryClient.invalidateQueries({ queryKey: slotKeys.all }),
  });
}
