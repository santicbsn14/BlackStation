import { useQuery } from '@tanstack/react-query';
import { getCustomers } from '../../../../services';
import { customerKeys } from '../../../../services/queryKeys';

/** Customer del pedido (contadores y reputación), buscado por teléfono. `null` si no existe. */
export function useCustomer(telefono: string) {
  return useQuery({
    queryKey: customerKeys.list(telefono),
    queryFn: () => getCustomers({ q: telefono }),
    select: (res) => res.customers.find((c) => c.telefono === telefono) ?? null,
  });
}
