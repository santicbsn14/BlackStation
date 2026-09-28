import { Icon } from './Icon';
import './stepper.css';

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Qué se cuenta, para el `aria-label` del grupo ("Cantidad de Bacon"). */
  label: string;
  /** Si se pasa, en `min` el "−" pasa a ser un tacho que llama a `onRemove`. */
  onRemove?: () => void;
};

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  label,
  onRemove,
}: StepperProps) {
  const enMinimo = value <= min;

  return (
    <div className="stepper" role="group" aria-label={label}>
      {onRemove && enMinimo ? (
        <button type="button" className="stepper__btn" onClick={onRemove} aria-label="Quitar">
          <Icon name="trash" />
        </button>
      ) : (
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(value - 1)}
          disabled={enMinimo}
          aria-label="Restar uno"
        >
          <Icon name="minus" />
        </button>
      )}
      <output className="stepper__value u-tabular" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Sumar uno"
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
