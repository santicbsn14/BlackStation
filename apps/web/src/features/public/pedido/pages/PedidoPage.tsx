import {
  esEstadoFinal,
  formatearPrecio,
  type EstadoPedido,
  type PublicOrder,
  type PublicSettings,
} from '@blackstation/shared';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Badge } from '../../../../components/Badge';
import { Button, btnClass } from '../../../../components/Button';
import { Skeleton } from '../../../../components/Skeleton';
import { useToast } from '../../../../components/Toast';
import { useCountdown } from '../../../../hooks/useCountdown';
import { waLink } from '../../../../lib/whatsapp';
import { ApiError } from '../../../../services';
import { ItemDetalle } from '../../components/ItemDetalle';
import { useOrder } from '../../hooks/useOrder';
import { usePublicSettings } from '../../hooks/usePublicSettings';
import { borrarPedidoActivo } from '../../storage';
import { CancelarSheet } from '../components/CancelarSheet';
import { TransferenciaPasos } from '../components/TransferenciaPasos';
import { useCancelOrder } from '../hooks/useCancelOrder';
import './pedidoPage.css';

const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export function PedidoPage() {
  const { codigo = '' } = useParams();
  const { data: order, error, isPending, isError, refetch } = useOrder(codigo);
  const settings = usePublicSettings();
  const cancelar = useCancelOrder(codigo);
  const toast = useToast();
  const [cancelarAbierto, setCancelarAbierto] = useState(false);
  const restante = useCountdown(
    order?.estado === 'pendiente' && order.metodoPago === 'transferencia' ? order.expiresAt : null,
  );

  const final = order ? esEstadoFinal(order.estado) : false;
  useEffect(() => {
    if (final) borrarPedidoActivo(codigo);
  }, [final, codigo]);

  // Al vencer el plazo, leer enseguida en vez de esperar al próximo polling.
  const vencido = restante === 0;
  useEffect(() => {
    if (vencido) void refetch();
  }, [vencido, refetch]);

  function confirmarCancelacion() {
    cancelar.mutate(undefined, {
      onSuccess: () => setCancelarAbierto(false),
      onError: (err) => {
        if (!(err instanceof ApiError) || err.code !== 'INVALID_TRANSITION') {
          toast('No pudimos cancelar tu pedido. Probá de nuevo.');
          return;
        }
        // El pedido cambió en el medio (lo confirmaron o venció): mostrar el estado actual.
        setCancelarAbierto(false);
        void refetch().then(({ data }) => {
          toast(
            data?.estado === 'confirmado'
              ? 'Tu pedido ya fue confirmado. Si necesitás cambiarlo, escribinos por WhatsApp.'
              : 'Tu pedido ya no se puede cancelar.',
          );
        });
      },
    });
  }

  if (isPending) return <PedidoSkeleton />;

  if (!order) {
    const noExiste = error instanceof ApiError && error.status === 404;
    return (
      <section className="pub-pedido__mensaje l-stack" role="alert">
        <h1>{noExiste ? 'No encontramos ese pedido' : 'No pudimos cargar tu pedido'}</h1>
        {noExiste ? (
          <Link to="/" className={btnClass('primary')}>
            Ver el menú
          </Link>
        ) : (
          <button type="button" className={btnClass('primary')} onClick={() => void refetch()}>
            Reintentar
          </button>
        )}
      </section>
    );
  }

  return (
    <article className="pub-pedido">
      {isError && (
        <p className="pub-pedido__offline" role="status">
          Sin conexión, reintentando…
        </p>
      )}

      <header className="pub-pedido__cabecera">
        <Badge estado={order.estado}>{ETIQUETA_ESTADO[order.estado]}</Badge>
        <h1 className="pub-pedido__numero">
          Pedido <span className="u-tabular">#{order.numero}</span>
        </h1>
        <p className="pub-pedido__hora">
          Retirás a las <span className="u-tabular">{order.horaRetiro}</span>
        </p>
      </header>

      <EstadoBloque order={order} settings={settings.data} restante={restante} />

      {order.estado === 'pendiente' && (
        <Button className="pub-pedido__cancelar" onClick={() => setCancelarAbierto(true)}>
          Cancelar pedido
        </Button>
      )}
      {cancelarAbierto && order.estado === 'pendiente' && (
        <CancelarSheet
          numero={order.numero}
          telefonoLocal={settings.data?.telefonoLocal}
          cancelando={cancelar.isPending}
          onVolver={() => setCancelarAbierto(false)}
          onCancelar={confirmarCancelacion}
        />
      )}

      <section className="pub-pedido__detalle" aria-labelledby="pedido-detalle-titulo">
        <h2 id="pedido-detalle-titulo">Detalle</h2>
        <ul role="list" className="pub-pedido__items">
          {order.items.map((item, i) => (
            <li key={`${item.productoId}-${i}`} className="pub-pedido__item">
              <div className="pub-pedido__item-head">
                <span>
                  <span className="u-tabular">{item.cantidad}×</span> {item.nombre}
                </span>
                <span className="u-tabular">{formatearPrecio(item.subtotal)}</span>
              </div>
              <ItemDetalle quitados={item.quitados} extras={item.extras} />
            </li>
          ))}
        </ul>
        {order.aclaracion && (
          <p className="pub-pedido__aclaracion">
            <span>Aclaración:</span> {order.aclaracion}
          </p>
        )}
        <p className="pub-pedido__total">
          <span>Total</span>
          <strong className="u-tabular">{formatearPrecio(order.total)}</strong>
        </p>
      </section>
    </article>
  );
}

