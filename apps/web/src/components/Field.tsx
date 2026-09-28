import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import './field.css';

type FieldProps = {
  /** `id` del control; la etiqueta, la ayuda y el error se enlazan con él. */
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Contenido a la derecha de la etiqueta (ej. contador). */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Etiqueta + control + ayuda + error. El control recibe los `aria-*` con `fieldAria`. */
export function Field({ id, label, hint, error, aside, className, children }: FieldProps) {
  return (
    <div className={['field', error && 'is-invalid', className].filter(Boolean).join(' ')}>
      <div className="field__head">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && !error && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** `aria-invalid` y `aria-describedby` coherentes con lo que muestra `Field`. */
export function fieldAria(id: string, { error, hint }: { error?: string | null; hint?: boolean }) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={['input', className].filter(Boolean).join(' ')} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={['input', 'textarea', className].filter(Boolean).join(' ')} {...rest} />
  );
}
