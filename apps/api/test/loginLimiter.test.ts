import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../src/lib/clock';
import { createLoginLimiter, LOGIN_MAX_FALLOS, LOGIN_VENTANA_MS } from '../src/lib/loginLimiter';

let ahora = 0;
const INICIO = Date.parse('2026-10-14T21:00:00.000Z');
const avanzar = (ms: number) => {
  ahora += ms;
};

beforeEach(() => {
  ahora = INICIO;
  setClock(() => new Date(ahora));
});

afterEach(() => {
  setClock(null);
});

function fallar(limiter: ReturnType<typeof createLoginLimiter>, ip: string, veces: number) {
  for (let i = 0; i < veces; i++) limiter.registrarFallo(ip);
}

describe('loginLimiter', () => {
  it('permite hasta llegar al tope de fallos', () => {
    const limiter = createLoginLimiter();
    fallar(limiter, 'a', LOGIN_MAX_FALLOS - 1);
    expect(limiter.check('a')).toBeNull();
    limiter.registrarFallo('a');
    expect(limiter.check('a')).toBe(LOGIN_VENTANA_MS / 1000);
  });

  it('Retry-After cuenta desde el primer fallo, redondeado hacia arriba', () => {
    const limiter = createLoginLimiter();
    limiter.registrarFallo('a');
    avanzar(5 * 60_000);
    fallar(limiter, 'a', LOGIN_MAX_FALLOS - 1);
    avanzar(500);
    expect(limiter.check('a')).toBe(600);
  });

  it('cumplida la ventana vuelve a permitir y el contador arranca de cero', () => {
    const limiter = createLoginLimiter();
    fallar(limiter, 'a', LOGIN_MAX_FALLOS);
    avanzar(LOGIN_VENTANA_MS - 1);
    expect(limiter.check('a')).toBe(1);
    avanzar(1);
    expect(limiter.check('a')).toBeNull();
    limiter.registrarFallo('a');
    expect(limiter.check('a')).toBeNull();
  });

  it('los fallos fuera de la ventana abren una ventana nueva', () => {
    const limiter = createLoginLimiter();
    fallar(limiter, 'a', LOGIN_MAX_FALLOS - 1);
    avanzar(LOGIN_VENTANA_MS);
    limiter.registrarFallo('a');
    expect(limiter.check('a')).toBeNull();
  });

  it('reset borra el contador de esa IP', () => {
    const limiter = createLoginLimiter();
    fallar(limiter, 'a', LOGIN_MAX_FALLOS);
    limiter.reset('a');
    expect(limiter.check('a')).toBeNull();
  });

  it('las IPs son independientes', () => {
    const limiter = createLoginLimiter();
    fallar(limiter, 'a', LOGIN_MAX_FALLOS);
    expect(limiter.check('a')).not.toBeNull();
    expect(limiter.check('b')).toBeNull();
  });

  it('barrer borra solo las entradas vencidas', () => {
    const limiter = createLoginLimiter();
    fallar(limiter, 'vieja', LOGIN_MAX_FALLOS);
    avanzar(LOGIN_VENTANA_MS / 2);
    fallar(limiter, 'nueva', LOGIN_MAX_FALLOS);
    avanzar(LOGIN_VENTANA_MS / 2);
    limiter.barrer();
    expect(limiter.check('vieja')).toBeNull();
    expect(limiter.check('nueva')).not.toBeNull();
  });
});
