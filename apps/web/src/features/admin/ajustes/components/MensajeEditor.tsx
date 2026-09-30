import { useRef } from 'react';
import { Chip } from '../../../../components/Chip';
import { Field, Textarea, fieldAria } from '../../../../components/Field';
import { renderPlantilla } from '../../../../lib/mensajes';
import { VARIABLES } from '../ajustes';
import './mensajeEditor.css';

type MensajeEditorProps = {
  id: string;
  titulo: string;
  valor: string;
  onChange: (valor: string) => void;
  error?: string;
  /** Valores del pedido de ejemplo para la preview. */
  ejemplo: Record<string, string | number>;
};

/** Textarea de una plantilla, con chips que insertan `{variable}` en el cursor y preview en vivo. */
export function MensajeEditor({ id, titulo, valor, onChange, error, ejemplo }: MensajeEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insertar(variable: string) {
    const el = ref.current;
    const texto = `{${variable}}`;
    const desde = el?.selectionStart ?? valor.length;
    const hasta = el?.selectionEnd ?? valor.length;
    onChange(valor.slice(0, desde) + texto + valor.slice(hasta));
    // Después del render, el cursor queda justo después de la variable.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(desde + texto.length, desde + texto.length);
    });
  }

  return (
    <div className="adm-mensaje">
      <Field id={id} label={titulo} error={error}>
        <Textarea
          ref={ref}
          id={id}
          rows={3}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          {...fieldAria(id, { error })}
        />
      </Field>
      <div className="adm-mensaje__variables" role="group" aria-label={`Variables para ${titulo}`}>
        {VARIABLES.map((v) => (
          <Chip key={v} className="adm-mensaje__chip" onClick={() => insertar(v)}>
            {`{${v}}`}
          </Chip>
        ))}
      </div>
      <p className="adm-mensaje__preview" aria-label={`Vista previa de ${titulo}`}>
        {renderPlantilla(valor, ejemplo)}
      </p>
    </div>
  );
}
