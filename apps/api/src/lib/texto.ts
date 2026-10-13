/** Minúsculas y sin tildes (NFD + quitar diacríticos). Base de `customers.nombreBusqueda`. */
export function normalizarBusqueda(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Escapa los caracteres especiales para usar `s` como literal dentro de una regex. */
export function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
