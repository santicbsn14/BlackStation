import type { ButtonHTMLAttributes } from 'react';
import './chip.css';

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Estado de toggle (`aria-pressed`). Omitir si el chip no es un toggle. */
  pressed?: boolean;
  active?: boolean;
};

export function Chip({ pressed, active, className, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={['chip', active && 'is-active', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}
