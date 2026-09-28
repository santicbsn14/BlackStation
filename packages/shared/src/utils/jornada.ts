import { ZONA_HORARIA } from '../constants';
import type { Horario } from '../types/settings';

// Jornada, franjas y próxima apertura (MODELO_DATOS §5.1 y §5.2), en la zona de negocio.
// Funciones puras: el instante actual siempre llega por parámetro.

const MIN_POR_DIA = 24 * 60;
const HORAS_FORZADO = 3;

const formatoLocal = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type PartesLocales = {
  fecha: string;
  hora: string;
  dia: number;
  minutos: number;
  /** El instante interpretado como si la hora local fuera UTC. */
  comoUtc: number;
};

function partesLocales(instante: Date): PartesLocales {
  const partes: Record<string, string> = {};
  for (const { type, value } of formatoLocal.formatToParts(instante)) partes[type] = value;
  const { year = '', month = '', day = '', hour = '', minute = '', weekday = '' } = partes;
  return {
    fecha: `${year}-${month}-${day}`,
    hora: `${hour}:${minute}`,
    dia: DIAS.indexOf(weekday),
    minutos: Number(hour) * 60 + Number(minute),
    comoUtc: Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)),
  };
}

function aMinutos(hora: string): number {
  const [h = 0, m = 0] = hora.split(':').map(Number);
  return h * 60 + m;
}

function aHora(minutos: number): string {
  const m = ((minutos % MIN_POR_DIA) + MIN_POR_DIA) % MIN_POR_DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function sumarDias(fecha: string, dias: number): string {
  const [y = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Instante UTC de `minutos` desde las 00:00 local de `fecha` (puede pasar de 24 h). */
function instanteLocal(fecha: string, minutos: number): Date {
  const [y = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  const supuesto = Date.UTC(y, m - 1, d, 0, minutos);
  const offset = partesLocales(new Date(supuesto)).comoUtc - Math.floor(supuesto / 60_000) * 60_000;
  return new Date(supuesto - offset);
}

/** `abre` y `cierra` en minutos desde las 00:00 de la jornada (`cierra` > 24 h si cruza medianoche). */
function rangoDelHorario(horario: Horario): { abre: number; cierra: number } {
  const abre = aMinutos(horario.abre);
  let cierra = aMinutos(horario.cierra);
  if (cierra < abre) cierra += MIN_POR_DIA;
  return { abre, cierra };
}

export type FranjaPosible = {
  hora: string;
  inicio: Date;
};

export type Jornada = {
  fecha: string;
  /** `false` si el día de la jornada no está activo. */
  activa: boolean;
  /** `true` si ahora está entre `abre` (inclusive) y `cierra` (exclusive) de la jornada (§5.1). */
  abierta: boolean;
  franjas: FranjaPosible[];
};

export type ConfigJornada = {
  horarios: Horario[];
  intervaloMin: number;
};

function franjasDelHorario(fecha: string, horario: Horario, intervaloMin: number): FranjaPosible[] {
  const { abre, cierra } = rangoDelHorario(horario);
  const franjas: FranjaPosible[] = [];
  for (let min = abre; min < cierra; min += intervaloMin) {
    franjas.push({ hora: aHora(min), inicio: instanteLocal(fecha, min) });
  }
  return franjas;
}

/**
 * Jornada actual y todas sus franjas posibles.
 * `forzarAbierto` (solo para desarrollar con mocks) ignora `horarios` y genera franjas alineadas a
 * `intervaloMin` desde `ahora` hasta +3 h.
 */
export function getJornada(config: ConfigJornada, ahora: Date, forzarAbierto = false): Jornada {
  const local = partesLocales(ahora);
  const { intervaloMin } = config;

  if (forzarAbierto) {
    const desde = Math.ceil(local.minutos / intervaloMin) * intervaloMin;
    const hasta = local.minutos + HORAS_FORZADO * 60;
    const franjas: FranjaPosible[] = [];
    for (let min = desde; min <= hasta; min += intervaloMin) {
      franjas.push({ hora: aHora(min), inicio: instanteLocal(local.fecha, min) });
    }
    return { fecha: local.fecha, activa: true, abierta: true, franjas };
  }

  const horarioDe = (dia: number) => config.horarios.find((h) => h.dia === dia);

  // Madrugada de una jornada que cruzó la medianoche: ya pasó `abre` y todavía no llegó `cierra`.
  const ayer = horarioDe((local.dia + 6) % 7);
  if (ayer?.activo && ayer.cierra < ayer.abre && local.hora < ayer.cierra) {
    const fecha = sumarDias(local.fecha, -1);
    return {
      fecha,
      activa: true,
      abierta: true,
      franjas: franjasDelHorario(fecha, ayer, intervaloMin),
    };
  }

  const hoy = horarioDe(local.dia);
  if (!hoy?.activo) return { fecha: local.fecha, activa: false, abierta: false, franjas: [] };
  const { abre, cierra } = rangoDelHorario(hoy);
  return {
    fecha: local.fecha,
    activa: true,
    abierta: abre <= local.minutos && local.minutos < cierra,
    franjas: franjasDelHorario(local.fecha, hoy, intervaloMin),
  };
}

export type ProximaApertura = {
  /** 0 = domingo … 6 = sábado. */
  dia: number;
  hora: string;
  /** `true` si abre hoy (día calendario local de `ahora`). */
  esHoy: boolean;
};

/**
 * Próximo `abre` estrictamente posterior a `ahora`, buscando hasta una semana adelante.
 * `null` si no hay ningún día activo.
 */
export function getProximaApertura(horarios: Horario[], ahora: Date): ProximaApertura | null {
  const local = partesLocales(ahora);
  for (let offset = 0; offset <= 7; offset++) {
    const dia = (local.dia + offset) % 7;
    const horario = horarios.find((h) => h.dia === dia);
    if (!horario?.activo) continue;
    if (offset === 0 && aMinutos(horario.abre) <= local.minutos) continue;
    return { dia, hora: horario.abre, esHoy: offset === 0 };
  }
  return null;
}
