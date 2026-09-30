import { Icon } from '../../../../components/Icon';
import './flechasOrden.css';

type FlechasOrdenProps = {
  nombre: string;
  esPrimero: boolean;
  esUltimo: boolean;
  disabled: boolean;
  onMover: (direccion: -1 | 1) => void;
};

/** ↑↓ para cambiar el orden con la fila vecina. */
export function FlechasOrden({
  nombre,
  esPrimero,
  esUltimo,
  disabled,
  onMover,
}: FlechasOrdenProps) {
  return (
    <div className="adm-flechas" role="group" aria-label={`Orden de ${nombre}`}>
      <button
        type="button"
        className="adm-flechas__btn"
        onClick={() => onMover(-1)}
        disabled={disabled || esPrimero}
        aria-label={`Subir ${nombre}`}
      >
        <Icon name="arrowUp" />
      </button>
      <button
        type="button"
        className="adm-flechas__btn"
        onClick={() => onMover(1)}
        disabled={disabled || esUltimo}
        aria-label={`Bajar ${nombre}`}
      >
        <Icon name="arrowDown" />
      </button>
    </div>
  );
}
