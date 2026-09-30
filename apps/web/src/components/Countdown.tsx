import './countdown.css';

const URGENTE_MS = 60_000;

function formatear(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

type CountdownProps = {
  ms: number;
  /** Desde cuántos ms restantes va en `--danger`. Por defecto, el último minuto. */
  urgenteMs?: number;
  /** Desde cuántos ms restantes va en `--warning` (opcional). */
  avisoMs?: number;
};

/** `mm:ss` de lo que resta. El cálculo lo da `useCountdown`. */
export function Countdown({ ms, urgenteMs = URGENTE_MS, avisoMs }: CountdownProps) {
  const urgente = ms <= urgenteMs;
  const aviso = !urgente && avisoMs !== undefined && ms <= avisoMs;
  return (
    <span
      className={['countdown', 'u-tabular', urgente && 'is-urgent', aviso && 'is-warning']
        .filter(Boolean)
        .join(' ')}
      role="timer"
    >
      {formatear(ms)}
    </span>
  );
}
