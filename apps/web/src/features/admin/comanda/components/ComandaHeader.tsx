import type { Jornada, Settings } from '@blackstation/shared';
import { Icon } from '../../../../components/Icon';
import { Switch } from '../../../../components/Switch';
import { formatearJornada } from '../../../../lib/hora';
import { useTogglePedidos } from '../hooks/useTogglePedidos';
import './comandaHeader.css';

type ComandaHeaderProps = {
  jornada: Jornada | undefined;
  settings: Settings | undefined;
  sonidoActivo: boolean;
  onAlternarSonido: () => void;
};

/** Jornada, abierto/cerrado, "Tomar pedidos" y el toggle de sonido. */
export function ComandaHeader({
  jornada,
  settings,
  sonidoActivo,
  onAlternarSonido,
}: ComandaHeaderProps) {
  const toggle = useTogglePedidos();
  // Mientras viaja el PUT, el switch ya muestra el valor nuevo.
  const habilitados = toggle.isPending
    ? toggle.variables.habilitados
    : (settings?.pedidosHabilitados ?? true);

  return (
    <header className="adm-comanda-header">
      <div className="adm-comanda-header__titulo">
        <h1>Comanda</h1>
        {jornada && (
          <p className="adm-comanda-header__jornada">
            <span>Jornada {formatearJornada(jornada.fecha)}</span>
            <span className="adm-comanda-header__estado" data-abierto={jornada.abierta}>
              {jornada.abierta ? 'Abierto' : 'Cerrado'}
            </span>
          </p>
        )}
      </div>

      <div className="adm-comanda-header__controles">
        {settings && !habilitados && (
          <p className="adm-comanda-header__pausados" role="status">
            <Icon name="alert" />
            Pedidos pausados
          </p>
        )}
        {settings && (
          <Switch
            label="Tomar pedidos"
            checked={habilitados}
            disabled={toggle.isPending}
            onChange={(checked) => toggle.mutate({ settings, habilitados: checked })}
          />
        )}
        <button
          type="button"
          className="adm-comanda-header__sonido"
          aria-pressed={sonidoActivo}
          onClick={onAlternarSonido}
          title={sonidoActivo ? 'Silenciar aviso de pedido nuevo' : 'Activar aviso de pedido nuevo'}
        >
          <Icon name={sonidoActivo ? 'bell' : 'bellOff'} />
          <span className="u-visually-hidden">Sonido de pedido nuevo</span>
        </button>
      </div>
    </header>
  );
}
