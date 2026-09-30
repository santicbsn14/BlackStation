import type { Settings, UpdateSettingsRequest } from '@blackstation/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../../components/Toast';
import { updateSettings } from '../../../../services';
import { settingsKeys, slotKeys } from '../../../../services/queryKeys';

/** Switch "Tomar pedidos": `PUT /admin/settings` con el documento completo y otro `pedidosHabilitados`. */
export function useTogglePedidos() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ settings, habilitados }: { settings: Settings; habilitados: boolean }) => {
      // PUT con el documento completo, sin `_id` ni `updatedAt` (§8.4).
      const request: UpdateSettingsRequest = {
        horarios: settings.horarios,
        intervaloMin: settings.intervaloMin,
        cupoMaxDefault: settings.cupoMaxDefault,
        anticipacionMinMin: settings.anticipacionMinMin,
        pedidosHabilitados: habilitados,
        minutosTransferencia: settings.minutosTransferencia,
        alias: settings.alias,
        cbu: settings.cbu,
        titular: settings.titular,
        telefonoLocal: settings.telefonoLocal,
        mensajes: settings.mensajes,
        ...(settings.reputacion ? { reputacion: settings.reputacion } : {}),
      };
      return updateSettings(request);
    },
    onSuccess: (settings) => queryClient.setQueryData(settingsKeys.admin(), settings),
    onError: () => toast('No pudimos cambiar "Tomar pedidos". Probá de nuevo.'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      void queryClient.invalidateQueries({ queryKey: slotKeys.all });
    },
  });
}
