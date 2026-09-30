import type { Order } from '@blackstation/shared';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '../../../../components/Toast';
import { horaLocal } from '../../../../lib/hora';
import { extendOrder } from '../../../../services';
import { useAccionPedido } from './useAccionPedido';

/** "Extender plazo" de un pendiente de transferencia (MODELO_DATOS §5.4). */
export function useExtendOrder(order: Order) {
  const { mutationKey, guardar, invalidar, onError } = useAccionPedido(order);
  const toast = useToast();
  return useMutation({
    mutationKey,
    mutationFn: () => extendOrder(order._id),
    onSuccess: (actualizado) => {
      guardar(actualizado);
      if (actualizado.expiresAt) {
        toast(`Plazo extendido hasta las ${horaLocal(actualizado.expiresAt)}`);
      }
    },
    onError,
    onSettled: invalidar,
  });
}
