import { ZONA_HORARIA } from '@blackstation/shared';

const FORMATO_HORA = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: ZONA_HORARIA,
});

/** `HH:mm` en la zona horaria del negocio (ISO, timestamp o `Date`). */
export function horaLocal(instante: string | number | Date): string {
  return FORMATO_HORA.format(new Date(instante));
}

const DIA_SEMANA = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'UTC' });

/** `Martes 29/09` a partir de una jornada `YYYY-MM-DD`. */
export function formatearJornada(fecha: string): string {
  const [y = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  const dia = DIA_SEMANA.format(new Date(Date.UTC(y, m - 1, d)));
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${dia.charAt(0).toLocaleUpperCase('es-AR')}${dia.slice(1)} ${dd}/${mm}`;
}
