import { EmptyState } from '../../../../components/EmptyState';
import { ErrorState } from '../../../../components/ErrorState';
import { Skeleton } from '../../../../components/Skeleton';
import { useAhora } from '../../../../hooks/useAhora';
import { formatearJornada } from '../../../../lib/hora';
import { useAdminSettings } from '../../hooks/useAdminSettings';
import { FranjaRow } from '../components/FranjaRow';
import { useAdminSlots } from '../hooks/useFranjas';
import './franjasPage.css';

const REFRESCO_MS = 15_000;

/** Cupos y cierre de las franjas de la jornada actual (sin selector de fecha). */
export function FranjasPage() {
  const slots = useAdminSlots();
  const settings = useAdminSettings();
  const ahora = useAhora(REFRESCO_MS);
  const anticipacionMs = (settings.data?.anticipacionMinMin ?? 0) * 60_000;

  let contenido;
  if (slots.isError || settings.isError) {
    contenido = (
      <ErrorState
        onRetry={() => {
          void slots.refetch();
          void settings.refetch();
        }}
        retrying={slots.isFetching || settings.isFetching}
      />
    );
  } else if (!slots.data || !settings.data) {
    contenido = (
      <div className="adm-franjas__lista" aria-busy="true" aria-label="Cargando las franjas">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="adm-franjas__skeleton" />
        ))}
      </div>
    );
  } else if (slots.data.slots.length === 0) {
    contenido = (
      <EmptyState
        title="Hoy no hay franjas"
        description="El local no abre en esta jornada. Los horarios se cambian en Ajustes."
      />
    );
  } else {
    const { fecha } = slots.data;
    contenido = (
      <ul role="list" className="adm-franjas__lista" aria-label="Franjas de retiro">
        {slots.data.slots.map((slot) => {
          const inicio = Date.parse(slot.inicio);
          return (
            <FranjaRow
              key={slot.hora}
              slot={slot}
              fecha={fecha}
              pasada={inicio < ahora}
              sinAnticipacion={inicio < ahora + anticipacionMs}
            />
          );
        })}
      </ul>
    );
  }

  return (
    <section className="adm-franjas">
      <header className="adm-franjas__header">
        <h1>Franjas</h1>
        {slots.data && (
          <p className="adm-franjas__jornada">Jornada {formatearJornada(slots.data.fecha)}</p>
        )}
      </header>
      {contenido}
    </section>
  );
}
