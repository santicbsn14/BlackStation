import './skeleton.css';

/** Bloque de carga. El tamaño lo da la clase de la pantalla que lo usa. */
export function Skeleton({ className }: { className?: string }) {
  return <span className={['skeleton', className].filter(Boolean).join(' ')} aria-hidden="true" />;
}
