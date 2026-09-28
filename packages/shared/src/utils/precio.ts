const formato = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** `4500` → `$ 4.500` (entero en ARS, sin centavos). */
export function formatearPrecio(precio: number): string {
  return formato.format(precio);
}
