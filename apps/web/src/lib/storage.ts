/** Lee y valida un JSON de `localStorage`. Si falta, está corrupto o no pasa `validar`: `null`. */
export function leerJson<T>(key: string, validar: (valor: unknown) => valor is T): T | null {
  try {
    const valor: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return validar(valor) ? valor : null;
  } catch {
    return null;
  }
}

export function guardarJson(key: string, valor: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(valor));
  } catch {
    // Sin espacio o storage bloqueado: se sigue sin persistir.
  }
}

export function borrarKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage bloqueado.
  }
}

export function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}
