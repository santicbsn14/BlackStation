/** Link `wa.me` a un teléfono normalizado (`549…`), con texto precargado opcional. */
export function waLink(telefono: string, texto?: string): string {
  const base = `https://wa.me/${telefono}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
