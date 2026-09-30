import { formatearPrecio, type Category, type Extra, type Product } from '@blackstation/shared';
import { useState } from 'react';
import { Button } from '../../../../components/Button';
import { EmptyState } from '../../../../components/EmptyState';
import { Icon } from '../../../../components/Icon';
import { Switch } from '../../../../components/Switch';
import { Table, type TableColumn } from '../../../../components/Table';
import { agruparProductos } from '../catalogo';
import { useProductMutations, useSwapOrden } from '../hooks/useCatalogoMutations';
import { CatalogoToolbar } from './CatalogoToolbar';
import { DesactivarModal } from './DesactivarModal';
import { FlechasOrden } from './FlechasOrden';
import { ProductoDrawer } from './ProductoDrawer';

type ProductosTabProps = {
  products: Product[];
  categories: Category[];
  extras: Extra[];
  mostrarInactivos: boolean;
  onMostrarInactivos: (valor: boolean) => void;
};

/** `null`: cerrado; `'nuevo'`: alta; si no, el producto que se edita. */
type Edicion = null | 'nuevo' | Product;

export function ProductosTab({
  products,
  categories,
  extras,
  mostrarInactivos,
  onMostrarInactivos,
}: ProductosTabProps) {
  const { desactivar, reactivar, disponible } = useProductMutations();
  const swap = useSwapOrden('product');
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [aDesactivar, setADesactivar] = useState<Product | null>(null);
  const grupos = agruparProductos(categories, products, mostrarInactivos);
  const hayProductos = grupos.some((g) => g.productos.length > 0);

  function columnas(lista: Product[]): TableColumn<Product>[] {
    return [
      {
        key: 'foto',
        header: <span className="u-visually-hidden">Foto</span>,
        shrink: true,
        render: (p) =>
          p.fotoUrl ? (
            <img className="adm-catalogo__foto" src={p.fotoUrl} alt="" />
          ) : (
            <span className="adm-catalogo__foto adm-catalogo__foto--vacia" aria-hidden="true">
              <Icon name="image" />
            </span>
          ),
      },
      {
        key: 'nombre',
        header: 'Nombre',
        render: (p) => (
          <span className="adm-catalogo__nombre">
            {p.nombre}
            {!p.activo && <span className="adm-catalogo__inactivo">Inactivo</span>}
          </span>
        ),
      },
      {
        key: 'precio',
        header: 'Precio',
        align: 'end',
        shrink: true,
        render: (p) => <span className="u-tabular">{formatearPrecio(p.precio)}</span>,
      },
      {
        key: 'disponible',
        header: 'Disponible',
        shrink: true,
        render: (p) => (
          <Switch
            label={`${p.nombre} disponible`}
            hideLabel
            checked={p.disponible}
            disabled={disponible.isPending && disponible.variables.id === p._id}
            onChange={(valor) => disponible.mutate({ id: p._id, disponible: valor })}
          />
        ),
      },
      {
        key: 'orden',
        header: 'Orden',
        shrink: true,
        render: (p) => {
          const i = lista.indexOf(p);
          return (
            <FlechasOrden
              nombre={p.nombre}
              esPrimero={i === 0}
              esUltimo={i === lista.length - 1}
              disabled={swap.isPending}
              onMover={(dir) => swap.mutate({ lista, desde: i, hacia: i + dir })}
            />
          );
        },
      },
      {
        key: 'acciones',
        header: <span className="u-visually-hidden">Acciones</span>,
        align: 'end',
        shrink: true,
        render: (p) =>
          p.activo ? (
            <Button variant="ghost" onClick={() => setADesactivar(p)}>
              Desactivar
            </Button>
          ) : (
            <Button
              onClick={() => reactivar.mutate(p._id)}
              loading={reactivar.isPending && reactivar.variables === p._id}
            >
              Reactivar
            </Button>
          ),
      },
    ];
  }

  return (
    <div className="adm-catalogo__panel">
      <CatalogoToolbar
        mostrarInactivos={mostrarInactivos}
        onMostrarInactivos={onMostrarInactivos}
        nuevo="Nuevo producto"
        onNuevo={() => setEdicion('nuevo')}
      />

      {!hayProductos ? (
        <EmptyState
          title="Todavía no hay productos"
          description="Cargá el primero con “Nuevo producto”."
        />
      ) : (
        grupos.map(({ categoria, productos }) => (
          <section key={categoria?._id ?? 'sin-categoria'} className="adm-catalogo__grupo">
            <h2 className="adm-catalogo__grupo-titulo">
              {categoria?.nombre ?? 'Sin categoría'}
              {categoria && !categoria.activa && (
                <span className="adm-catalogo__inactivo">Categoría inactiva</span>
              )}
            </h2>
            {productos.length === 0 ? (
              <p className="adm-catalogo__vacio">Sin productos en esta categoría.</p>
            ) : (
              <Table
                caption={`Productos de ${categoria?.nombre ?? 'sin categoría'}`}
                columns={columnas(productos)}
                rows={productos}
                rowKey={(p) => p._id}
                onRowClick={(p) => setEdicion(p)}
                isRowInactive={(p) => !p.activo}
              />
            )}
          </section>
        ))
      )}

      {edicion && (
        <ProductoDrawer
          product={edicion === 'nuevo' ? null : edicion}
          categories={categories}
          extras={extras}
          products={products}
          onClose={() => setEdicion(null)}
        />
      )}
      {aDesactivar && (
        <DesactivarModal
          que={`el producto “${aDesactivar.nombre}”`}
          detalle="Deja de verse en el catálogo."
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
