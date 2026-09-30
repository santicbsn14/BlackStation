import { Button } from '../../../../components/Button';
import { Icon } from '../../../../components/Icon';
import { Switch } from '../../../../components/Switch';

type CatalogoToolbarProps = {
  mostrarInactivos: boolean;
  onMostrarInactivos: (valor: boolean) => void;
  nuevo: string;
  onNuevo: () => void;
};

/** Arriba de cada tab: "Mostrar inactivos" y el botón "Nuevo". */
export function CatalogoToolbar({
  mostrarInactivos,
  onMostrarInactivos,
  nuevo,
  onNuevo,
}: CatalogoToolbarProps) {
  return (
    <div className="adm-catalogo__toolbar">
      <Switch label="Mostrar inactivos" checked={mostrarInactivos} onChange={onMostrarInactivos} />
      <Button variant="primary" onClick={onNuevo}>
        <Icon name="plus" />
        {nuevo}
      </Button>
    </div>
  );
}
