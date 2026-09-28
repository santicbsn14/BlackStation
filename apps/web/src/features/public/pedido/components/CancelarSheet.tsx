import { Button, btnClass } from '../../../../components/Button';
import { Drawer } from '../../../../components/Drawer';
import { waLink } from '../../../../lib/whatsapp';
import './cancelarSheet.css';

type CancelarSheetProps = {
  numero: number;
  /** Sin settings todavía, no se muestra el botón de WhatsApp. */
  telefonoLocal: string | undefined;
  cancelando: boolean;
  onVolver: () => void;
  onCancelar: () => void;
};

export function CancelarSheet({
  numero,
  telefonoLocal,
  cancelando,
  onVolver,
  onCancelar,
}: CancelarSheetProps) {
  return (
    <Drawer
      side="bottom"
      title={`¿Cancelar el pedido #${numero}?`}
      // Mientras se cancela no se puede cerrar: la respuesta decide qué se muestra.
      onClose={() => {
        if (!cancelando) onVolver();
      }}
      footer={
        <div className="pub-cancelar__acciones">
          <Button onClick={onVolver} disabled={cancelando}>
            Volver
          </Button>
          <Button variant="danger" loading={cancelando} onClick={onCancelar}>
            Sí, cancelar
          </Button>
        </div>
      }
    >
      <div className="pub-cancelar l-stack">
        <p className="pub-cancelar__aviso">
          Si ya transferiste, no canceles: escribinos por WhatsApp.
        </p>
        {telefonoLocal && (
          <a
            className={btnClass('secondary', true)}
            href={waLink(telefonoLocal)}
            target="_blank"
            rel="noreferrer"
          >
            Escribir por WhatsApp
          </a>
        )}
      </div>
    </Drawer>
  );
}
