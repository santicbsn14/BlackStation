import { vencerPendientes } from '../services/vencimiento';

export const VENCIMIENTO_INTERVALO_MS = 60_000;

/**
 * Job de vencimiento de transferencias (§5.4): corre `vencerPendientes()` cada minuto. Una corrida
 * que falla va al log y no corta las siguientes; si la anterior sigue en curso, se saltea. No
 * mantiene vivo el proceso (`unref`). Devuelve la función que lo frena.
 */
export function startVencimientoJob(intervaloMs = VENCIMIENTO_INTERVALO_MS): () => void {
  let corriendo = false;

  const timer = setInterval(() => {
    if (corriendo) return;
    corriendo = true;
    vencerPendientes()
      .then((vencidos) => {
        if (vencidos > 0) console.log(`Vencimiento: ${vencidos} pedido(s) cancelado(s).`);
      })
      .catch((err: unknown) => {
        console.error('Falló el job de vencimiento:', err);
      })
      .finally(() => {
        corriendo = false;
      });
  }, intervaloMs);
  timer.unref();

  return () => clearInterval(timer);
}
