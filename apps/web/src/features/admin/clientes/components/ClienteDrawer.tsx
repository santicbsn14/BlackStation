import { ESTADOS_CUSTOMER, ZONA_HORARIA, type Customer } from '@blackstation/shared';
import { useId } from 'react';
import { btnClass } from '../../../../components/Button';
import { Drawer } from '../../../../components/Drawer';
import { Field } from '../../../../components/Field';
import { Icon } from '../../../../components/Icon';
import { Select } from '../../../../components/Select';
import { Switch } from '../../../../components/Switch';
import { horaLocal } from '../../../../lib/hora';
import { formatearTelefono } from '../../../../lib/telefono';
import { waLink } from '../../../../lib/whatsapp';
import { ETIQUETA_REPUTACION, ReputacionBadge } from '../../components/ReputacionBadge';
import { useUpdateCustomer } from '../hooks/useClientes';
import './clienteDrawer.css';

const FECHA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: ZONA_HORARIA,
});

type ClienteDrawerProps = {
  customer: Customer;
  onClose: () => void;
};

/** Ficha del cliente: contadores, estado (con marca manual) y wa.me. */
export function ClienteDrawer({ customer, onClose }: ClienteDrawerProps) {
  const id = useId();
  const actualizar = useUpdateCustomer();
  const { telefono } = customer;
  const ultimo = customer.ultimoPedidoAt;

  return (
    <Drawer side="right" title={customer.nombre} onClose={onClose}>
      <div className="adm-cliente">
        <div className="adm-cliente__fila">
          <ReputacionBadge estado={customer.estado} />
          {customer.estadoManual && (
            <span className="adm-cliente__manual">
              <Icon name="lock" />
              Estado manual
            </span>
          )}
        </div>
        <p className="u-tabular">{formatearTelefono(telefono)}</p>
        {ultimo && (
          <p className="adm-cliente__meta">
            Último pedido: {FECHA.format(new Date(ultimo))} a las {horaLocal(ultimo)}
          </p>
        )}

        <dl className="adm-cliente__contadores">
          <div>
            <dt>Pedidos</dt>
            <dd className="u-tabular">{customer.pedidosTotal}</dd>
          </div>
          <div>
            <dt>Entregados</dt>
            <dd className="u-tabular">{customer.entregados}</dd>
          </div>
          <div>
            <dt>No retiró</dt>
            <dd className="u-tabular">{customer.noShows}</dd>
          </div>
        </dl>

        <Field
          id={`${id}-estado`}
          label="Estado"
          hint="Cambiarlo lo marca como manual: las reglas automáticas no lo tocan."
        >
          <Select
            id={`${id}-estado`}
            value={customer.estado}
            disabled={actualizar.isPending}
            aria-describedby={`${id}-estado-hint`}
            onChange={(e) => {
              const estado = ESTADOS_CUSTOMER.find((x) => x === e.target.value);
              if (estado) actualizar.mutate({ telefono, request: { estado } });
            }}
          >
            {ESTADOS_CUSTOMER.map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETA_REPUTACION[estado]}
              </option>
            ))}
          </Select>
        </Field>

        <Switch
          label="Estado manual"
          checked={customer.estadoManual}
          disabled={actualizar.isPending}
          onChange={(estadoManual) => actualizar.mutate({ telefono, request: { estadoManual } })}
        />

        <a
          className={btnClass('secondary')}
          href={waLink(telefono)}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="whatsapp" />
          Escribirle por WhatsApp
        </a>
      </div>
    </Drawer>
  );
}
