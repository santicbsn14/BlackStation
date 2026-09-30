import { ErrorState } from '../../../../components/ErrorState';
import { Skeleton } from '../../../../components/Skeleton';
import { useAdminSettings } from '../../hooks/useAdminSettings';
import { AjustesFormulario } from '../components/AjustesFormulario';
import './ajustesPage.css';

export function AjustesPage() {
  const settings = useAdminSettings();

  let contenido;
  if (settings.isError && !settings.data) {
    contenido = (
      <ErrorState onRetry={() => void settings.refetch()} retrying={settings.isFetching} />
    );
  } else if (!settings.data) {
    contenido = (
      <div className="adm-ajustes-page__skeleton" aria-busy="true" aria-label="Cargando ajustes">
        <Skeleton className="adm-ajustes-page__skeleton-bloque" />
        <Skeleton className="adm-ajustes-page__skeleton-bloque" />
        <Skeleton className="adm-ajustes-page__skeleton-bloque" />
      </div>
    );
  } else {
    // El formulario arranca con los settings de la carga; después maneja su propia copia.
    contenido = <AjustesFormulario settings={settings.data} />;
  }

  return (
    <section className="adm-ajustes-page">
      <h1>Ajustes</h1>
      {contenido}
    </section>
  );
}
