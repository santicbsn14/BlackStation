import './itemDetalle.css';

type ItemDetalleProps = {
  quitados: string[];
  extras: { nombre: string; cantidad: number }[];
};

/** "Sin cebolla, sin pepinillo" y "+ Extra cheddar ×2", en `--text-muted`. */
export function ItemDetalle({ quitados, extras }: ItemDetalleProps) {
  if (quitados.length === 0 && extras.length === 0) return null;
  const sin = quitados.map((q, i) => `${i === 0 ? 'Sin' : 'sin'} ${q}`).join(', ');

  return (
    <div className="pub-item-detalle">
      {sin && <p>{sin}</p>}
      {extras.map((e) => (
        <p key={e.nombre}>
          + {e.nombre}
          {e.cantidad > 1 && <span className="u-tabular"> ×{e.cantidad}</span>}
        </p>
      ))}
    </div>
  );
}
