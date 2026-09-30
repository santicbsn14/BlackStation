import type { Order } from '@blackstation/shared';
import { useMutation } from '@tanstack/react-query';
import { reprintOrder } from '../../../../services';
import { useAccionPedido } from './useAccionPedido';

/** "Reimprimir": vuelve `impresoAt` a `null` y el pedido entra otra vez en la cola (§5.7). */
export function useReprintOrder(order: Order) {
  const { mutationKey, actualizar, invalidar, onError } = useAccionPedido(order);
  return useMutation({
    mutationKey,
    mutationFn: () => reprintOrder(order._id),
    onSuccess: () => actualizar((actual) => ({ ...actual, impresoAt: null })),
    onError,
    onSettled: invalidar,
  });
}
