import type { Order } from '../types/orders';
import { formatearPrecio } from './precio';

export const TICKET_TAMANOS = ['normal', 'grande', 'gigante'] as const;
export type TicketTamano = (typeof TICKET_TAMANOS)[number];

export const TICKET_ALINEACIONES = ['izquierda', 'centro', 'derecha'] as const;
export type TicketAlineacion = (typeof TICKET_ALINEACIONES)[number];

/** Una línea del ticket de cocina. La renderizan la preview HTML y el print server (ESC/POS). */
export type TicketLinea = {
  texto: string;
  tamano: TicketTamano;
  negrita: boolean;
  alineacion: TicketAlineacion;
};

/** Datos del pedido que necesita el ticket. */
export type OrderTicket = Pick<
  Order,
  'numero' | 'horaRetiro' | 'cliente' | 'items' | 'aclaracion' | 'metodoPago' | 'total'
>;

/** Columnas de texto `normal` en 72 mm de área imprimible (fuente A de 12 puntos a 203 dpi). */
export const TICKET_COLUMNAS = 48;

const SEPARADOR = '-'.repeat(TICKET_COLUMNAS);

function linea(texto: string, opciones: Partial<Omit<TicketLinea, 'texto'>> = {}): TicketLinea {
  return { texto, tamano: 'normal', negrita: false, alineacion: 'izquierda', ...opciones };
}

/** Precio con espacio común: las impresoras térmicas no traen el espacio duro de `Intl`. */
function precio(monto: number): string {
  return formatearPrecio(monto).replace(/\s/g, ' ');
}

/**
 * Ticket para cocina, de arriba hacia abajo: hora de retiro, número, nombre, ítems (con quitados
 * y extras, sin precios), aclaración y al pie el total con `PAGADO` o `COBRAR $X`.
 */
export function armarTicket(order: OrderTicket): TicketLinea[] {
  const lineas: TicketLinea[] = [
    linea(order.horaRetiro, { tamano: 'gigante', negrita: true, alineacion: 'centro' }),
    linea(`#${order.numero}`, { tamano: 'grande', negrita: true, alineacion: 'centro' }),
    linea(order.cliente.nombre, { negrita: true, alineacion: 'centro' }),
    linea(SEPARADOR),
  ];

  for (const item of order.items) {
    lineas.push(linea(`${item.cantidad}× ${item.nombre}`, { negrita: true }));
    for (const quitado of item.quitados) {
      lineas.push(linea(`   SIN ${quitado}`));
    }
    for (const extra of item.extras) {
      const cantidad = extra.cantidad > 1 ? ` ×${extra.cantidad}` : '';
      lineas.push(linea(`   + ${extra.nombre}${cantidad}`));
    }
  }

  const aclaracion = order.aclaracion?.trim();
  if (aclaracion) {
    lineas.push(linea(SEPARADOR));
    lineas.push(linea('ACLARACIÓN', { negrita: true }));
    lineas.push(linea(aclaracion));
  }

  lineas.push(linea(SEPARADOR));
  lineas.push(linea(`TOTAL ${precio(order.total)}`, { alineacion: 'derecha' }));
  lineas.push(
    linea(order.metodoPago === 'transferencia' ? 'PAGADO' : `COBRAR ${precio(order.total)}`, {
      tamano: 'grande',
      negrita: true,
      alineacion: 'centro',
    }),
  );

  return lineas;
}
