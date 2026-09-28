import { describe, expect, it } from 'vitest';
import type { Horario } from '../types/settings';
import { getJornada, getProximaApertura } from './jornada';

// Defaults de §3.7: martes a domingo 20:00–00:30, lunes inactivo.
const horarios: Horario[] = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
  dia,
  activo: dia !== 1,
  abre: '20:00',
  cierra: '00:30',
}));
const config = { horarios, intervaloMin: 15 };

// Buenos Aires es UTC-3 todo el año. 2026-09-27 es domingo; 28, lunes; 29, martes.
const local = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-03:00`);

describe('getJornada', () => {
  it('dentro del horario: jornada de hoy, abierta, con franjas hasta antes de cierra', () => {
    const jornada = getJornada(config, local('2026-09-27', '21:00'));
    expect(jornada.fecha).toBe('2026-09-27');
    expect(jornada.activa).toBe(true);
    expect(jornada.abierta).toBe(true);
    expect(jornada.franjas).toHaveLength(18);
    expect(jornada.franjas[0]?.hora).toBe('20:00');
    const ultima = jornada.franjas.at(-1);
    expect(ultima?.hora).toBe('00:15');
    // El inicio real cae en el día calendario siguiente.
    expect(ultima?.inicio.toISOString()).toBe('2026-09-28T03:15:00.000Z');
  });

  it('madrugada después de medianoche: sigue siendo la jornada anterior', () => {
    const jornada = getJornada(config, local('2026-09-28', '00:10'));
    expect(jornada.fecha).toBe('2026-09-27');
    expect(jornada.abierta).toBe(true);
  });

  it('pasado el cierre de madrugada, un día inactivo no abre', () => {
    const jornada = getJornada(config, local('2026-09-28', '00:45'));
    expect(jornada).toMatchObject({ fecha: '2026-09-28', activa: false, abierta: false });
    expect(jornada.franjas).toEqual([]);
  });

  it('antes de abrir: día activo pero cerrado', () => {
    const jornada = getJornada(config, local('2026-09-29', '18:00'));
    expect(jornada).toMatchObject({ fecha: '2026-09-29', activa: true, abierta: false });
    expect(jornada.franjas[0]?.hora).toBe('20:00');
  });

  it('forzarAbierto ignora horarios y arranca en la próxima franja alineada', () => {
    const jornada = getJornada(config, local('2026-09-28', '10:07'), true);
    expect(jornada).toMatchObject({ fecha: '2026-09-28', activa: true, abierta: true });
    expect(jornada.franjas[0]?.hora).toBe('10:15');
    expect(jornada.franjas.at(-1)?.hora).toBe('13:00');
  });
});

describe('getProximaApertura', () => {
  it('antes de abrir: hoy', () => {
    expect(getProximaApertura(horarios, local('2026-09-29', '18:00'))).toEqual({
      dia: 2,
      hora: '20:00',
      esHoy: true,
    });
  });

  it('día inactivo: el próximo día activo', () => {
    expect(getProximaApertura(horarios, local('2026-09-28', '12:00'))).toEqual({
      dia: 2,
      hora: '20:00',
      esHoy: false,
    });
  });

  it('ya abrió hoy: salta al siguiente día activo', () => {
    expect(getProximaApertura(horarios, local('2026-09-27', '21:00'))).toEqual({
      dia: 2,
      hora: '20:00',
      esHoy: false,
    });
  });

  it('pasado el cierre de madrugada: hoy a la noche', () => {
    expect(getProximaApertura(horarios, local('2026-09-30', '01:00'))).toEqual({
      dia: 3,
      hora: '20:00',
      esHoy: true,
    });
  });

  it('sin días activos: null', () => {
    const cerrado = horarios.map((h) => ({ ...h, activo: false }));
    expect(getProximaApertura(cerrado, local('2026-09-29', '18:00'))).toBeNull();
  });
});
