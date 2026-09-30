import {
  formatearPrecio,
  type Horario,
  type MetodoPago,
  type MotivoCancelacion,
  type Order,
  type OrderItem,
  type Settings,
} from '@blackstation/shared';
import { horaLocal } from '../../../lib/hora';

// Reglas de presentación de la comanda: orden de columnas, textos y variables de plantillas.

export const COLUMNAS = ['pendientes', 'confirmados', 'finalizados'] as const;
export type Columna = (typeof COLUMNAS)[number];

export const TITULO_COLUMNA: Record<Columna, string> = {
  pendientes: 'Pendientes',
  confirmados: 'Confirmados',
  finalizados: 'Finalizados',
};

export const ETIQUETA_METODO: Record<MetodoPago, string> = {
  transferencia: 'Transferencia',
  retiro: 'Paga al retirar',
};

export const ETIQUETA_MOTIVO: Record<MotivoCancelacion, string> = {
  vencido: 'Venció',
  cliente: 'Canceló el cliente',
  no_retiro: 'No retiró',
  manual: 'Cancelado por el local',
};

export type Comanda = Record<Columna, Order[]>;

const MIN_POR_DIA = 24 * 60;

function aMinutos(hora: string): number {
  const [h = 0, m = 0] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** `abre` del horario de la jornada `fecha` (`YYYY-MM-DD`), para ordenar horas que pasan la medianoche. */
export function abreDeJornada(horarios: Horario[], fecha: string): string | null {
  const [y = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return horarios.find((h) => h.dia === dia)?.abre ?? null;
}

/** Minutos desde el inicio de la jornada: una hora anterior a `abre` es de la madrugada siguiente. */
function minutosEnJornada(hora: string, abre: string | null): number {
  const min = aMinutos(hora);
  return abre !== null && min < aMinutos(abre) ? min + MIN_POR_DIA : min;
}

const ms = (iso: string | null) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);

/**
 * Reparte los pedidos en columnas (brief 04b):
 * - Pendientes: primero los de transferencia por `expiresAt` asc, después los de pago al retirar
 *   por `createdAt` asc.
 * - Confirmados: por `horaRetiro` asc (respetando el cruce de medianoche).
 * - Finalizados: entregados y cancelados por `updatedAt` desc.
 */
export function armarComanda(orders: Order[], abre: string | null): Comanda {
  const pendientes = orders.filter((o) => o.estado === 'pendiente');
  const transferencias = pendientes
    .filter((o) => o.metodoPago === 'transferencia')
    .sort((a, b) => ms(a.expiresAt) - ms(b.expiresAt));
  const alRetirar = pendientes
    .filter((o) => o.metodoPago === 'retiro')
    .sort((a, b) => ms(a.createdAt) - ms(b.createdAt));

  const confirmados = orders
    .filter((o) => o.estado === 'confirmado')
    .sort(
      (a, b) =>
        minutosEnJornada(a.horaRetiro, abre) - minutosEnJornada(b.horaRetiro, abre) ||
        a.numero - b.numero,
    );

  const finalizados = orders
    .filter((o) => o.estado === 'entregado' || o.estado === 'cancelado')
    .sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt));

  return { pendientes: [...transferencias, ...alRetirar], confirmados, finalizados };
}

/**
 * Mergea por `_id`. Ante dos versiones del mismo pedido gana la de `updatedAt` más nuevo (una
 * respuesta de mutación puede llegar antes que el polling que la trae).
 */
export function mergeOrders(base: Order[], cambios: Order[]): Order[] {
  const porId = new Map(base.map((o) => [o._id, o]));
  for (const order of cambios) {
    const actual = porId.get(order._id);
    if (!actual || Date.parse(order.updatedAt) >= Date.parse(actual.updatedAt)) {
      porId.set(order._id, order);
    }
  }
  return [...porId.values()];
}

const minuscula = (texto: string) => texto.toLocaleLowerCase('es-AR');

/** `2× Lomito completo (sin cebolla, +cheddar)`. */
export function resumirItem(item: OrderItem): string {
  const detalles = [
    ...item.quitados.map((q) => `sin ${minuscula(q)}`),
    ...item.extras.map((e) => `+${minuscula(e.nombre)}${e.cantidad > 1 ? ` ×${e.cantidad}` : ''}`),
  ];
  const base = `${item.cantidad}× ${item.nombre}`;
  return detalles.length > 0 ? `${base} (${detalles.join(', ')})` : base;
}

/** Variables de las plantillas de WhatsApp (MODELO_DATOS §3.7). */
export function variablesPlantilla(
  order: Order,
  settings: Pick<Settings, 'alias' | 'minutosTransferencia'>,
): Record<string, string | number> {
  return {
    nombre: order.cliente.nombre,
    numero: order.numero,
    hora: order.horaRetiro,
    total: formatearPrecio(order.total),
    alias: settings.alias,
    minutos: settings.minutosTransferencia,
    vence: order.expiresAt ? horaLocal(order.expiresAt) : '',
  };
}

/** Pendiente de transferencia: tiene countdown, "Extender plazo" y "Pedir transferencia". */
export function esTransferenciaPendiente(order: Order): boolean {
  return order.estado === 'pendiente' && order.metodoPago === 'transferencia';
}
