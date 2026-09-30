import type { CreateOrderItem, MetodoPago } from '@blackstation/shared';
import { createOrder, getCatalog, getSlots } from './index';

// Simulador de pedidos para la demo (`VITE_MOCK_SIMULAR=true`): un pedido cada 30–60 s por la
// misma lógica de `createOrder`, con franjas reales y mezcla de métodos de pago. No confirma
// nada: los de transferencia que nadie confirma se vencen solos.

const PAUSA_MIN_MS = 30_000;
const PAUSA_MAX_MS = 60_000;

/** Clientes que se repiten, para que la reputación tenga historial. */
const CLIENTES = [
  { nombre: 'Juan Pérez', telefono: '5493364123456' },
  { nombre: 'María González', telefono: '5493364234567' },
  { nombre: 'Sofía Martínez', telefono: '5493364345678' },
  { nombre: 'Lucas Fernández', telefono: '5493364456789' },
  { nombre: 'Martina López', telefono: '5493364567890' },
  { nombre: 'Agustín Romero', telefono: '5493364678901' },
  { nombre: 'Valentina Díaz', telefono: '5493364789012' },
  { nombre: 'Tomás Álvarez', telefono: '5493364890123' },
] as const;

const ACLARACIONES = [
  'Sin sal en las papas, por favor.',
  'Pasa a buscar mi hermano.',
  'Cortar el lomito al medio.',
  'Aderezos aparte.',
] as const;

const entero = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const azar = <T>(lista: readonly T[]): T | undefined =>
  lista[Math.floor(Math.random() * lista.length)];
const chance = (p: number) => Math.random() < p;

async function simularPedido(): Promise<void> {
  const [slots, catalog] = await Promise.all([getSlots(), getCatalog()]);
  const slot = azar(slots.slots);
  const productos = catalog.categories.flatMap((c) => c.products).filter((p) => p.disponible);
  const cliente = azar(CLIENTES);
  if (!slots.abierto || !slot || productos.length === 0 || !cliente) return;

  const items: CreateOrderItem[] = [];
  for (let i = entero(1, 3); i > 0; i--) {
    const producto = azar(productos);
    if (!producto) continue;
    items.push({
      productoId: producto._id,
      cantidad: chance(0.75) ? 1 : 2,
      quitados: producto.ingredientesQuitables.filter(() => chance(0.25)),
      extras: producto.extras
        .filter(() => chance(0.3))
        .map((e) => ({ extraId: e._id, cantidad: entero(1, e.cantidadMax) })),
    });
  }

  const metodoPago: MetodoPago = chance(0.5) ? 'transferencia' : 'retiro';
  const aclaracion = chance(0.2) ? azar(ACLARACIONES) : undefined;
  await createOrder({
    cliente: { ...cliente },
    items,
    hora: slot.hora,
    metodoPago,
    ...(aclaracion ? { aclaracion } : {}),
  });
}

/** Arranca el simulador y devuelve la función que lo frena. */
export function startSimulador(): () => void {
  let activo = true;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const programar = () => {
    timer = setTimeout(
      async () => {
        try {
          await simularPedido();
        } catch {
          // Franja llena, local cerrado o cliente bloqueado: se saltea este pedido.
        }
        if (activo) programar();
      },
      entero(PAUSA_MIN_MS, PAUSA_MAX_MS),
    );
  };

  programar();
  return () => {
    activo = false;
    clearTimeout(timer);
  };
}
