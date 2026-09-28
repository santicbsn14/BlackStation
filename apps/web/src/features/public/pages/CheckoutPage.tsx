import { METODOS_PAGO, normalizarTelefono, type MetodoPago } from '@blackstation/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../../services';
import { useCatalog } from '../hooks/useCatalog';
import { useCreateOrder } from '../hooks/useCreateOrder';
import { useSlots } from '../hooks/useSlots';

const TELEFONO_PRUEBA = normalizarTelefono('0336', '15 412-3456');

/** Placeholder con un botón de prueba para crear pedidos contra los mocks. */
export function CheckoutPage() {
  const catalog = useCatalog();
  const slots = useSlots();
  const createOrder = useCreateOrder();
  const [horaFijada, setHoraFijada] = useState<string | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('retiro');

  const franjas = slots.data?.slots ?? [];
  const hora = horaFijada ?? franjas[0]?.hora ?? '';
  const producto = catalog.data?.categories
    .flatMap((c) => c.products)
    .find((p) => p.disponible && p.extras.length > 0);

  function crearPedidoDePrueba() {
    if (!producto || !hora || !TELEFONO_PRUEBA.ok) return;
    // Queda fijada para poder llenar la franja con clics sucesivos y ver el 409.
    setHoraFijada(hora);
    const extra = producto.extras[0];
    createOrder.mutate({
      cliente: { nombre: 'Pedido de prueba', telefono: TELEFONO_PRUEBA.telefono },
      items: [
        {
          productoId: producto._id,
          cantidad: 1,
          quitados: producto.ingredientesQuitables.slice(0, 1),
          extras: extra ? [{ extraId: extra._id, cantidad: 1 }] : [],
        },
      ],
      aclaracion: 'Pedido generado desde el checkout de prueba.',
      hora,
      metodoPago,
    });
  }

  const error = createOrder.error;

  return (
    <section className="l-stack">
      <h1>Checkout</h1>
      <p>Placeholder: el formulario real llega en la Etapa 03.</p>

      <div className="l-cluster">
        <label>
          Franja{' '}
          <select value={hora} onChange={(e) => setHoraFijada(e.target.value)}>
            {horaFijada && !franjas.some((f) => f.hora === horaFijada) && (
              <option value={horaFijada}>{horaFijada} (sin cupo)</option>
            )}
            {franjas.map((f) => (
              <option key={f.hora} value={f.hora}>
                {f.hora} — {f.disponibles} disponibles
              </option>
            ))}
          </select>
        </label>
        <label>
          Pago{' '}
          <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}>
            {METODOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={crearPedidoDePrueba}
          disabled={!producto || !hora || createOrder.isPending}
        >
          Crear pedido de prueba
        </button>
      </div>

      {slots.data && franjas.length === 0 && (
        <p>No hay franjas disponibles para la jornada {slots.data.fecha}.</p>
      )}
      {createOrder.data && (
        <p>
          Pedido #{createOrder.data.numero} creado:{' '}
          <Link to={`/pedido/${createOrder.data.codigo}`}>{createOrder.data.codigo}</Link>
        </p>
      )}
      {error && (
        <p role="alert">
          {error instanceof ApiError ? `${error.status} ${error.code}: ` : ''}
          {error.message}
        </p>
      )}
    </section>
  );
}
