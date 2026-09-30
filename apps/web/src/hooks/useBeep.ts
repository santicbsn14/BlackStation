import { useCallback, useEffect, useRef, useState } from 'react';

/** Tres tonos ascendentes (sol, si, mi), en Hz. */
const TONOS = [784, 988, 1319] as const;
/** El patrón se toca 2 veces: ≈1,5 s en total. */
const REPETICIONES = 2;
const TONO_S = 0.18;
/** Separación entre inicios de tonos del mismo patrón. */
const PASO_S = 0.22;
/** Pausa entre la primera y la segunda vuelta. */
const PAUSA_S = 0.2;
/** Envolvente por tono: ataque y release cortos, lineales hasta 0, para que no haga clicks. */
const ATAQUE_S = 0.008;
const RELEASE_S = 0.04;
/** Ganancia de cada tono antes del compresor, y la de salida después. */
const GANANCIA_TONO = 0.6;
const GANANCIA_SALIDA = 1.4;

/** Duración total del aviso, en segundos. */
export const DURACION_AVISO_S =
  (REPETICIONES - 1) * (TONOS.length * PASO_S + PAUSA_S) + (TONOS.length - 1) * PASO_S + TONO_S;

/**
 * Programa el aviso de pedido nuevo en `ctx` desde `inicio` (tiempo del contexto). Onda cuadrada
 * (corta el ruido del carrito) → envolvente por tono → compresor (sube el volumen sin distorsión)
 * → ganancia de salida. Recibe `BaseAudioContext` para poder renderizarlo offline.
 */
export function programarAviso(ctx: BaseAudioContext, inicio: number): void {
  const compresor = ctx.createDynamicsCompressor();
  compresor.threshold.value = -12;
  compresor.knee.value = 6;
  compresor.ratio.value = 12;
  compresor.attack.value = 0.002;
  compresor.release.value = 0.1;
  const salida = ctx.createGain();
  salida.gain.value = GANANCIA_SALIDA;
  compresor.connect(salida).connect(ctx.destination);

  let ultimo: OscillatorNode | null = null;
  for (let vuelta = 0; vuelta < REPETICIONES; vuelta++) {
    const base = inicio + vuelta * (TONOS.length * PASO_S + PAUSA_S);
    for (const [i, frecuencia] of TONOS.entries()) {
      const t = base + i * PASO_S;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = frecuencia;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(GANANCIA_TONO, t + ATAQUE_S);
      env.gain.setValueAtTime(GANANCIA_TONO, t + TONO_S - RELEASE_S);
      env.gain.linearRampToValueAtTime(0, t + TONO_S);
      osc.connect(env).connect(compresor);
      osc.start(t);
      osc.stop(t + TONO_S + 0.01);
      ultimo = osc;
    }
  }
  // Al terminar el último tono se desarma la cadena (cada aviso arma la suya).
  ultimo?.addEventListener('ended', () => {
    compresor.disconnect();
    salida.disconnect();
  });
}

/**
 * Aviso sonoro con Web Audio (sin archivo). Con `activo`, crea el `AudioContext` al montar.
 * El navegador lo deja suspendido hasta que el usuario interactúa con la página: `bloqueado`
 * avisa eso, y `activar()` (desde un click) lo destraba. Cualquier toque en la página también.
 */
export function useBeep(activo: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    if (!activo || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const actualizar = () => setBloqueado(ctx.state === 'suspended');
    const destrabar = () => {
      if (ctx.state === 'suspended') void ctx.resume();
    };
    ctx.addEventListener('statechange', actualizar);
    document.addEventListener('pointerdown', destrabar);
    document.addEventListener('keydown', destrabar);
    // El estado inicial llega por `statechange` o se lee en el próximo tick.
    const timer = setTimeout(actualizar, 0);
    return () => {
      clearTimeout(timer);
      ctx.removeEventListener('statechange', actualizar);
      document.removeEventListener('pointerdown', destrabar);
      document.removeEventListener('keydown', destrabar);
      ctxRef.current = null;
      void ctx.close();
    };
  }, [activo]);

  const activar = useCallback(() => {
    void ctxRef.current?.resume();
  }, []);

  const beep = useCallback(() => {
    const ctx = ctxRef.current;
    if (ctx?.state !== 'running') return;
    programarAviso(ctx, ctx.currentTime + 0.01);
  }, []);

  return { bloqueado: activo && bloqueado, activar, beep };
}
