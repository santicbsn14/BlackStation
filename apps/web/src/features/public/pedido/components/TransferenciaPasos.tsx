import { formatearPrecio, type PublicOrder, type PublicSettings } from '@blackstation/shared';
import { btnClass } from '../../../../components/Button';
import { Countdown } from '../../../../components/Countdown';
import { Icon } from '../../../../components/Icon';
import { useToast } from '../../../../components/Toast';
import { mensajeComprobante } from '../../../../lib/mensajes';
import { waLink } from '../../../../lib/whatsapp';
import './transferenciaPasos.css';

type TransferenciaPasosProps = {
  order: PublicOrder;
  settings: PublicSettings;
  /** Milisegundos hasta `expiresAt` (de `useCountdown`). */
  restante: number | null;
};

/** `pendiente` + transferencia: datos para transferir, countdown y "Enviar comprobante". */
export function TransferenciaPasos({ order, settings, restante }: TransferenciaPasosProps) {
  const toast = useToast();
  const total = formatearPrecio(order.total);
  const datos = [
    { label: 'Alias', valor: settings.alias },
    { label: 'CBU', valor: settings.cbu },
    { label: 'Titular', valor: settings.titular },
    { label: 'Total', valor: total },
  ];
  const texto = mensajeComprobante({ numero: order.numero, nombre: order.cliente.nombre, total });

  function copiar(label: string, valor: string) {
    navigator.clipboard.writeText(valor).then(
      () => toast(`${label} copiado`),
      () => toast('No se pudo copiar'),
    );
  }

  return (
    <div className="pub-transferencia">
      <ol className="pub-transferencia__pasos">
        <li className="pub-transferencia__paso">
          <h2 className="pub-transferencia__titulo">Transferí</h2>
          <dl className="pub-transferencia__datos">
            {datos.map((d) => (
              <div key={d.label} className="pub-transferencia__dato">
                <dt>{d.label}</dt>
                <dd className="u-tabular">{d.valor}</dd>
                <button
                  type="button"
                  className="pub-transferencia__copiar"
                  onClick={() => copiar(d.label, d.valor)}
                  aria-label={`Copiar ${d.label.toLowerCase()}`}
                >
                  <Icon name="copy" />
                  <span aria-hidden="true">Copiar</span>
                </button>
              </div>
            ))}
          </dl>
        </li>
        <li className="pub-transferencia__paso">
          <h2 className="pub-transferencia__titulo">Mandá el comprobante</h2>
          {restante !== null &&
            (restante > 0 ? (
              <p>
                Te quedan <Countdown ms={restante} />
              </p>
            ) : (
              <p className="pub-transferencia__vencido">Se venció el plazo</p>
            ))}
          <a
            className={btnClass('primary', true)}
            href={waLink(settings.telefonoLocal, texto)}
            target="_blank"
            rel="noreferrer"
          >
            Enviar comprobante
          </a>
        </li>
        <li className="pub-transferencia__paso">
          <h2 className="pub-transferencia__titulo">Te confirmamos</h2>
          <p className="pub-transferencia__nota">Te avisamos por WhatsApp cuando lo recibamos.</p>
        </li>
      </ol>
    </div>
  );
}
