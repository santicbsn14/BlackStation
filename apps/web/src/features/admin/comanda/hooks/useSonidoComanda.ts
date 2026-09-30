import { useState } from 'react';
import { useBeep } from '../../../../hooks/useBeep';
import { guardarJson, leerJson } from '../../../../lib/storage';

const STORAGE_KEY = 'bs-sonido';

const esBooleano = (valor: unknown): valor is boolean => typeof valor === 'boolean';

/** Aviso sonoro de pedido nuevo, con la preferencia on/off en `localStorage` (`bs-sonido`). */
export function useSonidoComanda() {
  const [activo, setActivo] = useState(() => leerJson(STORAGE_KEY, esBooleano) ?? true);
  const { bloqueado, activar, beep } = useBeep(activo);

  function alternar() {
    const nuevo = !activo;
    setActivo(nuevo);
    guardarJson(STORAGE_KEY, nuevo);
  }

  return { activo, alternar, bloqueado, activar, beep };
}
