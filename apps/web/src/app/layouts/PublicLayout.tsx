import { Link, Outlet } from 'react-router';
import isotipoUrl from '../../assets/brand/isotipo.svg';
import logoUrl from '../../assets/brand/logo.svg';
import './publicLayout.css';

export function PublicLayout() {
  return (
    <>
      <header className="pub-header">
        <div className="l-container pub-header__inner">
          <Link to="/" className="pub-header__brand" aria-label="Black Station, ir al catálogo">
            <img className="pub-header__isotipo" src={isotipoUrl} alt="" />
            <img className="pub-header__logo" src={logoUrl} alt="" />
          </Link>
        </div>
      </header>
      <main className="l-container pub-main">
        <Outlet />
      </main>
    </>
  );
}
