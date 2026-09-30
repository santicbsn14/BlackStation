import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import './modal.css';

type ModalProps = {
  title: string;
  onClose: () => void;
  /** Texto corto debajo del título; también rotula el diálogo (`aria-describedby`). */
  description?: ReactNode;
  /** Acciones (botones), alineadas a la derecha. */
  footer?: ReactNode;
  children?: ReactNode;
  /** `false`: no se cierra con Esc, tocando afuera ni con la ✕ (ej. mientras viaja una mutación). */
  dismissible?: boolean;
  /** `sm` para confirmaciones, `md` para formularios cortos. */
  size?: 'sm' | 'md';
};

/**
 * Diálogo modal sobre `<dialog>` nativo (`showModal`): top layer, foco inicial, Esc, backdrop y el
 * resto de la página inerte. Se monta abierto: el que lo usa decide cuándo renderizarlo.
 * Para paneles de detalle, `Drawer`.
 */
export function Modal({
  title,
  onClose,
  description,
  footer,
  children,
  dismissible = true,
  size = 'sm',
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const pointerDownAfuera = useRef(false);
  const tituloId = useId();
  const descripcionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  }, [onClose, dismissible]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let montado = true;
    dialog.showModal();

    // Esc dispara `cancel`: se cancela el cierre nativo y decide el que lo usa.
    function onCancel(event: Event) {
      event.preventDefault();
      if (dismissibleRef.current) onCloseRef.current();
    }
    // Chrome puede cerrar igual con un segundo Esc: se avisa, o se reabre si no se puede cerrar.
    // Si ya está abierto, el evento es viejo: el `close()` de un cleanup anterior (StrictMode
    // monta, desmonta y vuelve a montar) se despacha después de este `showModal()`.
    function onNativeClose() {
      if (!montado || !dialog || dialog.open) return;
      if (dismissibleRef.current) onCloseRef.current();
      else dialog.showModal();
    }
    // Las teclas no salen del diálogo: un Drawer abierto debajo no debe procesar Esc ni Tab.
    function onKeyDown(event: KeyboardEvent) {
      event.stopPropagation();
    }

    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onNativeClose);
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      montado = false;
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onNativeClose);
      dialog.removeEventListener('keydown', onKeyDown);
      dialog.close();
      if (previo?.isConnected) previo.focus();
    };
  }, []);

  // Tocar el backdrop (el target es el propio `<dialog>`) cierra. Se exige que el toque también
  // empiece afuera, para no cerrar al arrastrar una selección de texto desde adentro.
  function onPointerDown(event: MouseEvent<HTMLDialogElement>) {
    pointerDownAfuera.current = event.target === event.currentTarget;
  }
  function onClick(event: MouseEvent<HTMLDialogElement>) {
    if (dismissible && pointerDownAfuera.current && event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`modal modal--${size}`}
      aria-labelledby={tituloId}
      aria-describedby={description ? descripcionId : undefined}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <div className="modal__panel">
        <header className="modal__header">
          <h2 id={tituloId} className="modal__title">
            {title}
          </h2>
          {dismissible && (
            <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
              <Icon name="close" />
            </button>
          )}
        </header>
        {(description || children) && (
          <div className="modal__body">
            {description && (
              <p id={descripcionId} className="modal__description">
                {description}
              </p>
            )}
            {children}
          </div>
        )}
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </dialog>,
    document.body,
  );
}
