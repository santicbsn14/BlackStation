import { describe, expect, it } from 'vitest';
import { calcularSubtotal, calcularTotal } from './pedido';

describe('calcularSubtotal', () => {
  it('sin extras: precio × cantidad', () => {
    expect(calcularSubtotal({ precioUnitario: 4500, cantidad: 2, extras: [] })).toBe(9000);
  });

  it('suma los extras por unidad y multiplica por la cantidad', () => {
    const item = {
      precioUnitario: 8000,
      cantidad: 3,
      extras: [
        { precio: 1200, cantidad: 2 },
        { precio: 800, cantidad: 1 },
      ],
    };
    // (8000 + 1200×2 + 800×1) × 3
    expect(calcularSubtotal(item)).toBe(33600);
  });
});

describe('calcularTotal', () => {
  it('suma los subtotales', () => {
    expect(calcularTotal([{ subtotal: 9000 }, { subtotal: 33600 }])).toBe(42600);
  });

  it('sin ítems es 0', () => {
    expect(calcularTotal([])).toBe(0);
  });
});
