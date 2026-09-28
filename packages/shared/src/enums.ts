export const ESTADOS_PEDIDO = ['pendiente', 'confirmado', 'entregado', 'cancelado'] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const MOTIVOS_CANCELACION = ['vencido', 'manual', 'no_retiro', 'cliente'] as const;
export type MotivoCancelacion = (typeof MOTIVOS_CANCELACION)[number];

/** Motivos que puede usar el panel (`vencido` es exclusivo del job y `cliente` del endpoint público). */
export const MOTIVOS_CANCELACION_PANEL = ['manual', 'no_retiro'] as const;
export type MotivoCancelacionPanel = (typeof MOTIVOS_CANCELACION_PANEL)[number];

export const METODOS_PAGO = ['retiro', 'transferencia'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const ESTADOS_CUSTOMER = ['normal', 'requiereTransferencia', 'bloqueado'] as const;
export type EstadoCustomer = (typeof ESTADOS_CUSTOMER)[number];

export const ROLES = ['admin'] as const;
export type Rol = (typeof ROLES)[number];

/** Quién dispara una transición de estado del pedido. */
export const ACTORES_TRANSICION = ['panel', 'job', 'cliente'] as const;
export type ActorTransicion = (typeof ACTORES_TRANSICION)[number];
