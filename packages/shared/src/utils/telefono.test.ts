import { describe, expect, it } from 'vitest';
import { normalizarTelefono } from './telefono';

describe('normalizarTelefono', () => {
  it.each([
    // 336 (San Nicolás)
    ['336', '4123456', '5493364123456'],
    ['0336', '4123456', '5493364123456'],
    ['0336', '15 412-3456', '5493364123456'],
    ['336', '154123456', '5493364123456'],
    [' 0336 ', '412 3456', '5493364123456'],
    // 3461 (Villa Constitución)
    ['3461', '412345', '5493461412345'],
    ['03461', '15-412345', '5493461412345'],
    ['3461', '15412345', '5493461412345'],
    // 341 (Rosario)
    ['341', '5123456', '5493415123456'],
    ['0341', '15 512 3456', '5493415123456'],
    ['(0341)', '155-123-456', '5493415123456'],
    // 11 (AMBA)
    ['11', '12345678', '5491112345678'],
    ['011', '15 1234-5678', '5491112345678'],
    ['11', '1512345678', '5491112345678'],
    // Un número que empieza con 15 pero no es el prefijo de celular.
    ['11', '15234567', '5491115234567'],
  ])('(%s, %s) → %s', (caracteristica, numero, esperado) => {
    expect(normalizarTelefono(caracteristica, numero)).toEqual({ ok: true, telefono: esperado });
  });

  it.each([
    ['', '4123456', 'caracteristica_invalida'],
    ['0', '4123456', 'caracteristica_invalida'],
    ['3', '4123456', 'caracteristica_invalida'],
    ['33612', '41234', 'caracteristica_invalida'],
    ['00336', '4123456', 'caracteristica_invalida'],
    ['336', '', 'numero_invalido'],
    ['336', '15', 'largo_invalido'],
    ['336', '412345', 'largo_invalido'],
    ['336', '41234567', 'largo_invalido'],
    ['336', '15 412-34567', 'largo_invalido'],
    ['abc', 'def', 'caracteristica_invalida'],
  ] as const)('(%s, %s) → error %s', (caracteristica, numero, error) => {
    expect(normalizarTelefono(caracteristica, numero)).toEqual({ ok: false, error });
  });
});
