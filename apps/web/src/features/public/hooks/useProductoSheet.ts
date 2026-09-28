import { useLocation, useNavigate, useSearchParams } from 'react-router';

type SheetState = { sheet?: boolean } | null;

/**
 * El detalle de producto vive en la URL (`?producto=<id>`, y `&linea=<n>` en modo edición):
 * abrirlo agrega una entrada al historial para que el botón atrás lo cierre.
 */
export function useProductoSheet() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const productoId = params.get('producto');
  const lineaParam = params.get('linea');
  const linea = lineaParam !== null && /^\d+$/.test(lineaParam) ? Number(lineaParam) : null;

  function conParams(cambiar: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(location.search);
    cambiar(next);
    const search = next.toString();
    return { pathname: location.pathname, search: search ? `?${search}` : '' };
  }

  function abrir(id: string, lineaIndex?: number) {
    const to = conParams((p) => {
      p.set('producto', id);
      if (lineaIndex === undefined) p.delete('linea');
      else p.set('linea', String(lineaIndex));
    });
    void navigate(to, { state: { sheet: true }, preventScrollReset: true });
  }

  function cerrar() {
    // Si lo abrimos nosotros, volver atrás deja el historial como estaba.
    if ((location.state as SheetState)?.sheet) {
      void navigate(-1);
      return;
    }
    const to = conParams((p) => {
      p.delete('producto');
      p.delete('linea');
    });
    void navigate(to, { replace: true, preventScrollReset: true });
  }

  return { productoId, linea, abrir, cerrar };
}
