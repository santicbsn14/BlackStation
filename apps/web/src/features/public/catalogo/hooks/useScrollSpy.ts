import { useEffect, useState } from 'react';

/**
 * Id de la sección que está arriba de todo, debajo de lo sticky (`offsetPx`).
 * Mientras ninguna cruza la línea, queda la última activa.
 */
export function useScrollSpy(ids: string[], offsetPx: number): string | null {
  const [activo, setActivo] = useState<string | null>(null);
  const clave = ids.join('|');

  useEffect(() => {
    const secciones = clave
      .split('|')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (secciones.length === 0) return;

    const visibles = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visibles.add(entry.target.id);
          else visibles.delete(entry.target.id);
        }
        const primera = secciones.find((s) => visibles.has(s.id));
        if (primera) setActivo(primera.id);
      },
      // Franja angosta justo debajo de lo sticky: la sección que la cruza es la activa.
      { rootMargin: `-${offsetPx}px 0px -60% 0px` },
    );
    for (const s of secciones) observer.observe(s);
    return () => observer.disconnect();
  }, [clave, offsetPx]);

  return activo;
}
