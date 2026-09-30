/** `+54 9 3364123456`: el teléfono normalizado (`549…`), legible. */
export function formatearTelefono(telefono: string): string {
  return telefono.startsWith('549') ? `+54 9 ${telefono.slice(3)}` : telefono;
}
