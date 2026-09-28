import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrder } from '../../../services';
import { slotKeys } from '../../../services/queryKeys';

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    // Un pedido ocupa cupo, y un 409 significa que las franjas cambiaron: refrescar en ambos casos.
    onSettled: () => queryClient.invalidateQueries({ queryKey: slotKeys.all }),
  });
}
