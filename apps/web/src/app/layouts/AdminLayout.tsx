import { NavLink, Outlet } from 'react-router';
import isotipoUrl from '../../assets/brand/isotipo.svg';
import { useLogout } from '../../features/admin/hooks/useLogout';
import './adminLayout.css';

const SECCIONES = [
  { to: '/admin', label: 'Comanda', end: true },
  { to: '/admin/catalogo', label: 'Catálogo', end: false },
  { to: '/admin/franjas', label: 'Franjas', end: false },
  { to: '/admin/clientes', label: 'Clientes', end: false },
  { to: '/admin/ajustes', label: 'Ajustes', end: false },
] as const;

export function AdminLayout() {
  const logout = useLogout();

  return (
    <div className="adm-shell">
      <header className="adm-shell__header">
        <img className="adm-shell__isotipo" src={isotipoUrl} alt="Black Station" />
        <nav aria-label="Secciones del panel">
          <ul role="list" className="l-cluster">
            {SECCIONES.map(({ to, label, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) => `adm-shell__link${isActive ? ' is-active' : ''}`}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" className="adm-shell__logout" onClick={logout}>
          Salir
        </button>
      </header>
      <main className="adm-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
