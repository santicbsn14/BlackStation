import { formatearPrecio, type Order, type Settings } from '@blackstation/shared';
import type { MouseEvent } from 'react';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { Icon } from '../../../../components/Icon';
import { ETIQUETA_METODO, esTransferenciaPendiente, resumirItem } from '../comanda';
import { useAccionEnCurso } from '../hooks/useAccionPedido';
import { useUpdateOrderEstado } from '../hooks/useUpdateOrderEstado';
import { EstadoFinal, Impresion, PlazoTransferencia } from './OrderEstado';
import './orderCard.css';

/** Ítems que entran en la card; el resto va como "+N más". */
const MAX_ITEMS = 3;

type OrderCardProps = {
  order: Order;
  settings: Settings | undefined;
  /** Llegó en el último polling y nadie lo tocó: pulso. */
  nuevo: boolean;
  onAbrir: (id: string) => void;
  onVisto: (id: string) => void;
};

export function OrderCard({ order, settings, nuevo, onAbrir, onVisto }: OrderCardProps) {
  const cambiarEstado = useUpdateOrderEstado(order);
  const enCurso = useAccionEnCurso(order._id);
  const visibles = order.items.slice(0, MAX_ITEMS);
  const ocultos = order.items.length - visibles.length;

  // Tocar la card (fuera de sus botones y links) abre el detalle.
  function onClick(event: MouseEvent<HTMLElement>) {
    if (event.target instanceof Element && event.target.closest('a, button')) return;
    onAbrir(order._id);
  }

  return (
    <article
      className={['adm-order', nuevo && 'is-nuevo'].filter(Boolean).join(' ')}
      data-estado={order.estado}
      onClick={onClick}
      onPointerDown={() => onVisto(order._id)}
    >
      <header className="adm-order__head">
        <button
          type="button"
          className="adm-order__numero u-tabular"
          onClick={() => onAbrir(order._id)}
          aria-label={`Ver pedido #${order.numero}`}
        >
          #{order.numero}
        </button>
        {nuevo && <span className="adm-order__nuevo">Nuevo</span>}
        <span className="adm-order__hora u-tabular" title="Hora de retiro">
          {order.horaRetiro}
        </span>
      </header>

      <div className="adm-order__cliente">
        <span className="adm-order__nombre">{order.cliente.nombre}</span>
        <Badge className="adm-order__metodo" data-metodo={order.metodoPago}>
          {ETIQUETA_METODO[order.metodoPago]}
        </Badge>
        <span className="adm-order__total u-tabular">{formatearPrecio(order.total)}</span>
      </div>

      <ul role="list" className="adm-order__items">
        {visibles.map((item, i) => (
          <li key={`${item.productoId}-${i}`}>{resumirItem(item)}</li>
        ))}
        {ocultos > 0 && <li className="adm-order__mas">+{ocultos} más</li>}
      </ul>

      {order.aclaracion && (
        <p className="adm-order__aclaracion" title={order.aclaracion}>
          <Icon name="message" />
          <span className="u-visually-hidden">Aclaración: </span>
          <span className="adm-order__aclaracion-texto">{order.aclaracion}</span>
        </p>
      )}

      {esTransferenciaPendiente(order) && (
        <PlazoTransferencia order={order} settings={settings} compacto />
      )}
      {order.estado === 'confirmado' && <Impresion order={order} />}
      <EstadoFinal order={order} />

      {order.estado === 'pendiente' && (
        <Button
          variant="primary"
          block
          disabled={enCurso}
          loading={cambiarEstado.isPending}
          onClick={() => cambiarEstado.mutate({ estado: 'confirmado' })}
        >
          <Icon name="check" />
          Confirmar
        </Button>
      )}
      {order.estado === 'confirmado' && (
        <Button
          variant="primary"
          block
          disabled={enCurso}
          loading={cambiarEstado.isPending}
          onClick={() => cambiarEstado.mutate({ estado: 'entregado' })}
        >
          Entregar
        </Button>
      )}
    </article>
  );
}
