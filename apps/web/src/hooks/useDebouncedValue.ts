import { useEffect, useState } from 'react';

/** `valor` después de `ms` sin cambios (búsquedas, para no pedir en cada tecla). */
export function useDebouncedValue<T>(valor: T, ms: number): T {
  const [demorado, setDemorado] = useState(valor);

  useEffect(() => {
    const timer = setTimeout(() => setDemorado(valor), ms);
    return () => clearTimeout(timer);
  }, [valor, ms]);

  return demorado;
}
