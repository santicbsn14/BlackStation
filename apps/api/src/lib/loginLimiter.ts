import { now } from './clock';

/** §7: 10 fallos por IP en una ventana de 15 min que arranca con el primer fallo. */
export const LOGIN_MAX_FALLOS = 10;
export const LOGIN_VENTANA_MS = 15 * 60_000;

type Entrada = { fallos: number; desde: number };

export type LoginLimiter = {
  /** `null` si la IP puede intentar; si no, los segundos que faltan para que se cumpla la ventana. */
  check: (ip: string) => number | null;
  registrarFallo: (ip: string) => void;
  reset: (ip: string) => void;
  /** Borra las entradas con la ventana cumplida. */
  barrer: () => void;
};

/**
 * Contador de logins fallidos en memoria (se reinicia con cada deploy; Render Starter tiene una
 * sola instancia). El reloj es `now()`, así los tests pueden adelantarlo.
 */
export function createLoginLimiter(
  maxFallos = LOGIN_MAX_FALLOS,
  ventanaMs = LOGIN_VENTANA_MS,
): LoginLimiter {
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
      if (!entrada || entrada.fallos < maxFallos) return null;
      return Math.ceil((entrada.desde + ventanaMs - ahora) / 1000);
    },
    registrarFallo(ip) {
      const ahora = now().getTime();
      const entrada = vigente(ip, ahora);
      if (entrada) entrada.fallos += 1;
      else entradas.set(ip, { fallos: 1, desde: ahora });
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
export const loginLimiter = createLoginLimiter();
setInterval(() => loginLimiter.barrer(), LOGIN_VENTANA_MS).unref();
