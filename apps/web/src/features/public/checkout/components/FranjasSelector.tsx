import type { PublicSlot } from '@blackstation/shared';
import { Chip } from '../../../../components/Chip';
import './franjasSelector.css';

const POCOS_CUPOS = 2;

type FranjasSelectorProps = {
  franjas: PublicSlot[];
  elegida: string | null;
  onElegir: (hora: string) => void;
  describedBy?: string;
};

/** Grilla de chips con la hora de cada franja; "quedan N" si hay pocos cupos. */
export function FranjasSelector({ franjas, elegida, onElegir, describedBy }: FranjasSelectorProps) {
  return (
    <div className="pub-franjas" role="group" aria-label="Horarios" aria-describedby={describedBy}>
      {franjas.map((f) => (
        <Chip
          key={f.hora}
          pressed={f.hora === elegida}
          className="pub-franjas__chip"
          onClick={() => onElegir(f.hora)}
        >
          <span className="u-tabular">{f.hora}</span>
          {f.disponibles <= POCOS_CUPOS && (
            <span className="pub-franjas__quedan">quedan {f.disponibles}</span>
          )}
        </Chip>
      ))}
    </div>
  );
}
