import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../../components/Button';
import { Chip } from '../../../../components/Chip';
import { Skeleton } from '../../../../components/Skeleton';
import { EstadoLocalFranja } from '../../components/EstadoLocalFranja';
import { useCatalog } from '../../hooks/useCatalog';
import { PedidoEnCursoBanner } from '../components/PedidoEnCursoBanner';
import { ProductoCard } from '../components/ProductoCard';
import { useScrollSpy } from '../hooks/useScrollSpy';
import './catalogoPage.css';

const seccionId = (categoriaId: string) => `categoria-${categoriaId}`;

export function CatalogoPage() {
  const { data, isPending, isError, refetch } = useCatalog();
  const categorias = (data?.categories ?? []).filter((c) => c.products.length > 0);

  return (
    <div className="pub-catalogo">
      <div className="pub-catalogo__avisos">
        <EstadoLocalFranja />
        <PedidoEnCursoBanner />
      </div>

      <h1 className="u-visually-hidden">Menú</h1>

      {isPending ? (
        <CatalogoSkeleton />
      ) : isError && !data ? (
        <div className="pub-catalogo__mensaje l-stack" role="alert">
          <p>No pudimos cargar el menú.</p>
          <Button variant="primary" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : categorias.length === 0 ? (
        <p className="pub-catalogo__mensaje">Todavía no hay productos cargados</p>
      ) : (
        <>
          <CategoriaChips categorias={categorias} />
          {categorias.map((categoria) => (
            <section
              key={categoria._id}
              id={seccionId(categoria._id)}
              className="pub-catalogo__seccion"
              aria-labelledby={`${seccionId(categoria._id)}-titulo`}
            >
              <h2 id={`${seccionId(categoria._id)}-titulo`}>{categoria.nombre}</h2>
              <ul role="list" className="pub-catalogo__grid">
                {categoria.products.map((producto) => (
                  <ProductoCard key={producto._id} producto={producto} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function CategoriaChips({ categorias }: { categorias: { _id: string; nombre: string }[] }) {
  const barraRef = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);
  const ids = categorias.map((c) => seccionId(c._id));
  const activo = useScrollSpy(ids, offset);

  // Lo sticky (header + chips) tapa el borde de arriba: el scroll-spy mira justo debajo.
  useEffect(() => {
    const barra = barraRef.current;
    if (!barra) return;
    // Dispara también al empezar a observar.
    const observer = new ResizeObserver(() => {
      const top = Number.parseFloat(getComputedStyle(barra).top) || 0;
      setOffset(Math.round(top + barra.offsetHeight));
    });
    observer.observe(barra);
    return () => observer.disconnect();
  }, []);

  // El chip activo siempre visible dentro de la barra (sin mover el scroll de la página).
  useEffect(() => {
    const barra = barraRef.current;
    const chip = activo ? barra?.querySelector<HTMLElement>(`[data-seccion="${activo}"]`) : null;
    if (!barra || !chip) return;
    barra.scrollTo({
      left: chip.offsetLeft - barra.clientWidth / 2 + chip.offsetWidth / 2,
      behavior: 'smooth',
    });
  }, [activo]);

  function irA(id: string) {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' });
  }

  return (
    <nav ref={barraRef} className="pub-catalogo__chips" aria-label="Categorías">
      {categorias.map((c, i) => {
        const id = seccionId(c._id);
        const esActivo = activo ? activo === id : i === 0;
        return (
          <Chip
            key={c._id}
            data-seccion={id}
            active={esActivo}
            aria-current={esActivo ? 'true' : undefined}
            onClick={() => irA(id)}
          >
            {c.nombre}
          </Chip>
        );
      })}
    </nav>
  );
}

function CatalogoSkeleton() {
  return (
    <div className="l-stack l-stack--lg" aria-busy="true" aria-label="Cargando el menú">
      {[0, 1].map((s) => (
        <div key={s} className="l-stack">
          <Skeleton className="pub-catalogo__skeleton-titulo" />
          <div className="pub-catalogo__grid">
            {[0, 1, 2].map((f) => (
              <Skeleton key={f} className="pub-catalogo__skeleton-fila" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
