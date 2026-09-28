import { useQuery } from '@tanstack/react-query';
import { getPublicSettings } from '../../../services';
import { settingsKeys } from '../../../services/queryKeys';

export function usePublicSettings() {
  return useQuery({ queryKey: settingsKeys.public(), queryFn: getPublicSettings });
}
