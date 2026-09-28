import { formatearPrecio } from '@blackstation/shared';
import { Icon } from '../../../../components/Icon';
import type { LineaVista } from '../../carrito/cart';
import { ItemDetalle } from '../../components/ItemDetalle';
import './resumenPedido.css';

type ResumenPedidoProps = {
  lineas: LineaVista[];
  total: number;
};

/** "N productos · $total", colapsable, con las líneas en modo lectura. */
export function ResumenPedido({ lineas, total }: ResumenPedidoProps) {
  const unidades = lineas.reduce((acc, l) => acc + l.linea.cantidad, 0);

  return (
    <details className="pub-resumen">
      <summary className="pub-resumen__summary">
        <span>
          <span className="u-tabular">{unidades}</span> {unidades === 1 ? 'producto' : 'productos'}{' '}
          · <strong className="u-tabular">{formatearPrecio(total)}</strong>
        </span>
        <Icon name="chevron" />
      </summary>
      <ul role="list" className="pub-resumen__lineas">
        {lineas.map((l) => (
          <li key={l.key} className="pub-resumen__linea">
            <div className="pub-resumen__linea-head">
              <span>
                <span className="u-tabular">{l.linea.cantidad}×</span> {l.nombre}
              </span>
              <span className="u-tabular">{formatearPrecio(l.subtotal)}</span>
            </div>
            <ItemDetalle quitados={l.quitados} extras={l.extras} />
          </li>
        ))}
      </ul>
    </details>
  );
}
