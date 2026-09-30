import type { Order, Settings } from '@blackstation/shared';
import { Badge } from '../../../../components/Badge';
import { Button, btnClass } from '../../../../components/Button';
import { Countdown } from '../../../../components/Countdown';
import { Icon } from '../../../../components/Icon';
import { useCountdown } from '../../../../hooks/useCountdown';
import { renderPlantilla } from '../../../../lib/mensajes';
import { waLink } from '../../../../lib/whatsapp';
import { ETIQUETA_MOTIVO, variablesPlantilla } from '../comanda';
import { useAccionEnCurso } from '../hooks/useAccionPedido';
import { useExtendOrder } from '../hooks/useExtendOrder';
import './orderEstado.css';

// Bloques de estado que comparten la card y el detalle.

const AVISO_MS = 5 * 60_000;
const URGENTE_MS = 2 * 60_000;

type Plantilla = keyof Settings['mensajes'];

type WhatsappLinkProps = {
  order: Order;
  settings: Settings;
  plantilla: Plantilla;
  children: string;
};

/** Botón `wa.me` al cliente con el texto de la plantilla de `settings.mensajes`. */
export function WhatsappLink({ order, settings, plantilla, children }: WhatsappLinkProps) {
  const texto = renderPlantilla(settings.mensajes[plantilla], variablesPlantilla(order, settings));
  return (
    <a
      className={btnClass('secondary')}
      href={waLink(order.cliente.telefono, texto)}
      target="_blank"
      rel="noreferrer"
      data-plantilla={plantilla}
    >
      <Icon name="whatsapp" />
      {children}
    </a>
  );
}

type PlazoTransferenciaProps = {
  order: Order;
  settings: Settings | undefined;
  /** En la card: botones chicos y el de WhatsApp incluido. */
  compacto?: boolean;
};

/** Pendiente de transferencia: countdown a `expiresAt`, "Extender plazo" y "Pedir transferencia". */
export function PlazoTransferencia({ order, settings, compacto = false }: PlazoTransferenciaProps) {
  const restante = useCountdown(order.expiresAt);
  const extender = useExtendOrder(order);
  const enCurso = useAccionEnCurso(order._id);

  return (
    <div className="adm-plazo">
      <p className="adm-plazo__texto">
        {restante === 0 ? (
          'Venciendo…'
        ) : (
          <>
            Vence en{' '}
            {restante !== null && (
              <Countdown ms={restante} avisoMs={AVISO_MS} urgenteMs={URGENTE_MS} />
            )}
          </>
        )}
      </p>
      <div className="adm-plazo__acciones">
        <Button
          variant="secondary"
          disabled={enCurso || restante === 0}
          loading={extender.isPending}
          onClick={() => extender.mutate()}
        >
          <Icon name="clock" />
          Extender plazo
        </Button>
        {compacto && settings && (
          <WhatsappLink order={order} settings={settings} plantilla="pedirTransferencia">
            Pedir transferencia
          </WhatsappLink>
        )}
      </div>
    </div>
  );
}

/** Confirmado: "En cola" hasta que el print server manda el `ack`, después "Impreso". */
export function Impresion({ order }: { order: Order }) {
  const impreso = order.impresoAt !== null;
  return (
    <p className="adm-impresion" data-impreso={impreso}>
      <Icon name="printer" />
      {impreso ? 'Impreso' : 'En cola'}
    </p>
  );
}

/** Entregado o cancelado (con el motivo en texto). Nada en los demás estados. */
export function EstadoFinal({ order }: { order: Order }) {
  if (order.estado === 'entregado') {
    return (
      <p className="adm-estado-final">
        <Badge estado="entregado">Entregado</Badge>
      </p>
    );
  }
  if (order.estado !== 'cancelado') return null;
  return (
    <p className="adm-estado-final">
      <Badge estado="cancelado">Cancelado</Badge>
      {order.motivoCancelacion && (
        <span className="adm-estado-final__motivo">{ETIQUETA_MOTIVO[order.motivoCancelacion]}</span>
      )}
    </p>
  );
}
