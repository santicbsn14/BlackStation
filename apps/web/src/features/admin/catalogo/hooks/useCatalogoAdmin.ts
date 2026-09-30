import { useQuery } from '@tanstack/react-query';
import { getAdminCategories, getAdminExtras, getAdminProducts } from '../../../../services';
import { catalogKeys } from '../../../../services/queryKeys';

// Listas completas del ABM (incluyen inactivos, §8.2).

export function useAdminCategories() {
  return useQuery({ queryKey: catalogKeys.categories(), queryFn: getAdminCategories });
}

export function useAdminProducts() {
  return useQuery({ queryKey: catalogKeys.products(), queryFn: getAdminProducts });
}

export function useAdminExtras() {
  return useQuery({ queryKey: catalogKeys.extras(), queryFn: getAdminExtras });
}
