import { Link } from 'react-router';
import isotipoUrl from '../../../assets/brand/isotipo.svg';
import { Icon } from '../../../components/Icon';
import { useCart } from '../carrito/hooks/useCart';
import './publicHeader.css';

export function PublicHeader() {
  const { unidades, pulso, abrirDrawer } = useCart();

  return (
    <header className="pub-header">
      <div className="l-container pub-header__inner">
        <Link to="/" className="pub-header__brand" aria-label="Black Station, ir al menú">
          <img className="pub-header__isotipo" src={isotipoUrl} alt="" />
          <span className="pub-header__nombre" aria-hidden="true">
            Black Station
          </span>
        </Link>
        <button
          type="button"
          className="pub-header__carrito"
          onClick={abrirDrawer}
          aria-label={`Ver tu pedido (${unidades} ${unidades === 1 ? 'producto' : 'productos'})`}
        >
          <Icon name="cart" />
          {unidades > 0 && (
            <span
              key={pulso}
              className={`pub-header__contador u-tabular${pulso > 0 ? ' is-pulse' : ''}`}
            >
              {unidades}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
