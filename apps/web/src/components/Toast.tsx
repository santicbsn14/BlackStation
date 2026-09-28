import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './toast.css';

const DURACION_MS = 2_500;

type ToastItem = { id: number; mensaje: string };
type ToastFn = (mensaje: string) => void;

const ToastContext = createContext<ToastFn | null>(null);

let proximoId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback<ToastFn>((mensaje) => {
    const id = proximoId++;
    setToasts((actuales) => [...actuales, { id, mensaje }]);
    setTimeout(() => setToasts((actuales) => actuales.filter((t) => t.id !== id)), DURACION_MS);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-region" role="status" aria-live="polite">
          {toasts.map((t) => (
            <p key={t.id} className="toast">
              {t.mensaje}
            </p>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

/** `toast('Agregado al carrito')`. Requiere `ToastProvider`. */
export function useToast(): ToastFn {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast requiere ToastProvider');
  return toast;
}
