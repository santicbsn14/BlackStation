import { calcularSubtotal, formatearPrecio, type CatalogProduct } from '@blackstation/shared';
import { useId, useState } from 'react';
import { Button } from '../../../../components/Button';
import { Chip } from '../../../../components/Chip';
import { Drawer } from '../../../../components/Drawer';
import { Stepper } from '../../../../components/Stepper';
import { useToast } from '../../../../components/Toast';
import { buscarProducto, type CartLine } from '../../carrito/cart';
import { useCart } from '../../carrito/hooks/useCart';
import { useCatalog } from '../../hooks/useCatalog';
import { useProductoSheet } from '../../hooks/useProductoSheet';
import './productoSheet.css';

/** Detalle de producto: se monta desde el layout y se abre con `?producto=<id>`. */
export function ProductoSheet() {
  const { productoId, linea } = useProductoSheet();
  const { lineas } = useCart();
  const { data: catalogo } = useCatalog();

  if (!productoId) return null;
  const producto = buscarProducto(catalogo, productoId);
  if (!producto?.disponible) return null;

  // Modo edición solo si la línea sigue siendo de este producto.
  const editando = linea !== null && lineas[linea]?.productoId === productoId ? linea : null;
  const inicial = editando === null ? undefined : lineas[editando];

  // `key` por producto: al guardar una edición la línea puede fusionarse y cambiar de índice
  // antes de que se cierre el sheet, y eso no debe remontarlo.
  return (
    <ProductoSheetAbierto
      key={productoId}
      producto={producto}
      editando={editando}
      inicial={inicial}
    />
  );
}

type AbiertoProps = {
  producto: CatalogProduct;
  editando: number | null;
  inicial: CartLine | undefined;
};

function ProductoSheetAbierto({ producto, editando: editandoProp, inicial }: AbiertoProps) {
  // Fijo desde que se abre: no cambia aunque la línea se mueva al guardar.
  const [editando] = useState(editandoProp);
  const tituloId = useId();
  const toast = useToast();
  const { cerrar } = useProductoSheet();
  const { agregar, reemplazar } = useCart();

  const [cantidad, setCantidad] = useState(inicial?.cantidad ?? 1);
  const [quitados, setQuitados] = useState<string[]>(inicial?.quitados ?? []);
  const [extras, setExtras] = useState<Record<string, number>>(() =>
    Object.fromEntries((inicial?.extras ?? []).map((e) => [e.extraId, e.cantidad])),
  );

  const extrasElegidos = producto.extras.flatMap((e) => {
    const n = Math.min(extras[e._id] ?? 0, e.cantidadMax);
    return n > 0 ? [{ extraId: e._id, precio: e.precio, cantidad: n }] : [];
  });
  const precio = calcularSubtotal({
    precioUnitario: producto.precio,
    cantidad,
    extras: extrasElegidos,
  });

  function toggleQuitado(ingrediente: string) {
    setQuitados((actual) =>
      actual.includes(ingrediente)
        ? actual.filter((q) => q !== ingrediente)
        : [...actual, ingrediente],
    );
  }

  function setExtra(extraId: string, n: number) {
    setExtras((actual) => ({ ...actual, [extraId]: n }));
  }

  function confirmar() {
    const linea: CartLine = {
      productoId: producto._id,
      cantidad,
      quitados,
      extras: extrasElegidos.map(({ extraId, cantidad: n }) => ({ extraId, cantidad: n })),
    };
    if (editando === null) {
      agregar(linea);
      toast('Agregado al carrito');
    } else {
      reemplazar(editando, linea);
    }
    cerrar();
  }

  const footer = (
    <div className="pub-producto__footer">
      <Stepper
        label={`Cantidad de ${producto.nombre}`}
        value={cantidad}
        min={1}
        onChange={setCantidad}
      />
      <Button variant="primary" className="pub-producto__confirmar" onClick={confirmar}>
        {editando === null ? 'Agregar' : 'Guardar cambios'} ·{' '}
        <span className="u-tabular">{formatearPrecio(precio)}</span>
      </Button>
    </div>
  );

  return (
    <Drawer side="bottom" labelledBy={tituloId} onClose={cerrar} footer={footer}>
      <div className="pub-producto">
        {producto.fotoUrl && <img className="pub-producto__foto" src={producto.fotoUrl} alt="" />}
        <div className="pub-producto__cabecera">
          <h2 id={tituloId} className="pub-producto__nombre">
            {producto.nombre}
          </h2>
          {producto.descripcion && (
            <p className="pub-producto__descripcion">{producto.descripcion}</p>
          )}
          <p className="pub-producto__precio u-tabular">{formatearPrecio(producto.precio)}</p>
        </div>

        {producto.ingredientesQuitables.length > 0 && (
          <section className="pub-producto__seccion" aria-labelledby={`${tituloId}-quitar`}>
            <h3 id={`${tituloId}-quitar`}>¿Le sacamos algo?</h3>
            <div className="pub-producto__chips">
              {producto.ingredientesQuitables.map((ingrediente) => {
                const quitado = quitados.includes(ingrediente);
                return (
                  <Chip
                    key={ingrediente}
                    pressed={quitado}
                    className="pub-producto__quitable"
                    onClick={() => toggleQuitado(ingrediente)}
                  >
                    {quitado ? `Sin ${ingrediente}` : ingrediente}
                  </Chip>
                );
              })}
            </div>
          </section>
        )}

        {producto.extras.length > 0 && (
          <section className="pub-producto__seccion" aria-labelledby={`${tituloId}-extras`}>
            <h3 id={`${tituloId}-extras`}>Agregale</h3>
            <ul role="list" className="pub-producto__extras">
              {producto.extras.map((extra) => {
                const n = extras[extra._id] ?? 0;
                const texto = (
                  <span className="pub-producto__extra-texto">
                    <span>{extra.nombre}</span>
                    <span className="pub-producto__extra-precio u-tabular">
                      +{formatearPrecio(extra.precio)}
                    </span>
                  </span>
                );
                return (
                  <li key={extra._id}>
                    {extra.cantidadMax === 1 ? (
                      <button
                        type="button"
                        className="pub-producto__extra pub-producto__extra--toggle"
                        aria-pressed={n > 0}
                        onClick={() => setExtra(extra._id, n > 0 ? 0 : 1)}
                      >
                        {texto}
                        <span className="pub-producto__check" aria-hidden="true" />
                      </button>
                    ) : (
                      <div className="pub-producto__extra">
                        {texto}
                        <Stepper
                          label={`Cantidad de ${extra.nombre}`}
                          value={n}
                          min={0}
                          max={extra.cantidadMax}
                          onChange={(valor) => setExtra(extra._id, valor)}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </Drawer>
  );
}
