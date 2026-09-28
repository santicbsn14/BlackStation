export const catalogKeys = {
  all: ['catalog'] as const,
  public: () => [...catalogKeys.all, 'public'] as const,
};

export const slotKeys = {
  all: ['slots'] as const,
  public: () => [...slotKeys.all, 'public'] as const,
};

export const settingsKeys = {
  all: ['settings'] as const,
  public: () => [...settingsKeys.all, 'public'] as const,
};

export const orderKeys = {
  all: ['orders'] as const,
  /** Seguimiento público por `codigo`. */
  public: (codigo: string) => [...orderKeys.all, 'public', codigo] as const,
  list: (fecha: string) => [...orderKeys.all, 'list', fecha] as const,
};
