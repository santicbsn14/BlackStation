import { useMemo, useState } from 'react';
import { EmptyState } from '../../../../components/EmptyState';
import { ErrorState } from '../../../../components/ErrorState';
import { Icon } from '../../../../components/Icon';
import { Skeleton } from '../../../../components/Skeleton';
import { useDocumentTitle } from '../../../../hooks/useDocumentTitle';
import { horaLocal } from '../../../../lib/hora';
import { COLUMNAS, TITULO_COLUMNA, abreDeJornada, armarComanda, type Columna } from '../comanda';
import { ComandaHeader } from '../components/ComandaHeader';
import { OrderCard } from '../components/OrderCard';
import { OrderDrawer } from '../components/OrderDrawer';
import { useAdminSettings } from '../../hooks/useAdminSettings';
import { useComanda } from '../hooks/useComanda';
import { useJornadaActual } from '../hooks/useJornadaActual';
import { useSonidoComanda } from '../hooks/useSonidoComanda';
import './comandaPage.css';

export function ComandaPage() {
  const settingsQuery = useAdminSettings();
  const settings = settingsQuery.data;
  const jornada = useJornadaActual(settings);
  const sonido = useSonidoComanda();
  const comanda = useComanda(jornada?.fecha, { onNuevos: sonido.beep });
  const [tab, setTab] = useState<Columna>('pendientes');
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  const cantidadNuevos = comanda.nuevos.size;
  useDocumentTitle(cantidadNuevos > 0 ? `(${cantidadNuevos}) Comanda` : 'Comanda');

  const abre = settings && jornada ? abreDeJornada(settings.horarios, jornada.fecha) : null;
  const columnas = useMemo(
    () => (comanda.orders ? armarComanda(comanda.orders, abre) : null),
    [comanda.orders, abre],
  );
  // El detalle lee el pedido de la comanda: se actualiza en vivo con cada polling.
  const abierto = abiertoId ? comanda.orders?.find((o) => o._id === abiertoId) : undefined;

  function abrir(id: string) {
    comanda.marcarVisto(id);
    setAbiertoId(id);
  }

  let contenido;
  if (settingsQuery.isError) {
    contenido = (
      <ErrorState
        onRetry={() => void settingsQuery.refetch()}
        retrying={settingsQuery.isFetching}
      />
    );
  } else if (!columnas && comanda.isError) {
    contenido = <ErrorState onRetry={() => void comanda.refetch()} retrying={comanda.isFetching} />;
  } else if (!columnas || !comanda.orders) {
    contenido = <ComandaSkeleton />;
  } else if (comanda.orders.length === 0) {
    contenido = (
      <EmptyState
        title="Todavía no entraron pedidos hoy"
        description="Los pedidos nuevos aparecen acá solos, con aviso sonoro."
      />
    );
  } else {
    contenido = (
      <>
        <div className="adm-comanda__tabs" role="tablist" aria-label="Columnas de la comanda">
          {COLUMNAS.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              id={`comanda-tab-${c}`}
              aria-selected={tab === c}
              aria-controls={`comanda-col-${c}`}
              className={`adm-comanda__tab${tab === c ? ' is-active' : ''}`}
              onClick={() => setTab(c)}
            >
              {TITULO_COLUMNA[c]}
              <span className="adm-comanda__count u-tabular">{columnas[c].length}</span>
            </button>
          ))}
        </div>
        <div className="adm-comanda__columnas">
          {COLUMNAS.map((c) => (
            <section
              key={c}
              id={`comanda-col-${c}`}
              role="tabpanel"
              aria-labelledby={`comanda-titulo-${c}`}
              className={`adm-comanda__columna adm-comanda__columna--${c}${tab === c ? ' is-active' : ''}`}
            >
              <h2 id={`comanda-titulo-${c}`} className="adm-comanda__titulo">
                {TITULO_COLUMNA[c]}
                <span className="adm-comanda__count u-tabular">{columnas[c].length}</span>
              </h2>
              {columnas[c].length > 0 ? (
                <ul role="list" className="adm-comanda__lista">
                  {columnas[c].map((order) => (
                    <li key={order._id}>
                      <OrderCard
                        order={order}
                        settings={settings}
                        nuevo={comanda.nuevos.has(order._id)}
                        onAbrir={abrir}
                        onVisto={comanda.marcarVisto}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="adm-comanda__vacia">Sin pedidos</p>
              )}
            </section>
          ))}
        </div>
      </>
    );
  }

  return (
    <section className="adm-comanda">
      <ComandaHeader
        jornada={jornada}
        settings={settings}
        sonidoActivo={sonido.activo}
        onAlternarSonido={sonido.alternar}
      />

      {sonido.bloqueado && (
        <button type="button" className="adm-comanda__aviso" onClick={sonido.activar}>
          <Icon name="bell" />
          Tocá para activar el sonido
        </button>
      )}
      {comanda.isError && columnas && (
        <p className="adm-comanda__offline" role="status">
          <Icon name="wifiOff" />
          Sin conexión, reintentando… (última actualización {horaLocal(comanda.actualizadoAt)})
        </p>
      )}

      {contenido}

      {abierto && (
        <OrderDrawer order={abierto} settings={settings} onClose={() => setAbiertoId(null)} />
      )}
    </section>
  );
}

function ComandaSkeleton() {
  return (
    <div className="adm-comanda__columnas" aria-busy="true" aria-label="Cargando la comanda">
      {COLUMNAS.map((c) => (
        <div
          key={c}
          className={`adm-comanda__columna adm-comanda__columna--${c}${c === 'pendientes' ? ' is-active' : ''}`}
        >
          <Skeleton className="adm-comanda__skeleton-titulo" />
          <Skeleton className="adm-comanda__skeleton-card" />
          <Skeleton className="adm-comanda__skeleton-card" />
        </div>
      ))}
    </div>
  );
}
