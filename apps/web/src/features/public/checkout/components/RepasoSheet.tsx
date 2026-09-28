import { formatearPrecio, type MetodoPago } from '@blackstation/shared';
import { Button } from '../../../../components/Button';
import { Drawer } from '../../../../components/Drawer';
import './repasoSheet.css';

type RepasoSheetProps = {
  hora: string;
  total: number;
  metodoPago: MetodoPago;
  minutosTransferencia: number | undefined;
  enviando: boolean;
  onVolver: () => void;
  onConfirmar: () => void;
};

/** Repaso antes de crear el pedido. */
export function RepasoSheet({
  hora,
  total,
  metodoPago,
  minutosTransferencia,
  enviando,
  onVolver,
  onConfirmar,
}: RepasoSheetProps) {
  return (
    <Drawer
      side="bottom"
      title="¿Hacemos el pedido?"
      // Con el pedido en viaje no se cierra: la respuesta decide si se navega o se muestra el error.
      onClose={() => {
        if (!enviando) onVolver();
      }}
      footer={
        <div className="pub-repaso__acciones">
          <Button onClick={onVolver} disabled={enviando}>
            Volver
          </Button>
          <Button variant="primary" loading={enviando} onClick={onConfirmar}>
            Sí, hacer pedido
          </Button>
        </div>
      }
    >
      <div className="l-stack">
        <p className="pub-repaso__resumen">
          Retirás hoy a las <span className="u-tabular">{hora}</span> · Total{' '}
          <span className="u-tabular">{formatearPrecio(total)}</span>
        </p>
        <p className="pub-repaso__pago">
          {metodoPago === 'transferencia'
            ? `Pagás por transferencia: vas a tener ${minutosTransferencia === undefined ? 'unos minutos' : `${minutosTransferencia} min`} para mandar el comprobante por WhatsApp. Si no llega, el pedido se cancela solo.`
            : 'Pagás al retirar. Te confirmamos por WhatsApp.'}
        </p>
      </div>
    </Drawer>
  );
}
