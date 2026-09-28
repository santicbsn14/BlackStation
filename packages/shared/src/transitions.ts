import type { ActorTransicion, EstadoPedido, MotivoCancelacion } from './enums';

export type Transicion = {
  desde: EstadoPedido;
  hacia: EstadoPedido;
  motivo: MotivoCancelacion | null;
  actor: ActorTransicion;
};

/** Transiciones válidas del pedido (MODELO_DATOS §4). Cualquier otra se rechaza con 409. */
export const TRANSICIONES: readonly Transicion[] = [
  { desde: 'pendiente', hacia: 'confirmado', motivo: null, actor: 'panel' },
  { desde: 'confirmado', hacia: 'entregado', motivo: null, actor: 'panel' },
  { desde: 'pendiente', hacia: 'cancelado', motivo: 'vencido', actor: 'job' },
  { desde: 'pendiente', hacia: 'cancelado', motivo: 'manual', actor: 'panel' },
  { desde: 'pendiente', hacia: 'cancelado', motivo: 'cliente', actor: 'cliente' },
  { desde: 'confirmado', hacia: 'cancelado', motivo: 'no_retiro', actor: 'panel' },
  { desde: 'confirmado', hacia: 'cancelado', motivo: 'manual', actor: 'panel' },
];

/**
 * `motivo` es obligatorio si `hacia = cancelado` y debe ser `null` en cualquier otro caso.
 */
export function puedeTransicionar(
  desde: EstadoPedido,
  hacia: EstadoPedido,
  motivo: MotivoCancelacion | null,
  actor: ActorTransicion,
): boolean {
  return TRANSICIONES.some(
    (t) => t.desde === desde && t.hacia === hacia && t.motivo === motivo && t.actor === actor,
  );
}

/** Estados sin transiciones de salida (MODELO_DATOS §4). */
export const ESTADOS_FINALES: readonly EstadoPedido[] = ['entregado', 'cancelado'];

export function esEstadoFinal(estado: EstadoPedido): boolean {
  return ESTADOS_FINALES.includes(estado);
}
