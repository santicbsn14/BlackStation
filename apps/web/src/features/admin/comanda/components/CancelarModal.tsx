import type { MotivoCancelacionPanel, Order } from '@blackstation/shared';
import { useState } from 'react';
import { Button } from '../../../../components/Button';
import { Modal } from '../../../../components/Modal';
import { ApiError } from '../../../../services';
import { ETIQUETA_MOTIVO } from '../comanda';
import { useUpdateOrderEstado } from '../hooks/useUpdateOrderEstado';
import './cancelarModal.css';

const DESCRIPCION_MOTIVO: Record<MotivoCancelacionPanel, string> = {
  manual: 'Libera el cupo de la franja.',
  no_retiro: 'Libera el cupo y le suma un "no retiró" al cliente.',
};

type CancelarModalProps = {
  order: Order;
  onClose: () => void;
};

/** Cancelar con motivo: `manual` (pendiente o confirmado) o `no_retiro` (solo confirmado). */
export function CancelarModal({ order, onClose }: CancelarModalProps) {
  const cancelar = useUpdateOrderEstado(order);
  const motivos: MotivoCancelacionPanel[] =
    order.estado === 'confirmado' ? ['no_retiro', 'manual'] : ['manual'];
  const [elegido, setElegido] = useState<MotivoCancelacionPanel>('manual');
  const motivo = motivos.includes(elegido) ? elegido : 'manual';

  function confirmar() {
    cancelar.mutate(
      { estado: 'cancelado', motivoCancelacion: motivo },
      {
        onSuccess: onClose,
        // El pedido cambió en el medio: el toast y el refetch los maneja el hook.
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'INVALID_TRANSITION') onClose();
        },
      },
    );
  }

  return (
    <Modal
      title={`Cancelar pedido #${order.numero}`}
      description="Elegí el motivo."
      onClose={onClose}
      dismissible={!cancelar.isPending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={cancelar.isPending}>
            Volver
          </Button>
          <Button variant="danger" onClick={confirmar} loading={cancelar.isPending}>
            Cancelar pedido
          </Button>
        </>
      }
    >
      <fieldset className="adm-cancelar">
        <legend className="u-visually-hidden">Motivo</legend>
        {motivos.map((m) => (
          <label key={m} className="adm-cancelar__opcion">
            <input
              type="radio"
              name="motivo"
              value={m}
              checked={motivo === m}
              onChange={() => setElegido(m)}
              disabled={cancelar.isPending}
            />
            <span className="adm-cancelar__texto">
              <span className="adm-cancelar__titulo">{ETIQUETA_MOTIVO[m]}</span>
              <span className="adm-cancelar__descripcion">{DESCRIPCION_MOTIVO[m]}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}
