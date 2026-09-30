import { Button } from './Button';
import { EmptyState } from './EmptyState';
import './errorState.css';

type ErrorStateProps = {
  onRetry: () => void;
  title?: string;
  /** Detalle del error (ej. `error.message`). */
  message?: string;
  /** Spinner en "Reintentar" mientras se vuelve a pedir. */
  retrying?: boolean;
};

/** Error al cargar una pantalla o bloque, con "Reintentar". */
export function ErrorState({
  onRetry,
  title = 'No pudimos cargar los datos',
  message,
  retrying = false,
}: ErrorStateProps) {
  return (
    <div role="alert">
      <EmptyState
        className="error-state"
        icon="alert"
        title={title}
        description={message}
        action={
          <Button variant="secondary" onClick={onRetry} loading={retrying}>
            Reintentar
          </Button>
        }
      />
    </div>
  );
}
