import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../src/lib/clock';
import { createOrderLimiter, ORDER_MAX_POR_IP, ORDER_VENTANA_MS } from '../src/lib/orderLimiter';

let ahora = 0;
const INICIO = Date.parse('2026-10-17T00:00:00.000Z');
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

function pedir(limiter: ReturnType<typeof createOrderLimiter>, ip: string, veces: number) {
  for (let i = 0; i < veces; i++) limiter.registrar(ip);
}

describe('orderLimiter', () => {
  it('10 pedidos por hora', () => {
    expect(ORDER_MAX_POR_IP).toBe(10);
    expect(ORDER_VENTANA_MS).toBe(60 * 60_000);
  });

  it('permite hasta llegar al tope de pedidos', () => {
    const limiter = createOrderLimiter();
    pedir(limiter, 'a', ORDER_MAX_POR_IP - 1);
    expect(limiter.check('a')).toBeNull();
    limiter.registrar('a');
    expect(limiter.check('a')).toBe(ORDER_VENTANA_MS / 1000);
  });

  it('Retry-After cuenta desde el primer pedido, redondeado hacia arriba', () => {
    const limiter = createOrderLimiter();
    limiter.registrar('a');
    avanzar(20 * 60_000);
    pedir(limiter, 'a', ORDER_MAX_POR_IP - 1);
    avanzar(500);
    expect(limiter.check('a')).toBe(40 * 60);
  });

  it('cumplida la ventana vuelve a permitir y el contador arranca de cero', () => {
    const limiter = createOrderLimiter();
    pedir(limiter, 'a', ORDER_MAX_POR_IP);
    avanzar(ORDER_VENTANA_MS - 1);
    expect(limiter.check('a')).toBe(1);
    avanzar(1);
    expect(limiter.check('a')).toBeNull();
    limiter.registrar('a');
    expect(limiter.check('a')).toBeNull();
  });

  it('los pedidos fuera de la ventana abren una ventana nueva', () => {
    const limiter = createOrderLimiter();
    pedir(limiter, 'a', ORDER_MAX_POR_IP - 1);
    avanzar(ORDER_VENTANA_MS);
    limiter.registrar('a');
    expect(limiter.check('a')).toBeNull();
  });

  it('reset borra el contador de esa IP', () => {
    const limiter = createOrderLimiter();
    pedir(limiter, 'a', ORDER_MAX_POR_IP);
    limiter.reset('a');
    expect(limiter.check('a')).toBeNull();
  });

  it('las IPs son independientes', () => {
    const limiter = createOrderLimiter();
    pedir(limiter, 'a', ORDER_MAX_POR_IP);
    expect(limiter.check('a')).not.toBeNull();
    expect(limiter.check('b')).toBeNull();
  });

  it('barrer borra solo las entradas vencidas', () => {
    const limiter = createOrderLimiter();
    pedir(limiter, 'vieja', ORDER_MAX_POR_IP);
    avanzar(ORDER_VENTANA_MS / 2);
    pedir(limiter, 'nueva', ORDER_MAX_POR_IP);
    avanzar(ORDER_VENTANA_MS / 2);
    limiter.barrer();
    expect(limiter.check('vieja')).toBeNull();
    expect(limiter.check('nueva')).not.toBeNull();
  });
});
