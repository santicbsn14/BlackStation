import { esEstadoFinal, type PublicOrder } from '@blackstation/shared';
import { useEffect, useState } from 'react';
import { ApiError } from '../../../../services';
import { useOrder } from '../../hooks/useOrder';
import { borrarPedidoActivo, leerPedidoActivo } from '../../storage';

/**
 * Pedido guardado en `bs-pedido-activo` mientras no esté en un estado final.
 * Si llegó a uno (o ya no existe), borra la key.
 */
export function usePedidoActivo(): PublicOrder | null {
  const [codigo] = useState(() => leerPedidoActivo()?.codigo ?? null);
  const { data, error } = useOrder(codigo);

  const final = data ? esEstadoFinal(data.estado) : false;
  const noExiste = error instanceof ApiError && error.status === 404;

  useEffect(() => {
    if (codigo && (final || noExiste)) borrarPedidoActivo(codigo);
  }, [codigo, final, noExiste]);

  return data && !final ? data : null;
}