type EstadoBloqueProps = {
  order: PublicOrder;
  settings: PublicSettings | undefined;
  restante: number | null;
};

function EstadoBloque({ order, settings, restante }: EstadoBloqueProps) {
  switch (order.estado) {
    case 'pendiente':
      if (order.metodoPago === 'transferencia') {
        return settings ? (
          <TransferenciaPasos order={order} settings={settings} restante={restante} />
        ) : (
          <Skeleton className="pub-pedido__skeleton-bloque" />
        );
      }
      return (
        <p className="pub-pedido__estado">Recibimos tu pedido. Te confirmamos por WhatsApp.</p>
      );
    case 'confirmado':
      return (
        <p className="pub-pedido__estado">
          ¡Confirmado! Te esperamos a las <span className="u-tabular">{order.horaRetiro}</span>.
        </p>
      );
    case 'entregado':
      return <p className="pub-pedido__estado">¡Gracias! Pedido entregado.</p>;
    case 'cancelado':
      if (order.motivoCancelacion === 'cliente') {
        return (
          <div className="pub-pedido__estado l-stack">
            <p>Cancelaste tu pedido.</p>
            <Link to="/" className={btnClass('primary')}>
              Hacer un nuevo pedido
            </Link>
          </div>
        );
      }
      if (order.motivoCancelacion === 'vencido') {
        return (
          <div className="pub-pedido__estado l-stack">
            <p>Se canceló porque no recibimos el comprobante a tiempo.</p>
            <Link to="/" className={btnClass('primary')}>
              Hacer un nuevo pedido
            </Link>
          </div>
        );
      }
      return (
        <div className="pub-pedido__estado l-stack">
          <p>Tu pedido fue cancelado. Cualquier duda, escribinos.</p>
          {settings && (
            <a
              className={btnClass('secondary')}
              href={waLink(settings.telefonoLocal)}
              target="_blank"
              rel="noreferrer"
            >
              Escribir por WhatsApp
            </a>
          )}
        </div>
      );
  }
}

function PedidoSkeleton() {
  return (
    <div className="pub-pedido" aria-busy="true" aria-label="Cargando el pedido">
      <Skeleton className="pub-pedido__skeleton-titulo" />
      <Skeleton className="pub-pedido__skeleton-bloque" />
      <Skeleton className="pub-pedido__skeleton-bloque" />
    </div>
  );
}
