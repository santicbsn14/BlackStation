import { beforeEach, describe, expect, it } from 'vitest';
import { nextNumero } from '../src/services/counters';
import { clearDb, useTestDb } from './db';

useTestDb();

beforeEach(clearDb);

describe('nextNumero', () => {
  it('arranca en 1 y es secuencial por fecha', async () => {
    expect(await nextNumero('2026-10-10')).toBe(1);
    expect(await nextNumero('2026-10-10')).toBe(2);
    expect(await nextNumero('2026-10-10')).toBe(3);
  });

  it('una fecha nueva arranca en 1', async () => {
    await nextNumero('2026-10-10');
    await nextNumero('2026-10-10');
    expect(await nextNumero('2026-10-11')).toBe(1);
    expect(await nextNumero('2026-10-10')).toBe(3);
  });

  it('20 llamadas en paralelo dan 1..20 sin repetidos', async () => {
    const numeros = await Promise.all(Array.from({ length: 20 }, () => nextNumero('2026-10-12')));
    expect([...numeros].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});
