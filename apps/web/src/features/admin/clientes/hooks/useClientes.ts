import type { AdminCustomersResponse, UpdateCustomerRequest } from '@blackstation/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCustomers, updateCustomer } from '../../../../services';
import { customerKeys } from '../../../../services/queryKeys';
import { useToastError } from '../../hooks/useToastError';

/** Clientes por `ultimoPedidoAt` desc (§8.5). `q` vacío: los 50 más recientes. */
export function useClientes(q: string) {
  return useQuery({
    queryKey: customerKeys.list(q),
    queryFn: () => getCustomers(q ? { q } : {}),
    // Mientras escribe, la tabla sigue mostrando el resultado anterior.
    placeholderData: keepPreviousData,
  });
}

/** Cambiar `estado` (marca `estadoManual`) o `estadoManual` (§8.5). */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ telefono, request }: { telefono: string; request: UpdateCustomerRequest }) =>
      updateCustomer(telefono, request),
    // La ficha y la tabla muestran el cambio enseguida, sin esperar el refetch.
    onSuccess: (actualizado) =>
      queryClient.setQueriesData<AdminCustomersResponse>(
        { queryKey: customerKeys.all },
        (prev) =>
          prev && {
            customers: prev.customers.map((c) => (c._id === actualizado._id ? actualizado : c)),
          },
      ),
    onError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });
}
