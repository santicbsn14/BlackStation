import { useEffect, useState } from 'react';

/** Instante actual que se refresca cada `intervaloMs`, para textos que dependen de la hora. */
export function useAhora(intervaloMs: number): number {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);

  return ahora;
}
