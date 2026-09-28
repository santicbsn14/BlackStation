import { Link } from 'react-router';
import { usePedidoActivo } from '../hooks/usePedidoActivo';
import './pedidoEnCursoBanner.css';

export function PedidoEnCursoBanner() {
  const pedido = usePedidoActivo();
  if (!pedido) return null;

  return (
    <Link to={`/pedido/${pedido.codigo}`} className="pub-en-curso">
      <span>
        Tenés un pedido en curso · <span className="u-tabular">#{pedido.numero}</span>
      </span>
      <span className="pub-en-curso__ver">Ver</span>
    </Link>
  );
}
