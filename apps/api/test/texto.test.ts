import { describe, expect, it } from 'vitest';
import { escaparRegex, normalizarBusqueda } from '../src/lib/texto';

describe('normalizarBusqueda', () => {
  it('pasa a minúsculas y quita tildes', () => {
    expect(normalizarBusqueda('Juán PÉREZ')).toBe('juan perez');
    expect(normalizarBusqueda('Peña Ü')).toBe('pena u');
  });
});

describe('escaparRegex', () => {
  it('neutraliza .*+?()[]', () => {
    const peligroso = 'a.*+?()[]b';
    const regex = new RegExp(escaparRegex(peligroso));
    expect(regex.test(peligroso)).toBe(true);
    expect(regex.test('aXXXb')).toBe(false);
    expect(escaparRegex('.*+?()[]')).toBe('\\.\\*\\+\\?\\(\\)\\[\\]');
  });
});
