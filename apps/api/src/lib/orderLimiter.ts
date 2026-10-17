import { now } from './clock';

/** §5.3: 10 pedidos creados por IP en una ventana de 1 h que arranca con el primero. */
export const ORDER_MAX_POR_IP = 10;
export const ORDER_VENTANA_MS = 60 * 60_000;

type Entrada = { pedidos: number; desde: number };

export type OrderLimiter = {
  /** `null` si la IP puede pedir; si no, los segundos que faltan para que se cumpla la ventana. */
  check: (ip: string) => number | null;
  /** Suma un pedido creado con éxito. */
  registrar: (ip: string) => void;
  reset: (ip: string) => void;
  /** Borra las entradas con la ventana cumplida. */
  barrer: () => void;
};

/**
 * Contador de pedidos creados por IP en memoria, con la misma forma que `loginLimiter` (se
 * reinicia con cada deploy; Render Starter tiene una sola instancia). El reloj es `now()`.
 */
export function createOrderLimiter(
  maxPedidos = ORDER_MAX_POR_IP,
  ventanaMs = ORDER_VENTANA_MS,
): OrderLimiter {
  const entradas = new Map<string, Entrada>();

  const vencida = (entrada: Entrada, ahora: number) => ahora - entrada.desde >= ventanaMs;

  /** La entrada vigente de la IP; si la ventana ya se cumplió, la borra. */
  function vigente(ip: string, ahora: number): Entrada | undefined {
    const entrada = entradas.get(ip);
    if (entrada && vencida(entrada, ahora)) {
      entradas.delete(ip);
      return undefined;
    }
    return entrada;
  }

  return {
    check(ip) {
      const ahora = now().getTime();
      const entrada = vigente(ip, ahora);
      if (!entrada || entrada.pedidos < maxPedidos) return null;
      return Math.ceil((entrada.desde + ventanaMs - ahora) / 1000);
    },
    registrar(ip) {
      const ahora = now().getTime();
      const entrada = vigente(ip, ahora);
      if (entrada) entrada.pedidos += 1;
      else entradas.set(ip, { pedidos: 1, desde: ahora });
    },
    reset(ip) {
      entradas.delete(ip);
    },
    barrer() {
      const ahora = now().getTime();
      for (const [ip, entrada] of entradas) {
        if (vencida(entrada, ahora)) entradas.delete(ip);
      }
    },
  };
}

/** Instancia de la app. El barrido no mantiene vivo el proceso (`unref`). */
export const orderLimiter = createOrderLimiter();
setInterval(() => orderLimiter.barrer(), ORDER_VENTANA_MS).unref();
