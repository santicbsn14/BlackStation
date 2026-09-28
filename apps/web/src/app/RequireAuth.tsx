import { Navigate, Outlet, useLocation } from 'react-router';
import { getSession } from '../lib/session';

/** Sin sesión o con el token vencido → `/admin/login`, recordando a dónde se quería ir. */
export function RequireAuth() {
  const location = useLocation();
  if (!getSession()) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
