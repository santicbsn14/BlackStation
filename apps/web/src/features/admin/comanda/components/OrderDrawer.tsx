import { esEstadoFinal, formatearPrecio, type Order, type Settings } from '@blackstation/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { Drawer } from '../../../../components/Drawer';
import { Icon } from '../../../../components/Icon';
import { Skeleton } from '../../../../components/Skeleton';
import { Ticket } from '../../../../components/Ticket';
import { horaLocal } from '../../../../lib/hora';
import { formatearTelefono } from '../../../../lib/telefono';
import { ReputacionBadge } from '../../components/ReputacionBadge';
import { ETIQUETA_METODO, esTransferenciaPendiente } from '../comanda';
import { useAccionEnCurso } from '../hooks/useAccionPedido';
import { useCustomer } from '../hooks/useCustomer';
import { useReprintOrder } from '../hooks/useReprintOrder';
import { useUpdateOrderEstado } from '../hooks/useUpdateOrderEstado';
import { CancelarModal } from './CancelarModal';
import { EstadoFinal, Impresion, PlazoTransferencia, WhatsappLink } from './OrderEstado';
import './orderDrawer.css';

const ETIQUETA_ESTADO: Record<Order['estado'], string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

type OrderDrawerProps = {
  /** Sale de la comanda: se actualiza en vivo con el polling. */
  order: Order;
  settings: Settings | undefined;
  onClose: () => void;
};

/** Detalle del pedido (drawer derecho): ítems, cliente, ticket y todas las acciones. */
export function OrderDrawer({ order, settings, onClose }: OrderDrawerProps) {
  const cambiarEstado = useUpdateOrderEstado(order);
  const reimprimir = useReprintOrder(order);
  const enCurso = useAccionEnCurso(order._id);
  const [cancelando, setCancelando] = useState(false);
  const final = esEstadoFinal(order.estado);

  const footer = final ? undefined : (
    <div className="adm-detalle__footer">
      <Button variant="ghost" onClick={() => setCancelando(true)} disabled={enCurso}>
        Cancelar
      </Button>
      <Button
        variant="primary"
        disabled={enCurso}
        loading={cambiarEstado.isPending}
        onClick={() =>
          cambiarEstado.mutate({
            estado: order.estado === 'pendiente' ? 'confirmado' : 'entregado',
          })
        }
      >
        {order.estado === 'pendiente' ? 'Confirmar' : 'Entregar'}
      </Button>
    </div>
  );

  return (
    <Drawer side="right" title={`Pedido #${order.numero}`} onClose={onClose} footer={footer}>
      <div className="adm-detalle">
        <section className="adm-detalle__resumen" aria-label="Estado">
          <div className="adm-detalle__fila">
            <Badge estado={order.estado}>{ETIQUETA_ESTADO[order.estado]}</Badge>
            <Badge>{ETIQUETA_METODO[order.metodoPago]}</Badge>
          </div>
          <p className="adm-detalle__hora">
            Retira a las <strong className="u-tabular">{order.horaRetiro}</strong>
          </p>
          <p className="adm-detalle__meta">
            Entró a las <span className="u-tabular">{horaLocal(order.createdAt)}</span>
          </p>
          {esTransferenciaPendiente(order) && (
            <PlazoTransferencia order={order} settings={settings} />
          )}
          {order.estado === 'confirmado' && <Impresion order={order} />}
          <EstadoFinal order={order} />
        </section>

        {settings && !final && (
          <section className="adm-detalle__seccion" aria-labelledby="detalle-acciones">
            <h3 id="detalle-acciones" className="adm-detalle__titulo">
              Mensajes y acciones
            </h3>
            <div className="adm-detalle__acciones">
              {esTransferenciaPendiente(order) && (
                <WhatsappLink order={order} settings={settings} plantilla="pedirTransferencia">
                  Pedir transferencia
                </WhatsappLink>
              )}
              {order.estado === 'confirmado' && (
                <>
                  <WhatsappLink order={order} settings={settings} plantilla="confirmacion">
                    Confirmación
                  </WhatsappLink>
                  <WhatsappLink order={order} settings={settings} plantilla="recordatorio">
                    Recordatorio
                  </WhatsappLink>
                  <Button
                    onClick={() => reimprimir.mutate()}
                    disabled={enCurso}
                    loading={reimprimir.isPending}
                  >
                    <Icon name="printer" />
                    Reimprimir
                  </Button>
                </>
              )}
            </div>
          </section>
        )}

        <section className="adm-detalle__seccion" aria-labelledby="detalle-items">
          <h3 id="detalle-items" className="adm-detalle__titulo">
            Pedido
          </h3>
          <ul role="list" className="adm-detalle__items">
            {order.items.map((item, i) => (
              <li key={`${item.productoId}-${i}`} className="adm-detalle__item">
                <div className="adm-detalle__item-head">
                  <span>
                    <span className="u-tabular">{item.cantidad}×</span> {item.nombre}
                  </span>
                  <span className="u-tabular">{formatearPrecio(item.subtotal)}</span>
                </div>
                {(item.quitados.length > 0 || item.extras.length > 0) && (
                  <ul role="list" className="adm-detalle__item-detalle">
                    {item.quitados.map((q) => (
                      <li key={`sin-${q}`}>Sin {q}</li>
                    ))}
                    {item.extras.map((e) => (
                      <li key={e.extraId}>
                        + {e.nombre}
                        {e.cantidad > 1 && <span className="u-tabular"> ×{e.cantidad}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {order.aclaracion && (
            <p className="adm-detalle__aclaracion">
              <Icon name="message" />
              <span>
                <span className="u-visually-hidden">Aclaración: </span>
                {order.aclaracion}
              </span>
            </p>
          )}
          <p className="adm-detalle__total">
            <span>Total</span>
            <strong className="u-tabular">{formatearPrecio(order.total)}</strong>
          </p>
        </section>

        <ClienteSeccion order={order} />

        <section className="adm-detalle__seccion" aria-labelledby="detalle-ticket">
          <h3 id="detalle-ticket" className="adm-detalle__titulo">
            Ticket
          </h3>
          <Ticket order={order} className="adm-detalle__ticket" />
        </section>
      </div>

      {cancelando && !final && <CancelarModal order={order} onClose={() => setCancelando(false)} />}
    </Drawer>
  );
}

function ClienteSeccion({ order }: { order: Order }) {
  const { telefono, nombre } = order.cliente;
  const { data: customer, isPending } = useCustomer(telefono);

  return (
    <section className="adm-detalle__seccion" aria-labelledby="detalle-cliente">
      <h3 id="detalle-cliente" className="adm-detalle__titulo">
        Cliente
      </h3>
      <div className="adm-detalle__fila">
        <strong>{nombre}</strong>
        {customer && <ReputacionBadge estado={customer.estado} />}
      </div>
      <p className="u-tabular">{formatearTelefono(telefono)}</p>
      {isPending ? (
        <Skeleton className="adm-detalle__skeleton" />
      ) : (
        customer && (
          <dl className="adm-detalle__contadores">
            <div>
              <dt>Pedidos</dt>
              <dd className="u-tabular">{customer.pedidosTotal}</dd>
            </div>
            <div>
              <dt>Entregados</dt>
              <dd className="u-tabular">{customer.entregados}</dd>
            </div>
            <div>
              <dt>No retiró</dt>
              <dd className="u-tabular">{customer.noShows}</dd>
            </div>
          </dl>
        )
      )}
      <Link to={`/admin/clientes?q=${encodeURIComponent(telefono)}`}>Ver ficha del cliente</Link>
    </section>
  );
}
