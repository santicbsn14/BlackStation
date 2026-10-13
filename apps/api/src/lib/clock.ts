/**
 * Reloj de la API. Todo "ahora" sale de `now()`, nunca de `new Date()` directo, así los tests
 * pueden fijar la hora con `setClock`.
 */
let clock: () => Date = () => new Date();

export function now(): Date {
  return clock();
}

/** Solo tests: reemplaza el reloj. `null` vuelve al reloj real. */
export function setClock(fn: (() => Date) | null): void {
  clock = fn ?? (() => new Date());
}
