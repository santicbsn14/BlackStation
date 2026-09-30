import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ErrorState } from '../../../../components/ErrorState';
import { Skeleton } from '../../../../components/Skeleton';
import { TABS, TITULO_TAB, type Tab } from '../catalogo';
import { CategoriasTab } from '../components/CategoriasTab';
import { ExtrasTab } from '../components/ExtrasTab';
import { ProductosTab } from '../components/ProductosTab';
import { useAdminCategories, useAdminExtras, useAdminProducts } from '../hooks/useCatalogoAdmin';
import './adminCatalogoPage.css';

const esTab = (valor: string | null): valor is Tab =>
  valor !== null && (TABS as readonly string[]).includes(valor);

export function AdminCatalogoPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = esTab(tabParam) ? tabParam : 'productos';
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const categories = useAdminCategories();
  const products = useAdminProducts();
  const extras = useAdminExtras();
  const queries = [categories, products, extras];
  const error = queries.some((q) => q.isError);

  function cambiarTab(nueva: Tab) {
    setParams(nueva === 'productos' ? {} : { tab: nueva }, { replace: true });
  }

  let contenido;
  if (error) {
    contenido = (
      <ErrorState
        onRetry={() => queries.forEach((q) => void q.refetch())}
        retrying={queries.some((q) => q.isFetching)}
      />
    );
  } else if (!categories.data || !products.data || !extras.data) {
    contenido = (
      <div className="adm-catalogo__panel" aria-busy="true" aria-label="Cargando el catálogo">
        <Skeleton className="adm-catalogo__skeleton-toolbar" />
        <Skeleton className="adm-catalogo__skeleton-tabla" />
        <Skeleton className="adm-catalogo__skeleton-tabla" />
      </div>
    );
  } else {
    const props = { mostrarInactivos, onMostrarInactivos: setMostrarInactivos };
    contenido =
      tab === 'productos' ? (
        <ProductosTab
          products={products.data.products}
          categories={categories.data.categories}
          extras={extras.data.extras}
          {...props}
        />
      ) : tab === 'categorias' ? (
        <CategoriasTab
          categories={categories.data.categories}
          products={products.data.products}
          {...props}
        />
      ) : (
        <ExtrasTab extras={extras.data.extras} {...props} />
      );
  }

  return (
    <section className="adm-catalogo">
      <h1>Catálogo</h1>
      <div className="adm-catalogo__tabs" role="tablist" aria-label="Secciones del catálogo">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`catalogo-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="catalogo-panel"
            className={`adm-catalogo__tab${tab === t ? ' is-active' : ''}`}
            onClick={() => cambiarTab(t)}
          >
            {TITULO_TAB[t]}
          </button>
        ))}
      </div>
      <div id="catalogo-panel" role="tabpanel" aria-labelledby={`catalogo-tab-${tab}`}>
        {contenido}
      </div>
    </section>
  );
}
