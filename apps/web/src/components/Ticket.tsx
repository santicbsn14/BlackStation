import { armarTicket, type OrderTicket } from '@blackstation/shared';
import './ticket.css';

type TicketProps = {
  order: OrderTicket;
  className?: string;
};

/**
 * Preview del ticket de cocina (DESIGN_SYSTEM §7). Solo mapea las líneas de `armarTicket` a
 * estilos: los textos salen de la misma función que usa el print server.
 */
export function Ticket({ order, className }: TicketProps) {
  const lineas = armarTicket(order);
  return (
    <figure
      className={['ticket', className].filter(Boolean).join(' ')}
      aria-label={`Vista previa del ticket del pedido #${order.numero}`}
    >
      {lineas.map((linea, i) => (
        <p
          key={i}
          className="ticket__linea"
          data-tamano={linea.tamano}
          data-alineacion={linea.alineacion}
          data-negrita={linea.negrita || undefined}
        >
          {linea.texto}
        </p>
      ))}
    </figure>
  );
}
