import type { ButtonHTMLAttributes } from 'react';
import './button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  block?: boolean;
  /** Muestra un spinner y bloquea el botón (contra doble envío). */
  loading?: boolean;
};

/** Clases de `.btn`, para aplicar el mismo estilo a un `<a>` o un `<Link>`. */
export function btnClass(variant: ButtonVariant = 'secondary', block = false): string {
  return `btn btn--${variant}${block ? ' btn--block' : ''}`;
}

export function Button({
  variant = 'secondary',
  block = false,
  loading = false,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const clases = [btnClass(variant, block), loading && 'is-loading', className].filter(Boolean);
  return (
    <button
      type={type}
      className={clases.join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
