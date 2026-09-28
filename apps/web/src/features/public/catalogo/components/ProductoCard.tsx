import { formatearPrecio, type CatalogProduct } from '@blackstation/shared';
import isotipoUrl from '../../../../assets/brand/isotipo.svg';
import { Badge } from '../../../../components/Badge';
import { Card } from '../../../../components/Card';
import { Icon } from '../../../../components/Icon';
import { useToast } from '../../../../components/Toast';
import { useCart } from '../../carrito/hooks/useCart';
import { useProductoSheet } from '../../hooks/useProductoSheet';
import './productoCard.css';

export function ProductoCard({ producto }: { producto: CatalogProduct }) {
  const toast = useToast();
  const sheet = useProductoSheet();
  const { agregar } = useCart();
  const personalizable = producto.ingredientesQuitables.length > 0 || producto.extras.length > 0;

  function sumar() {
    if (personalizable) {
      sheet.abrir(producto._id);
      return;
    }
    agregar({ productoId: producto._id, cantidad: 1, quitados: [], extras: [] });
    toast('Agregado al carrito');
  }

  return (
    <Card as="li" className="pub-producto-card" data-agotado={!producto.disponible || undefined}>
      <div className="pub-producto-card__texto">
        <h3 className="pub-producto-card__nombre">
          {producto.disponible ? (
            <button
              type="button"
              className="pub-producto-card__abrir"
              onClick={() => sheet.abrir(producto._id)}
            >
              {producto.nombre}
            </button>
          ) : (
            producto.nombre
          )}
        </h3>
        {producto.descripcion && (
          <p className="pub-producto-card__descripcion">{producto.descripcion}</p>
        )}
        <p className="pub-producto-card__precio u-tabular">{formatearPrecio(producto.precio)}</p>
      </div>
      <div className="pub-producto-card__media">
        {producto.fotoUrl ? (
          <img className="pub-producto-card__foto" src={producto.fotoUrl} alt="" loading="lazy" />
        ) : (
          <div className="pub-producto-card__foto pub-producto-card__foto--vacia">
            <img src={isotipoUrl} alt="" />
          </div>
        )}
        {producto.disponible ? (
          <button
            type="button"
            className="pub-producto-card__sumar"
            onClick={sumar}
            aria-label={`Agregar ${producto.nombre}`}
          >
            <Icon name="plus" />
          </button>
        ) : (
          <Badge className="pub-producto-card__agotado">Agotado</Badge>
        )}
      </div>
    </Card>
  );
}
