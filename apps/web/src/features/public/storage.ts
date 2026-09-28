import { borrarKey, esObjeto, guardarJson, leerJson } from '../../lib/storage';

// Datos del cliente para precargar el checkout.

const CLIENTE_KEY = 'bs-cliente';

export type ClienteGuardado = {
  nombre: string;
  caracteristica: string;
  numero: string;
};

function esCliente(valor: unknown): valor is ClienteGuardado {
  return (
    esObjeto(valor) &&
    typeof valor.nombre === 'string' &&
    typeof valor.caracteristica === 'string' &&
    typeof valor.numero === 'string'
  );
}

export function leerCliente(): ClienteGuardado | null {
  return leerJson(CLIENTE_KEY, esCliente);
}

export function guardarCliente(cliente: ClienteGuardado): void {
  guardarJson(CLIENTE_KEY, cliente);
}

// Último pedido hecho desde este dispositivo, para el banner de pedido en curso.

const PEDIDO_ACTIVO_KEY = 'bs-pedido-activo';

export type PedidoActivo = { codigo: string };

function esPedidoActivo(valor: unknown): valor is PedidoActivo {
  return esObjeto(valor) && typeof valor.codigo === 'string' && valor.codigo.length > 0;
}

export function leerPedidoActivo(): PedidoActivo | null {
  return leerJson(PEDIDO_ACTIVO_KEY, esPedidoActivo);
}

export function guardarPedidoActivo(codigo: string): void {
  guardarJson(PEDIDO_ACTIVO_KEY, { codigo } satisfies PedidoActivo);
}

/** Lo borra solo si sigue apuntando a `codigo` (no pisa un pedido más nuevo). */
export function borrarPedidoActivo(codigo: string): void {
  if (leerPedidoActivo()?.codigo === codigo) borrarKey(PEDIDO_ACTIVO_KEY);
}
