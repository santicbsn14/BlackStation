import { useQuery } from '@tanstack/react-query';
import { getAdminSettings } from '../../../services';
import { settingsKeys } from '../../../services/queryKeys';

/** Settings completos (horarios, plantillas, `pedidosHabilitados`). */
export function useAdminSettings() {
  return useQuery({
    queryKey: settingsKeys.admin(),
    queryFn: getAdminSettings,
  });
}
