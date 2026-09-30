import { useEffect } from 'react';

/** Título de la pestaña mientras el componente está montado. Al desmontarse, vuelve el anterior. */
export function useDocumentTitle(titulo: string) {
  useEffect(() => {
    const previo = document.title;
    document.title = titulo;
    return () => {
      document.title = previo;
    };
  }, [titulo]);
}
