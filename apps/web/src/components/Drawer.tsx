import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import './drawer.css';

type DrawerProps = {
  /** `bottom`: bottom sheet en mobile y modal centrado en md. `right`: panel lateral. */
  side: 'bottom' | 'right';
  onClose: () => void;
  /** Título visible en la cabecera. Sin título, el diálogo se rotula con `labelledBy`. */
  title?: string;
  labelledBy?: string;
  footer?: ReactNode;
  children: ReactNode;
};

const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Drawers abiertos, del más viejo al más nuevo: solo el de arriba responde a Esc y atrapa el foco.
const pila: symbol[] = [];

function actualizarFondo() {
  const root = document.getElementById('root');
  if (root) root.inert = pila.length > 0;
}

/** Se monta abierto: el que lo usa decide cuándo renderizarlo. */
export function Drawer({ side, onClose, title, labelledBy, footer, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const tituloId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const yo = Symbol('drawer');
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pila.push(yo);
    actualizarFondo();
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (pila.at(-1) !== yo) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (event.key !== 'Tab' || !panel) return;
      const focusables = [...panel.querySelectorAll<HTMLElement>(FOCUSABLES)];
      const primero = focusables[0];
      const ultimo = focusables.at(-1);
      if (!primero || !ultimo) {
        event.preventDefault();
        return;
      }
      const activo = document.activeElement;
      if (event.shiftKey && (activo === primero || activo === panel)) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && activo === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      pila.splice(pila.indexOf(yo), 1);
      actualizarFondo();
      if (previo?.isConnected) previo.focus();
    };
  }, []);

  return createPortal(
    <div className={`drawer drawer--${side}`}>
      <div className="drawer__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? tituloId : labelledBy}
        tabIndex={-1}
      >
        {title ? (
          <header className="drawer__header">
            <h2 id={tituloId} className="drawer__title">
              {title}
            </h2>
            <button type="button" className="drawer__close" onClick={onClose} aria-label="Cerrar">
              <Icon name="close" />
            </button>
          </header>
        ) : (
          <button
            type="button"
            className="drawer__close drawer__close--floating"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <Icon name="close" />
          </button>
        )}
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
