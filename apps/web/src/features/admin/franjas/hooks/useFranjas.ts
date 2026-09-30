import type { UpdateSlotRequest } from '@blackstation/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminSlots, updateSlot } from '../../../../services';
import { slotKeys } from '../../../../services/queryKeys';
import { useToastError } from '../../hooks/useToastError';

const POLLING_MS = 10_000;

/** Franjas de la jornada actual (§8.3), con polling de 10 s para ver los cupos moverse. */
export function useAdminSlots() {
  return useQuery({
    queryKey: slotKeys.admin(),
    queryFn: () => getAdminSlots(),
    refetchInterval: POLLING_MS,
  });
}

/** `PATCH /admin/slots`: cupo o cierre de una franja. Invalida también las franjas públicas. */
export function useUpdateSlot() {
  const queryClient = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (request: UpdateSlotRequest) => updateSlot(request),
    onError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: slotKeys.all }),
  });
}
