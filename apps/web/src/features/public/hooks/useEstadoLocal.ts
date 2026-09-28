import { getProximaApertura } from '@blackstation/shared';
import { useAhora } from '../../../hooks/useAhora';
import { usePublicSettings } from './usePublicSettings';
import { useSlots } from './useSlots';

const REFRESCO_MS = 60_000;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export type EstadoLocal =
  | { tipo: 'cargando' }
  | { tipo: 'error'; reintentar: () => void }
  | { tipo: 'abierto'; texto: string }
  | { tipo: 'cerrado' | 'deshabilitado'; texto: string };

/** Estado del local para el header del catálogo y el checkout. Mismo texto en ambos. */
export function useEstadoLocal(): EstadoLocal {
  const slots = useSlots();
  const settings = usePublicSettings();
  const ahora = useAhora(REFRESCO_MS);

  if (slots.isError || settings.isError) {
    return {
      tipo: 'error',
      reintentar: () => {
        void slots.refetch();
        void settings.refetch();
      },
    };
  }
  if (!slots.data || !settings.data) return { tipo: 'cargando' };

  if (!settings.data.pedidosHabilitados) {
    return { tipo: 'deshabilitado', texto: 'Hoy no estamos tomando pedidos' };
  }

  if (slots.data.abierto) {
    const primera = slots.data.slots[0];
    return {
      tipo: 'abierto',
      texto: primera
        ? `Abierto · retiros desde ${primera.hora}`
        : 'Abierto · no quedan horarios para hoy',
    };
  }

  const proxima = getProximaApertura(settings.data.horarios, new Date(ahora));
  if (!proxima) return { tipo: 'cerrado', texto: 'Cerrado' };
  const cuando = proxima.esHoy ? 'hoy' : `el ${DIAS[proxima.dia] ?? ''}`;
  return { tipo: 'cerrado', texto: `Cerrado · abrimos ${cuando} a las ${proxima.hora}` };
}
