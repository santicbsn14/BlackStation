import type { UpdateSettingsRequest } from '@blackstation/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getAdminOrders, updateSettings } from '../../../../services';
import { orderKeys, settingsKeys, slotKeys } from '../../../../services/queryKeys';
import { useToastError } from '../../hooks/useToastError';

/** `PUT /admin/settings` con el documento completo. Los 400 los muestra el formulario. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const onError = useToastError({ inline: true });
  return useMutation({
    mutationFn: (request: UpdateSettingsRequest) => updateSettings(request),
    onSuccess: (settings) => queryClient.setQueryData(settingsKeys.admin(), settings),
    onError,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      void queryClient.invalidateQueries({ queryKey: slotKeys.all });
    },
  });
}

/** Cuenta los pedidos activos (pendientes y confirmados) de la jornada actual, recién pedidos. */
export function useContarActivosHoy() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    const { orders } = await queryClient.fetchQuery({
      queryKey: orderKeys.jornadaActual(),
      queryFn: () => getAdminOrders(),
      staleTime: 0,
    });
    return orders.filter((o) => o.estado === 'pendiente' || o.estado === 'confirmado').length;
  }, [queryClient]);
}
