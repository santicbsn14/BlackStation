import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="l-stack">
      <h1>Página no encontrada</h1>
      <p>
        La dirección no existe. <Link to="/">Volver al catálogo</Link>
      </p>
    </section>
  );
}
