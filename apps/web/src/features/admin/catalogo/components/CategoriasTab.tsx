import type { Category, Product } from '@blackstation/shared';
import { useState } from 'react';
import { EmptyState } from '../../../../components/EmptyState';
import { Switch } from '../../../../components/Switch';
import { Table, type TableColumn } from '../../../../components/Table';
import { porOrden } from '../catalogo';
import { useCategoryMutations, useSwapOrden } from '../hooks/useCatalogoMutations';
import { CatalogoToolbar } from './CatalogoToolbar';
import { CategoriaModal } from './CategoriaModal';
import { DesactivarModal } from './DesactivarModal';
import { FlechasOrden } from './FlechasOrden';

type CategoriasTabProps = {
  categories: Category[];
  products: Product[];
  mostrarInactivos: boolean;
  onMostrarInactivos: (valor: boolean) => void;
};

type Edicion = null | 'nueva' | Category;

export function CategoriasTab({
  categories,
  products,
  mostrarInactivos,
  onMostrarInactivos,
}: CategoriasTabProps) {
  const { desactivar, reactivar } = useCategoryMutations();
  const swap = useSwapOrden('category');
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [aDesactivar, setADesactivar] = useState<Category | null>(null);
  const lista = [...categories].sort(porOrden).filter((c) => mostrarInactivos || c.activa);

  const columnas: TableColumn<Category>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (c) => {
        const cantidad = products.filter((p) => p.categoriaId === c._id && p.activo).length;
        return (
          <span className="adm-catalogo__nombre">
            {c.nombre}
            <span className="adm-catalogo__detalle">
              {cantidad === 1 ? '1 producto' : `${cantidad} productos`}
            </span>
          </span>
        );
      },
    },
    {
      key: 'activa',
      header: 'Activa',
      shrink: true,
      render: (c) => (
        <Switch
          label={`${c.nombre} activa`}
          hideLabel
          checked={c.activa}
          disabled={reactivar.isPending && reactivar.variables === c._id}
          // Apagar pide confirmación; prender (reactivar) aplica directo.
          onChange={(valor) => (valor ? reactivar.mutate(c._id) : setADesactivar(c))}
        />
      ),
    },
    {
      key: 'orden',
      header: 'Orden',
      shrink: true,
      render: (c) => {
        const i = lista.indexOf(c);
        return (
          <FlechasOrden
            nombre={c.nombre}
            esPrimero={i === 0}
            esUltimo={i === lista.length - 1}
            disabled={swap.isPending}
            onMover={(dir) => swap.mutate({ lista, desde: i, hacia: i + dir })}
          />
        );
      },
    },
  ];

  return (
    <div className="adm-catalogo__panel">
      <CatalogoToolbar
        mostrarInactivos={mostrarInactivos}
        onMostrarInactivos={onMostrarInactivos}
        nuevo="Nueva categoría"
        onNuevo={() => setEdicion('nueva')}
      />
      {lista.length === 0 ? (
        <EmptyState title="Todavía no hay categorías" />
      ) : (
        <Table
          caption="Categorías"
          columns={columnas}
          rows={lista}
          rowKey={(c) => c._id}
          onRowClick={(c) => setEdicion(c)}
          isRowInactive={(c) => !c.activa}
        />
      )}

      {edicion && (
        <CategoriaModal
          category={edicion === 'nueva' ? null : edicion}
          categories={categories}
          onClose={() => setEdicion(null)}
        />
      )}
      {aDesactivar && (
        <DesactivarModal
          que={`la categoría “${aDesactivar.nombre}”`}
          detalle="Ella y sus productos dejan de verse en el catálogo."
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
