import type { Customer, EstadoCustomer } from '@blackstation/shared';
import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Chip } from '../../../../components/Chip';
import { EmptyState } from '../../../../components/EmptyState';
import { ErrorState } from '../../../../components/ErrorState';
import { Input } from '../../../../components/Field';
import { Icon } from '../../../../components/Icon';
import { Skeleton } from '../../../../components/Skeleton';
import { Table, type TableColumn } from '../../../../components/Table';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { formatearTelefono } from '../../../../lib/telefono';
import { ReputacionBadge } from '../../components/ReputacionBadge';
import { ClienteDrawer } from '../components/ClienteDrawer';
import { useClientes } from '../hooks/useClientes';
import './clientesPage.css';

const DEBOUNCE_MS = 400;
const Q_MIN = 2;

const FILTROS = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'requiereTransferencia', label: 'Requiere transferencia' },
  { valor: 'bloqueado', label: 'Bloqueados' },
] as const satisfies readonly { valor: EstadoCustomer | 'todos'; label: string }[];
type Filtro = (typeof FILTROS)[number]['valor'];

const COLUMNAS: TableColumn<Customer>[] = [
  {
    key: 'cliente',
    header: 'Cliente',
    render: (c) => (
      <span className="adm-clientes__cliente">
        <span className="adm-clientes__nombre">{c.nombre}</span>
        <span className="adm-clientes__telefono u-tabular">{formatearTelefono(c.telefono)}</span>
      </span>
    ),
  },
  {
    key: 'pedidos',
    header: 'Pedidos',
    align: 'end',
    shrink: true,
    render: (c) => <span className="u-tabular">{c.pedidosTotal}</span>,
  },
  {
    key: 'entregados',
    header: 'Entregados',
    align: 'end',
    shrink: true,
    render: (c) => <span className="u-tabular">{c.entregados}</span>,
  },
  {
    key: 'noShows',
    header: 'No retiró',
    align: 'end',
    shrink: true,
    render: (c) => <span className="u-tabular">{c.noShows}</span>,
  },
  {
    key: 'estado',
    header: 'Estado',
    shrink: true,
    render: (c) => (
      <span className="adm-clientes__estado">
        <ReputacionBadge estado={c.estado} />
        {c.estadoManual && (
          <span className="adm-clientes__manual" title="Estado manual">
            <Icon name="lock" />
            <span className="u-visually-hidden">Estado manual</span>
          </span>
        )}
      </span>
    ),
  },
];

export function ClientesPage() {
  const inputId = useId();
  const [params, setParams] = useSearchParams();
  const qUrl = params.get('q') ?? '';
  const [texto, setTexto] = useState(qUrl);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  // Desde la comanda llega `?q=<teléfono>`: esa ficha se abre sola si aparece en el resultado.
  const [abierto, setAbierto] = useState<string | null>(/^\d{13}$/.test(qUrl) ? qUrl : null);

  const buscado = useDebouncedValue(texto.trim(), DEBOUNCE_MS);
  const q = buscado.length >= Q_MIN ? buscado : '';
  const clientes = useClientes(q);

  // La búsqueda queda en la URL (compartible y con "atrás").
  useEffect(() => {
    setParams(q ? { q } : {}, { replace: true });
  }, [q, setParams]);

  const lista = (clientes.data?.customers ?? []).filter(
    (c) => filtro === 'todos' || c.estado === filtro,
  );
  const seleccionado = clientes.data?.customers.find((c) => c.telefono === abierto);
  const corto = texto.trim().length > 0 && texto.trim().length < Q_MIN;

  let contenido;
  if (clientes.isError) {
    contenido = (
      <ErrorState onRetry={() => void clientes.refetch()} retrying={clientes.isFetching} />
    );
  } else if (!clientes.data) {
    contenido = (
      <div className="l-stack" aria-busy="true" aria-label="Cargando clientes">
        <Skeleton className="adm-clientes__skeleton" />
        <Skeleton className="adm-clientes__skeleton" />
        <Skeleton className="adm-clientes__skeleton" />
      </div>
    );
  } else if (lista.length === 0) {
    contenido = (
      <EmptyState
        title={q || filtro !== 'todos' ? 'No encontramos clientes' : 'Todavía no hay clientes'}
        description={
          q || filtro !== 'todos'
            ? 'Probá con otra búsqueda o sacá el filtro.'
            : 'Se suman solos con cada pedido.'
        }
      />
    );
  } else {
    contenido = (
      <Table
        caption="Clientes"
        columns={COLUMNAS}
        rows={lista}
        rowKey={(c) => c._id}
        onRowClick={(c) => setAbierto(c.telefono)}
      />
    );
  }

  return (
    <section className="adm-clientes">
      <h1>Clientes</h1>

      <div className="adm-clientes__filtros">
        <div className="adm-clientes__busqueda">
          <label htmlFor={inputId} className="u-visually-hidden">
            Buscar por nombre o teléfono
          </label>
          <Icon name="search" />
          <Input
            id={inputId}
            type="search"
            placeholder="Buscar por nombre o teléfono"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-describedby={corto ? `${inputId}-hint` : undefined}
          />
        </div>
        <div className="adm-clientes__chips" role="group" aria-label="Filtrar por estado">
          {FILTROS.map(({ valor, label }) => (
            <Chip key={valor} pressed={filtro === valor} onClick={() => setFiltro(valor)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>
      {corto && (
        <p id={`${inputId}-hint`} className="adm-clientes__hint">
          Escribí al menos {Q_MIN} caracteres.
        </p>
      )}

      {contenido}

      {seleccionado && <ClienteDrawer customer={seleccionado} onClose={() => setAbierto(null)} />}
    </section>
  );
}
