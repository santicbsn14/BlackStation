import { NavLink, Outlet, useNavigation } from 'react-router';
import isotipoUrl from '../../assets/brand/isotipo.svg';
import { Icon, type IconName } from '../../components/Icon';
import { Skeleton } from '../../components/Skeleton';
import { useLogout } from '../../features/admin/hooks/useLogout';
import { usePendientesCount } from '../../features/admin/hooks/usePendientesCount';
import { useSessionTimeout } from '../../features/admin/hooks/useSessionTimeout';
import { useSimulador } from '../../features/admin/hooks/useSimulador';
import './adminLayout.css';

type Seccion = { to: string; label: string; icon: IconName; end: boolean };

const SECCIONES: readonly Seccion[] = [
  { to: '/admin', label: 'Comanda', icon: 'comanda', end: true },
  { to: '/admin/catalogo', label: 'Catálogo', icon: 'catalogo', end: false },
  { to: '/admin/franjas', label: 'Franjas', icon: 'clock', end: false },
  { to: '/admin/clientes', label: 'Clientes', icon: 'users', end: false },
  { to: '/admin/ajustes', label: 'Ajustes', icon: 'sliders', end: false },
];

export function AdminLayout() {
  const logout = useLogout();
  const pendientes = usePendientesCount();
  const navigation = useNavigation();
  useSessionTimeout();
  useSimulador();

  // Mientras baja el chunk de la pantalla (lazy), Skeleton en lugar de la pantalla anterior.
  const cargando =
    navigation.state === 'loading' && navigation.location.pathname.startsWith('/admin');

  return (
    <div className="adm-shell">
      <aside className="adm-shell__sidebar">
        <img className="adm-shell__isotipo" src={isotipoUrl} alt="Black Station" />
        <nav aria-label="Secciones del panel">
          <ul role="list" className="adm-shell__nav">
            {SECCIONES.map(({ to, label, icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  title={label}
                  className={({ isActive }) => `adm-shell__link${isActive ? ' is-active' : ''}`}
                >
                  <Icon name={icon} />
                  <span className="adm-shell__label">{label}</span>
                  {to === '/admin' && pendientes > 0 && (
                    <span className="adm-shell__count u-tabular">
                      {pendientes}
                      <span className="u-visually-hidden">
                        {pendientes === 1 ? ' pendiente' : ' pendientes'}
                      </span>
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          className="adm-shell__link adm-shell__logout"
          title="Salir"
          onClick={() => logout()}
        >
          <Icon name="logout" />
          <span className="adm-shell__label">Salir</span>
        </button>
      </aside>
      <main className="adm-shell__main" aria-busy={cargando || undefined}>
        {cargando ? (
          <div className="adm-shell__skeleton">
            <Skeleton className="adm-shell__skeleton-title" />
            <Skeleton className="adm-shell__skeleton-block" />
            <Skeleton className="adm-shell__skeleton-block" />
            <Skeleton className="adm-shell__skeleton-block" />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
