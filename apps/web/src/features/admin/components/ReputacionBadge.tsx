import type { EstadoCustomer } from '@blackstation/shared';
import { Badge } from '../../../components/Badge';
import './reputacionBadge.css';

export const ETIQUETA_REPUTACION: Record<EstadoCustomer, string> = {
  normal: 'Normal',
  requiereTransferencia: 'Requiere transferencia',
  bloqueado: 'Bloqueado',
};

/** Estado del customer (§3.6): color + texto. */
export function ReputacionBadge({ estado }: { estado: EstadoCustomer }) {
  return (
    <Badge className="adm-reputacion" data-reputacion={estado}>
      {ETIQUETA_REPUTACION[estado]}
    </Badge>
  );
}
