import { Navigate, Outlet, useLocation } from 'react-router';
import { getSession, loginPath } from '../lib/session';

/** Sin sesión o con el token vencido (se borra) → `/admin/login?next=<ruta pedida>`. */
export function RequireAuth() {
  const { pathname, search } = useLocation();
  if (!getSession()) return <Navigate to={loginPath(pathname + search)} replace />;
  return <Outlet />;
}
