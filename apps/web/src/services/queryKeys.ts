export const catalogKeys = {
  all: ['catalog'] as const,
  public: () => [...catalogKeys.all, 'public'] as const,
  admin: () => [...catalogKeys.all, 'admin'] as const,
  categories: () => [...catalogKeys.admin(), 'categories'] as const,
  products: () => [...catalogKeys.admin(), 'products'] as const,
  extras: () => [...catalogKeys.admin(), 'extras'] as const,
};

export const slotKeys = {
  all: ['slots'] as const,
  public: () => [...slotKeys.all, 'public'] as const,
  /** Franjas del panel; sin `fecha`, la jornada actual. */
  admin: (fecha?: string) => [...slotKeys.all, 'admin', fecha ?? 'actual'] as const,
};

export const settingsKeys = {
  all: ['settings'] as const,
  public: () => [...settingsKeys.all, 'public'] as const,
  admin: () => [...settingsKeys.all, 'admin'] as const,
};

export const orderKeys = {
  all: ['orders'] as const,
  /** Seguimiento público por `codigo`. */
  public: (codigo: string) => [...orderKeys.all, 'public', codigo] as const,
  /** Comanda: pedidos de una jornada. */
  list: (fecha: string) => [...orderKeys.all, 'list', fecha] as const,
  /** Pendientes de la jornada actual (badge del menú del panel). */
  pendientes: () => [...orderKeys.all, 'pendientes'] as const,
  /** Pedidos de la jornada actual, para contar los activos antes de guardar Ajustes. */
  jornadaActual: () => [...orderKeys.all, 'jornada-actual'] as const,
  /** `mutationKey` de las acciones del panel sobre un pedido (bloquea la card y el detalle a la vez). */
  accion: (id: string) => [...orderKeys.all, 'accion', id] as const,
};

export const customerKeys = {
  all: ['customers'] as const,
  list: (q: string) => [...customerKeys.all, 'list', q] as const,
};
