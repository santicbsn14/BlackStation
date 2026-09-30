import { useCallback } from 'react';
import { useToast } from '../../../components/Toast';
import { ApiError } from '../../../services';

/**
 * Toast para errores de mutación del panel. El 401 no (ya redirige al login). Con `inline`, los
 * 400 tampoco: los muestra el formulario al lado del campo.
 */
export function useToastError({ inline = false }: { inline?: boolean } = {}) {
  const toast = useToast();
  return useCallback(
    (error: Error) => {
      if (error instanceof ApiError && error.status === 401) return;
      if (inline && error instanceof ApiError && error.status === 400) return;
      toast(error instanceof ApiError ? error.message : 'No pudimos guardar. Probá de nuevo.');
    },
    [toast, inline],
  );
}
