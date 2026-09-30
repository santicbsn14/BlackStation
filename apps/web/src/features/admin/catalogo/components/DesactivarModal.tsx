import { Button } from '../../../../components/Button';
import { Modal } from '../../../../components/Modal';

type DesactivarModalProps = {
  /** "el producto Lomito completo". */
  que: string;
  /** Consecuencia, en una línea. */
  detalle: string;
  cargando: boolean;
  onConfirmar: () => void;
  onClose: () => void;
};

/** Confirmación antes de dar de baja (soft delete). Se puede reactivar después. */
export function DesactivarModal({
  que,
  detalle,
  cargando,
  onConfirmar,
  onClose,
}: DesactivarModalProps) {
  return (
    <Modal
      title="¿Desactivar?"
      description={`Vas a desactivar ${que}. ${detalle} Lo podés reactivar después.`}
      onClose={onClose}
      dismissible={!cargando}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={cargando}>
            Volver
          </Button>
          <Button variant="danger" onClick={onConfirmar} loading={cargando}>
            Desactivar
          </Button>
        </>
      }
    />
  );
}
