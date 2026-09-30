import type { Order } from '@blackstation/shared';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useToast } from '../../../../components/Toast';
import { ApiError } from '../../../../services';
import { customerKeys, orderKeys, slotKeys } from '../../../../services/queryKeys';
import { mergeOrders } from '../comanda';
import type { ComandaData } from './useComanda';

/**
 * Lo común de las acciones sobre un pedido (confirmar, entregar, cancelar, extender, reimprimir):
 * guardar la respuesta en la comanda, manejar errores e invalidar lo afectado.
 */
export function useAccionPedido(order: Order) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { numero, fecha, _id: id } = order;

  /** Aplica un cambio al pedido dentro de la comanda, sin esperar al polling. */
  const actualizar = useCallback(
    (cambio: (actual: Order) => Order) =>
      queryClient.setQueryData<ComandaData>(orderKeys.list(fecha), (prev) =>
        prev ? { ...prev, orders: prev.orders.map((o) => (o._id === id ? cambio(o) : o)) } : prev,
      ),
    [queryClient, fecha, id],
  );

  /** Guarda en la comanda el pedido que devolvió la API. */
  const guardar = useCallback(
    (actualizado: Order) =>
      queryClient.setQueryData<ComandaData>(orderKeys.list(fecha), (prev) =>
        prev ? { ...prev, orders: mergeOrders(prev.orders, [actualizado]) } : prev,
      ),
    [queryClient, fecha],
  );

  const invalidar = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    void queryClient.invalidateQueries({ queryKey: slotKeys.all });
    void queryClient.invalidateQueries({ queryKey: customerKeys.all });
  }, [queryClient]);

  const onError = useCallback(
    (error: Error) => {
      // El 401 ya redirige al login.
      if (error instanceof ApiError && error.status === 401) return;
      if (error instanceof ApiError && error.code === 'INVALID_TRANSITION') {
        toast(`#${numero} cambió de estado: actualizamos la comanda`);
        void queryClient.invalidateQueries({ queryKey: orderKeys.all });
        return;
      }
      toast(error instanceof ApiError ? error.message : 'No pudimos hacerlo. Probá de nuevo.');
    },
    [queryClient, toast, numero],
  );

  return { mutationKey: orderKeys.accion(id), actualizar, guardar, invalidar, onError };
}

/** `true` mientras viaja cualquier acción sobre el pedido (desde la card o desde el detalle). */
export function useAccionEnCurso(id: string): boolean {
  return useIsMutating({ mutationKey: orderKeys.accion(id) }) > 0;
}
