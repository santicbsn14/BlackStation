import { describe, expect, it } from 'vitest';
import { ACTORES_TRANSICION, ESTADOS_PEDIDO, MOTIVOS_CANCELACION } from './enums';
import { TRANSICIONES, esEstadoFinal, puedeTransicionar } from './transitions';

describe('puedeTransicionar', () => {
  it('acepta las transiciones del panel', () => {
    expect(puedeTransicionar('pendiente', 'confirmado', null, 'panel')).toBe(true);
    expect(puedeTransicionar('confirmado', 'entregado', null, 'panel')).toBe(true);
    expect(puedeTransicionar('pendiente', 'cancelado', 'manual', 'panel')).toBe(true);
    expect(puedeTransicionar('confirmado', 'cancelado', 'manual', 'panel')).toBe(true);
    expect(puedeTransicionar('confirmado', 'cancelado', 'no_retiro', 'panel')).toBe(true);
  });

  it('vencido solo lo usa el job, y solo desde pendiente', () => {
    expect(puedeTransicionar('pendiente', 'cancelado', 'vencido', 'job')).toBe(true);
    expect(puedeTransicionar('pendiente', 'cancelado', 'vencido', 'panel')).toBe(false);
    expect(puedeTransicionar('confirmado', 'cancelado', 'vencido', 'job')).toBe(false);
  });

  it('el job no hace otras transiciones', () => {
    expect(puedeTransicionar('pendiente', 'confirmado', null, 'job')).toBe(false);
    expect(puedeTransicionar('pendiente', 'cancelado', 'manual', 'job')).toBe(false);
  });

  it('no_retiro solo desde confirmado', () => {
    expect(puedeTransicionar('pendiente', 'cancelado', 'no_retiro', 'panel')).toBe(false);
  });

  it('cancelar exige motivo y los demás estados no lo aceptan', () => {
    expect(puedeTransicionar('pendiente', 'cancelado', null, 'panel')).toBe(false);
    expect(puedeTransicionar('pendiente', 'confirmado', 'manual', 'panel')).toBe(false);
  });

  it('rechaza saltos y retrocesos', () => {
    expect(puedeTransicionar('pendiente', 'entregado', null, 'panel')).toBe(false);
    expect(puedeTransicionar('confirmado', 'pendiente', null, 'panel')).toBe(false);
  });

  it('entregado y cancelado son finales', () => {
    for (const desde of ['entregado', 'cancelado'] as const) {
      for (const hacia of ESTADOS_PEDIDO) {
        for (const motivo of [null, ...MOTIVOS_CANCELACION]) {
          for (const actor of ACTORES_TRANSICION) {
            expect(puedeTransicionar(desde, hacia, motivo, actor)).toBe(false);
          }
        }
      }
    }
  });

  it('la tabla tiene exactamente las 6 transiciones de MODELO_DATOS §4', () => {
    expect(TRANSICIONES).toHaveLength(6);
  });
});

describe('esEstadoFinal', () => {
  it('entregado y cancelado son finales; el resto no', () => {
    expect(ESTADOS_PEDIDO.filter(esEstadoFinal)).toEqual(['entregado', 'cancelado']);
  });

  it('un estado final no tiene transiciones de salida', () => {
    for (const estado of ESTADOS_PEDIDO.filter(esEstadoFinal)) {
      expect(TRANSICIONES.some((t) => t.desde === estado)).toBe(false);
    }
  });
});
