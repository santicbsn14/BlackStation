import { CounterModel } from '../models/Counter';

/**
 * Siguiente `numero` de pedido de la jornada (§3.9). Atómico: `$inc` con upsert sobre
 * `orders:<fecha>`, así una jornada nueva arranca en 1 y dos pedidos simultáneos nunca comparten
 * número.
 */
export async function nextNumero(fecha: string): Promise<number> {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: `orders:${fecha}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  if (!counter) throw new Error(`No se pudo asignar el número del pedido para ${fecha}.`);
  return counter.seq;
}
