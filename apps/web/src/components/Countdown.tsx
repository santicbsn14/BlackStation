import './countdown.css';

const URGENTE_MS = 60_000;

function formatear(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

/** `mm:ss` de lo que resta. En `--danger` el último minuto. El cálculo lo da `useCountdown`. */
export function Countdown({ ms }: { ms: number }) {
  return (
    <span
      className={['countdown', 'u-tabular', ms <= URGENTE_MS && 'is-urgent']
        .filter(Boolean)
        .join(' ')}
      role="timer"
    >
      {formatear(ms)}
    </span>
  );
}
