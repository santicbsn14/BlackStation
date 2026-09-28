import type { MetodoPago } from '@blackstation/shared';
import './metodoPagoSelector.css';

type MetodoPagoSelectorProps = {
  value: MetodoPago;
  onChange: (metodo: MetodoPago) => void;
  minutosTransferencia: number;
  /** El customer solo puede pagar por transferencia (403 `TRANSFER_REQUIRED`). */
  soloTransferencia: boolean;
};

export function MetodoPagoSelector({
  value,
  onChange,
  minutosTransferencia,
  soloTransferencia,
}: MetodoPagoSelectorProps) {
  const opciones: { metodo: MetodoPago; titulo: string; detalle: string; disabled: boolean }[] = [
    {
      metodo: 'transferencia',
      titulo: 'Transferencia',
      detalle: `Tenés ${minutosTransferencia} min para mandar el comprobante`,
      disabled: false,
    },
    {
      metodo: 'retiro',
      titulo: 'Pago al retirar',
      detalle: 'Pagás cuando pasás a buscar el pedido',
      disabled: soloTransferencia,
    },
  ];

  return (
    <div className="pub-pago" role="radiogroup" aria-label="Método de pago">
      {opciones.map((o) => (
        <label key={o.metodo} className="pub-pago__opcion" data-disabled={o.disabled || undefined}>
          <input
            type="radio"
            name="metodoPago"
            className="pub-pago__radio"
            value={o.metodo}
            checked={value === o.metodo}
            disabled={o.disabled}
            onChange={() => onChange(o.metodo)}
          />
          <span className="pub-pago__texto">
            <span className="pub-pago__titulo">{o.titulo}</span>
            <span className="pub-pago__detalle">{o.detalle}</span>
          </span>
        </label>
      ))}
      {soloTransferencia && (
        <p className="pub-pago__aviso" role="alert">
          Para este número el pago es por transferencia
        </p>
      )}
    </div>
  );
}
