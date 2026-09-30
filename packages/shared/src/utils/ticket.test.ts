import { describe, expect, it } from 'vitest';
import { armarTicket, TICKET_COLUMNAS, type OrderTicket } from './ticket';

const base: OrderTicket = {
  numero: 12,
  horaRetiro: '21:30',
  cliente: { nombre: 'Juan', telefono: '5493364123456' },
  items: [
    {
      productoId: 'p1',
      nombre: 'Lomito completo',
      precioUnitario: 9000,
      cantidad: 2,
      quitados: ['cebolla'],
      extras: [{ extraId: 'e1', nombre: 'Cheddar', precio: 1000, cantidad: 2 }],
      subtotal: 22000,
    },
  ],
  aclaracion: null,
  metodoPago: 'retiro',
  total: 22000,
};

const textos = (order: OrderTicket) => armarTicket(order).map((l) => l.texto);

describe('armarTicket', () => {
  it('arranca con la hora gigante, el número grande y el nombre', () => {
    const [hora, numero, nombre] = armarTicket(base);
    expect(hora).toEqual({
      texto: '21:30',
      tamano: 'gigante',
      negrita: true,
      alineacion: 'centro',
    });
    expect(numero).toEqual({ texto: '#12', tamano: 'grande', negrita: true, alineacion: 'centro' });
    expect(nombre).toMatchObject({ texto: 'Juan', tamano: 'normal' });
  });

  it('lista ítems con quitados y extras debajo, sin precios por ítem', () => {
    const t = textos(base);
    const i = t.indexOf('2× Lomito completo');
    expect(i).toBeGreaterThan(-1);
    expect(t[i + 1]?.trim()).toBe('SIN cebolla');
    expect(t[i + 2]?.trim()).toBe('+ Cheddar ×2');
    const conPrecio = t.filter((x) => x.includes('$'));
    expect(conPrecio).toEqual(['TOTAL $ 22.000', 'COBRAR $ 22.000']);
  });

  it('un extra de cantidad 1 no lleva multiplicador', () => {
    const order: OrderTicket = {
      ...base,
      items: [
        {
          productoId: 'p2',
          nombre: 'Hamburguesa',
          precioUnitario: 7000,
          cantidad: 1,
          quitados: [],
          extras: [{ extraId: 'e2', nombre: 'Huevo', precio: 800, cantidad: 1 }],
          subtotal: 7800,
        },
      ],
      total: 7800,
    };
    const t = textos(order);
    expect(t).toContain('1× Hamburguesa');
    expect(t.map((x) => x.trim())).toContain('+ Huevo');
  });

  it('pago al retirar: al pie el total y COBRAR con el monto', () => {
    const lineas = armarTicket(base);
    const ultima = lineas.at(-1);
    expect(ultima).toMatchObject({ texto: 'COBRAR $ 22.000', tamano: 'grande', negrita: true });
    expect(lineas.at(-2)?.texto).toBe('TOTAL $ 22.000');
  });

  it('transferencia: al pie el total y PAGADO', () => {
    const lineas = armarTicket({ ...base, metodoPago: 'transferencia' });
    expect(lineas.at(-1)?.texto).toBe('PAGADO');
    expect(lineas.at(-2)?.texto).toBe('TOTAL $ 22.000');
    expect(lineas.some((l) => l.texto.startsWith('COBRAR'))).toBe(false);
  });

  it('incluye la aclaración después de los ítems', () => {
    const t = textos({ ...base, aclaracion: 'Tocar timbre' });
    expect(t.indexOf('Tocar timbre')).toBeGreaterThan(t.indexOf('2× Lomito completo'));
    expect(t.indexOf('Tocar timbre')).toBeLessThan(t.findIndex((x) => x.startsWith('TOTAL')));
  });

  it('sin aclaración (o en blanco) no agrega el bloque', () => {
    expect(textos(base)).not.toContain('ACLARACIÓN');
    expect(textos({ ...base, aclaracion: '   ' })).not.toContain('ACLARACIÓN');
  });

  it('no usa el espacio duro de Intl y los separadores entran en el ancho', () => {
    for (const l of armarTicket({ ...base, aclaracion: 'x' })) {
      expect(l.texto).not.toContain(' ');
      expect(l.texto.length).toBeLessThanOrEqual(TICKET_COLUMNAS);
    }
  });
});
