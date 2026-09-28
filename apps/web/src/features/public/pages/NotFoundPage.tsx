import { Link } from 'react-router';
import { btnClass } from '../../../components/Button';
import './notFoundPage.css';

export function NotFoundPage() {
  return (
    <section className="pub-not-found l-stack">
      <h1>Página no encontrada</h1>
      <p>La dirección no existe.</p>
      <Link to="/" className={btnClass('primary')}>
        Ver el menú
      </Link>
    </section>
  );
}
