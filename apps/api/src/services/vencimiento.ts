import { now } from '../lib/clock';
import { OrderModel } from '../models';
import { liberarCupo } from './slots';

/**
 * §5.4: todo pedido `pendiente` con `expiresAt ≤ now()` pasa a `cancelado`/`vencido` y libera su
 * cupo. Lo corre el job cada minuto y, perezoso, el inicio de los endpoints de §5.4. Cada pedido se
 * vence con condición sobre su estado y el cupo se libera solo si esa actualización matcheó: si el
 * job y una request corren a la vez, el cupo se libera una sola vez. Devuelve cuántos venció.
 */
export async function vencerPendientes(): Promise<number> {
  const ahora = now();
  const filtro = { estado: 'pendiente', expiresAt: { $lte: ahora } } as const;
  const candidatos = await OrderModel.find(filtro, { _id: 1 }).lean();

  let vencidos = 0;
  for (const { _id } of candidatos) {
    const order = await OrderModel.findOneAndUpdate(
      { _id, ...filtro },
      {
        $set: {
          estado: 'cancelado',
          motivoCancelacion: 'vencido',
          canceladoAt: ahora,
          updatedAt: ahora,
        },
      },
      { projection: { slotId: 1 }, timestamps: false },
    ).lean();
    if (!order) continue;
    await liberarCupo(order.slotId);
    vencidos += 1;
  }
  return vencidos;
}
