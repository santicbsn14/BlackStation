import { formatearPrecio } from '@blackstation/shared';
import { useCatalog } from '../hooks/useCatalog';

export function CatalogoPage() {
  const { data, isPending, error } = useCatalog();

  return (
    <section className="l-stack">
      <h1>Catálogo</h1>
      <p>Placeholder: la pantalla real y el carrito llegan en la Etapa 03.</p>
      {isPending && <p>Cargando…</p>}
      {error && <p role="alert">{error.message}</p>}
      {data?.categories.map((categoria) => (
        <div key={categoria._id} className="l-stack l-stack--sm">
          <h2>{categoria.nombre}</h2>
          <ul>
            {categoria.products.map((producto) => (
              <li key={producto._id}>
                {producto.nombre} —{' '}
                <span className="u-tabular">{formatearPrecio(producto.precio)}</span>
                {!producto.disponible && ' (Agotado)'}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
