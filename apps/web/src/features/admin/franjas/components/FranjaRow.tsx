import type { AdminSlot } from '@blackstation/shared';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Badge } from '../../../../components/Badge';
import { Stepper } from '../../../../components/Stepper';
import { Switch } from '../../../../components/Switch';
import { useUpdateSlot } from '../hooks/useFranjas';
import './franjaRow.css';

const DEBOUNCE_MS = 500;
const ALTO = 0.8;

type FranjaRowProps = {
  slot: AdminSlot;
  fecha: string;
  /** `inicio < ahora`: atenuada y sin edición. */
  pasada: boolean;
  /** Dentro de la anticipación mínima: ya no se le ofrece al cliente. */
  sinAnticipacion: boolean;
};

export function FranjaRow({ slot, fecha, pasada, sinAnticipacion }: FranjaRowProps) {
  const actualizar = useUpdateSlot();
  // Cupo que se está editando: se muestra enseguida y el PATCH sale 500 ms después del último toque.
  const [cupoLocal, setCupoLocal] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const cupo = cupoLocal ?? slot.cupoMax;
  const nivel = cupo > 0 ? slot.ocupados / cupo : 1;
  const estado = slot.ocupados >= cupo ? 'lleno' : nivel >= ALTO ? 'alto' : 'ok';
  const editable = !pasada && !slot.huerfana;

  function cambiarCupo(valor: number) {
    setCupoLocal(valor);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      actualizar.mutate(
        { fecha, hora: slot.hora, cupoMax: valor },
        { onSettled: () => setCupoLocal((actual) => (actual === valor ? null : actual)) },
      );
    }, DEBOUNCE_MS);
  }

  return (
    <li
      className={['adm-franja', pasada && 'is-pasada', slot.cerrada && 'is-cerrada']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="adm-franja__hora">
        <span className="u-tabular">{slot.hora}</span>
        {slot.huerfana && <Badge className="adm-franja__badge">Fuera de horario</Badge>}
        {!slot.huerfana && !pasada && sinAnticipacion && (
          <Badge className="adm-franja__badge">Ya no se ofrece</Badge>
        )}
        {pasada && <span className="adm-franja__nota">Pasó</span>}
      </div>

      <div className="adm-franja__cupo">
        <div
          className="adm-franja__barra"
          data-nivel={estado}
          role="meter"
          aria-label={`Ocupación de las ${slot.hora}`}
          aria-valuemin={0}
          aria-valuemax={cupo}
          aria-valuenow={slot.ocupados}
          style={{ '--progress': Math.min(1, nivel) } as CSSProperties}
        >
          <span className="adm-franja__relleno" />
        </div>
        <span className="adm-franja__numeros u-tabular">
          {slot.ocupados}/{cupo}
        </span>
      </div>

      {editable ? (
        <>
          <Stepper
            label={`Cupo de las ${slot.hora}`}
            value={cupo}
            min={slot.ocupados}
            onChange={cambiarCupo}
          />
          <Switch
            label="Abierta"
            checked={!slot.cerrada}
            disabled={actualizar.isPending && actualizar.variables.cerrada !== undefined}
            onChange={(abierta) => actualizar.mutate({ fecha, hora: slot.hora, cerrada: !abierta })}
          />
        </>
      ) : (
        <span className="adm-franja__nota adm-franja__nota--fija">
          {slot.cerrada ? 'Cerrada' : pasada ? '' : 'No se ofrece'}
        </span>
      )}
    </li>
  );
}
