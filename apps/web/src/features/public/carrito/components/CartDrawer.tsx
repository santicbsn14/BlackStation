import { formatearPrecio } from '@blackstation/shared';
import { useNavigate } from 'react-router';
import { Button } from '../../../../components/Button';
import { Drawer } from '../../../../components/Drawer';
import { Skeleton } from '../../../../components/Skeleton';
import { Stepper } from '../../../../components/Stepper';
import { ItemDetalle } from '../../components/ItemDetalle';
import { useProductoSheet } from '../../hooks/useProductoSheet';
import { useCart, useCartView } from '../hooks/useCart';
import './cartDrawer.css';

export function CartDrawer() {
  const { drawerAbierto, cerrarDrawer } = useCart();
  if (!drawerAbierto) return null;
  return <CartDrawerAbierto onClose={cerrarDrawer} />;
}

function CartDrawerAbierto({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const sheet = useProductoSheet();
  const { setCantidad, quitar, notas, revalidar } = useCart();
  const { lineas, total, noDisponibles, catalogCargando, catalogError } = useCartView();

  const vacio = lineas.length === 0;
  const bloqueado = noDisponibles.length > 0;

  function continuar() {
    onClose();
    void navigate('/checkout');
  }

  function verMenu() {
    onClose();
    void navigate('/');
  }

  const footer = vacio ? undefined : (
    <div className="l-stack l-stack--sm">
      {bloqueado && (
        <div className="pub-carrito__aviso" role="alert">
          <p>Hay productos que ya no están disponibles</p>
          <Button onClick={() => quitar(noDisponibles)}>Quitarlos</Button>
        </div>
      )}
      <div className="pub-carrito__total">
        <span>Total</span>
        <strong className="u-tabular">{formatearPrecio(total)}</strong>
      </div>
      <Button
        variant="primary"
        block
        onClick={continuar}
        disabled={bloqueado || catalogCargando || catalogError}
      >
        Continuar
      </Button>
    </div>
  );

  return (
    <Drawer side="right" title="Tu pedido" onClose={onClose} footer={footer}>
      {vacio ? (
        <div className="pub-carrito__vacio l-stack">
          <p>Tu pedido está vacío</p>
          <Button variant="primary" onClick={verMenu}>
            Ver el menú
          </Button>
        </div>
      ) : catalogCargando ? (
        <div className="l-stack">
          {lineas.map((l) => (
            <Skeleton key={l.key} className="pub-carrito__skeleton" />
          ))}
        </div>
      ) : (
        <>
          {catalogError && (
            <div className="pub-carrito__aviso" role="alert">
              <p>No pudimos actualizar los precios.</p>
              <Button onClick={() => void revalidar()}>Reintentar</Button>
            </div>
          )}
          <ul role="list" className="pub-carrito__lineas">
            {lineas.map((l) => (
              <li key={l.key} className={`pub-carrito__linea${l.disponible ? '' : ' is-disabled'}`}>
                <div className="pub-carrito__linea-head">
                  <p className="pub-carrito__nombre">
                    <span className="u-tabular">{l.linea.cantidad}×</span> {l.nombre}
                  </p>
                  <p className="pub-carrito__subtotal u-tabular">
                    {l.disponible ? formatearPrecio(l.subtotal) : '—'}
                  </p>
                </div>
                {l.disponible ? (
                  <ItemDetalle quitados={l.quitados} extras={l.extras} />
                ) : (
                  <p className="pub-carrito__no-disponible">Ya no está disponible</p>
                )}
                {notas[l.key]?.map((nota) => (
                  <p key={nota} className="pub-carrito__nota">
                    {nota}
                  </p>
                ))}
                <div className="pub-carrito__acciones">
                  {l.disponible ? (
                    <>
                      <Stepper
                        label={`Cantidad de ${l.nombre}`}
                        value={l.linea.cantidad}
                        min={1}
                        onChange={(n) => setCantidad(l.index, n)}
                        onRemove={() => quitar([l.index])}
                      />
                      <Button
                        variant="ghost"
                        onClick={() => sheet.abrir(l.linea.productoId, l.index)}
                      >
                        Editar
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" onClick={() => quitar([l.index])}>
                      Quitar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Drawer>
  );
}
