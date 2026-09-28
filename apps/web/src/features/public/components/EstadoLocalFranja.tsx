import { Skeleton } from '../../../components/Skeleton';
import { useEstadoLocal } from '../hooks/useEstadoLocal';
import './estadoLocalFranja.css';

/** "Abierto · retiros desde 20:30" / "Cerrado · abrimos hoy a las 20:00". */
export function EstadoLocalFranja() {
  const estado = useEstadoLocal();

  if (estado.tipo === 'cargando') return <Skeleton className="pub-estado-local__skeleton" />;
  if (estado.tipo === 'error') {
    return (
      <p className="pub-estado-local" data-local="error">
        No pudimos ver si estamos abiertos.{' '}
        <button type="button" className="pub-estado-local__reintentar" onClick={estado.reintentar}>
          Reintentar
        </button>
      </p>
    );
  }
  return (
    <p className="pub-estado-local" data-local={estado.tipo} role="status">
      {estado.texto}
    </p>
  );
}
