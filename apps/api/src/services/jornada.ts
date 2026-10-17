import { getJornada, type ConfigJornada, type Jornada } from '@blackstation/shared';
import { getEnv } from '../config/env';
import { now } from '../lib/clock';

/** Jornada actual (§5.1) con el reloj de la API. Con `FORCE_OPEN` se ignoran los horarios. */
export function jornadaActual(settings: ConfigJornada, ahora: Date = now()): Jornada {
  return getJornada(settings, ahora, getEnv().FORCE_OPEN);
}
