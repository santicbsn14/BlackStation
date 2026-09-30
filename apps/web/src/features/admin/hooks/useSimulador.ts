import { useEffect } from 'react';
import { startSimulador } from '../../../services';

/** Con mocks y `VITE_MOCK_SIMULAR=true`, genera pedidos mientras el panel está abierto. */
export function useSimulador() {
  useEffect(() => startSimulador(), []);
}
