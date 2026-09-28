import { describe, expect, it } from 'vitest';
import { formatearPrecio } from './precio';

// Intl separa el símbolo con un espacio duro (U+00A0).
const normalizar = (s: string) => s.replace(/\s/g, ' ');

describe('formatearPrecio', () => {
  it('formatea en pesos sin centavos con separador de miles', () => {
    expect(normalizar(formatearPrecio(4500))).toBe('$ 4.500');
    expect(normalizar(formatearPrecio(125000))).toBe('$ 125.000');
  });

  it('formatea el cero y montos chicos', () => {
    expect(normalizar(formatearPrecio(0))).toBe('$ 0');
    expect(normalizar(formatearPrecio(900))).toBe('$ 900');
  });
});
