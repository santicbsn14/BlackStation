import { useEffect } from 'react';
import { useToast } from '../../../components/Toast';
import { getSession } from '../../../lib/session';
import { useLogout } from './useLogout';

/**
 * Cierra la sesión cuando vence el token (12 h, sin refresh) con el toast "Tu sesión venció".
 * Además del timer, revisa al volver a la pestaña: con la notebook suspendida el timer se atrasa.
 */
export function useSessionTimeout() {
  const logout = useLogout();
  const toast = useToast();

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    const expiresAt = Date.parse(session.expiresAt);

    function vencer() {
      const { pathname, search } = window.location;
      logout(pathname + search);
      toast('Tu sesión venció');
    }
    function revisar() {
      if (document.visibilityState === 'visible' && Date.now() >= expiresAt) vencer();
    }

    const timer = setTimeout(vencer, Math.max(0, expiresAt - Date.now()));
    document.addEventListener('visibilitychange', revisar);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', revisar);
    };
  }, [logout, toast]);
}
