import { useQuery } from '@tanstack/react-query';
import { getSlots } from '../../../services';
import { slotKeys } from '../../../services/queryKeys';

const REFRESCO_MS = 60_000;

export function useSlots() {
  return useQuery({ queryKey: slotKeys.public(), queryFn: getSlots, refetchInterval: REFRESCO_MS });
}
