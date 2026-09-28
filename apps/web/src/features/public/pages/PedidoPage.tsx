import { useParams } from 'react-router';
import { useOrder } from '../hooks/useOrder';

export function PedidoPage() {
  const { codigo = '' } = useParams();
  const { data, isPending, error } = useOrder(codigo);

  return (
    <section className="l-stack">
      <h1>Pedido {codigo}</h1>
      <p>Placeholder: el seguimiento real llega en la Etapa 03.</p>
      {isPending && <p>Cargando…</p>}
      {error && <p role="alert">{error.message}</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </section>
  );
}
