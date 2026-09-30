import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { clearSession, loginPath } from '../../../lib/session';

/** Cierra la sesión y va al login. Con `next`, el login vuelve ahí después de ingresar. */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useCallback(
    (next?: string) => {
      clearSession();
      queryClient.clear();
      void navigate(loginPath(next), { replace: true });
    },
    [queryClient, navigate],
  );
}
