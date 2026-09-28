import { useQuery } from '@tanstack/react-query';
import { getCatalog } from '../../../services';
import { catalogKeys } from '../../../services/queryKeys';

export function useCatalog() {
  return useQuery({ queryKey: catalogKeys.public(), queryFn: getCatalog });
}
