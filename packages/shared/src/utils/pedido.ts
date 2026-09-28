import type { OrderItem, OrderItemExtra } from '../types/orders';

export type ItemCalculable = Pick<OrderItem, 'precioUnitario' | 'cantidad'> & {
  extras: Pick<OrderItemExtra, 'precio' | 'cantidad'>[];
};

/** `(precioUnitario + Σ extras.precio × extras.cantidad) × cantidad` (MODELO_DATOS §3.4). */
export function calcularSubtotal(item: ItemCalculable): number {
  const extras = item.extras.reduce((acc, extra) => acc + extra.precio * extra.cantidad, 0);
  return (item.precioUnitario + extras) * item.cantidad;
}

/** `Σ items.subtotal`. */
export function calcularTotal(items: Pick<OrderItem, 'subtotal'>[]): number {
  return items.reduce((acc, item) => acc + item.subtotal, 0);
}
