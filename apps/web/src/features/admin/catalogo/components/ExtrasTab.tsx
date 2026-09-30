import { formatearPrecio, type Extra } from '@blackstation/shared';
import { useState } from 'react';
import { Button } from '../../../../components/Button';
import { EmptyState } from '../../../../components/EmptyState';
import { Switch } from '../../../../components/Switch';
import { Table, type TableColumn } from '../../../../components/Table';
import { useExtraMutations } from '../hooks/useCatalogoMutations';
import { CatalogoToolbar } from './CatalogoToolbar';
import { DesactivarModal } from './DesactivarModal';
import { ExtraModal } from './ExtraModal';

type ExtrasTabProps = {
  extras: Extra[];
  mostrarInactivos: boolean;
  onMostrarInactivos: (valor: boolean) => void;
};

type Edicion = null | 'nuevo' | Extra;

const porNombre = (a: Extra, b: Extra) => a.nombre.localeCompare(b.nombre, 'es');

export function ExtrasTab({ extras, mostrarInactivos, onMostrarInactivos }: ExtrasTabProps) {
  const { desactivar, reactivar, disponible } = useExtraMutations();
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [aDesactivar, setADesactivar] = useState<Extra | null>(null);
  const lista = extras.filter((e) => mostrarInactivos || e.activo).sort(porNombre);

  const columnas: TableColumn<Extra>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (e) => (
        <span className="adm-catalogo__nombre">
          {e.nombre}
          {!e.activo && <span className="adm-catalogo__inactivo">Inactivo</span>}
        </span>
      ),
    },
    {
      key: 'precio',
      header: 'Precio',
      align: 'end',
      shrink: true,
      render: (e) => <span className="u-tabular">{formatearPrecio(e.precio)}</span>,
    },
    {
      key: 'max',
      header: 'Máx.',
      align: 'end',
      shrink: true,
      render: (e) => <span className="u-tabular">{e.cantidadMax}</span>,
    },
    {
      key: 'disponible',
      header: 'Disponible',
      shrink: true,
      render: (e) => (
        <Switch
          label={`${e.nombre} disponible`}
          hideLabel
          checked={e.disponible}
          disabled={disponible.isPending && disponible.variables.id === e._id}
          onChange={(valor) => disponible.mutate({ id: e._id, disponible: valor })}
        />
      ),
    },
    {
      key: 'acciones',
      header: <span className="u-visually-hidden">Acciones</span>,
      align: 'end',
      shrink: true,
      render: (e) =>
        e.activo ? (
          <Button variant="ghost" onClick={() => setADesactivar(e)}>
            Desactivar
          </Button>
        ) : (
          <Button
            onClick={() => reactivar.mutate(e._id)}
            loading={reactivar.isPending && reactivar.variables === e._id}
          >
            Reactivar
          </Button>
        ),
    },
  ];

  return (
    <div className="adm-catalogo__panel">
      <CatalogoToolbar
        mostrarInactivos={mostrarInactivos}
        onMostrarInactivos={onMostrarInactivos}
        nuevo="Nuevo extra"
        onNuevo={() => setEdicion('nuevo')}
      />
      {lista.length === 0 ? (
        <EmptyState title="Todavía no hay extras" />
      ) : (
        <Table
          caption="Extras"
          columns={columnas}
          rows={lista}
          rowKey={(e) => e._id}
          onRowClick={(e) => setEdicion(e)}
          isRowInactive={(e) => !e.activo}
        />
      )}

      {edicion && (
        <ExtraModal extra={edicion === 'nuevo' ? null : edicion} onClose={() => setEdicion(null)} />
      )}
      {aDesactivar && (
        <DesactivarModal
          que={`el extra “${aDesactivar.nombre}”`}
          detalle="Deja de ofrecerse en los productos."
          cargando={desactivar.isPending}
          onClose={() => setADesactivar(null)}
          onConfirmar={() =>
            desactivar.mutate(aDesactivar._id, { onSuccess: () => setADesactivar(null) })
          }
        />
      )}
    </div>
  );
}
