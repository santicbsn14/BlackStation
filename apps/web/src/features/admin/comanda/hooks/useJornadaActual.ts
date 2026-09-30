import { getJornada, type Jornada, type Settings } from '@blackstation/shared';
import { useMemo } from 'react';
import { useAhora } from '../../../../hooks/useAhora';
import { jornadaForzada } from '../../../../services';

const REFRESCO_MS = 30_000;

/**
 * Jornada actual y si el local está abierto (MODELO_DATOS §5.1), recalculada cada 30 s. Cuando
 * cambia la `fecha`, la comanda cambia de query key y hace una carga completa.
 */
export function useJornadaActual(settings: Settings | undefined): Jornada | undefined {
  const ahora = useAhora(REFRESCO_MS);
  return useMemo(
    () => (settings ? getJornada(settings, new Date(ahora), jornadaForzada) : undefined),
    [settings, ahora],
  );
}
