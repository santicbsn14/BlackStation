import type { InputHTMLAttributes } from 'react';
import './switch.css';

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange'> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Deja la etiqueta solo para lectores de pantalla (ej. dentro de una tabla). */
  hideLabel?: boolean;
};

/** Interruptor de encendido/apagado: checkbox nativo con `role="switch"`. */
export function Switch({
  checked,
  onChange,
  label,
  hideLabel = false,
  disabled,
  className,
  ...rest
}: SwitchProps) {
  return (
    <label className={['switch', disabled && 'is-disabled', className].filter(Boolean).join(' ')}>
      <input
        type="checkbox"
        role="switch"
        className="switch__input u-visually-hidden"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        {...rest}
      />
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      <span className={hideLabel ? 'u-visually-hidden' : 'switch__label'}>{label}</span>
    </label>
  );
}
