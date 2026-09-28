import { useAhora } from './useAhora';

const TICK_MS = 1_000;

/** Milisegundos que faltan para `hasta` (ISO), nunca negativos. `null` si no hay fecha. */
export function useCountdown(hasta: string | null): number | null {
  const ahora = useAhora(TICK_MS);
  if (!hasta) return null;
  return Math.max(0, Date.parse(hasta) - ahora);
}
