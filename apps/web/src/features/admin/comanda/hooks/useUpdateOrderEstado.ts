import type { Order, UpdateOrderEstadoRequest } from '@blackstation/shared';
import { useMutation } from '@tanstack/react-query';
import { updateOrderEstado } from '../../../../services';
import { useAccionPedido } from './useAccionPedido';

/** Confirmar, entregar o cancelar (con motivo). */
export function useUpdateOrderEstado(order: Order) {
  const { mutationKey, guardar, invalidar, onError } = useAccionPedido(order);
  return useMutation({
    mutationKey,
    mutationFn: (request: UpdateOrderEstadoRequest) => updateOrderEstado(order._id, request),
    onSuccess: guardar,
    onError,
    onSettled: invalidar,
  });
}
