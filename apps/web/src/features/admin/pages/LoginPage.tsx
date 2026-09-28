import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import logoUrl from '../../../assets/brand/logo.svg';
import { getSession } from '../../../lib/session';
import { useLogin } from '../hooks/useLogin';
import './loginPage.css';

/** Login funcional mínimo; el diseño final llega en la Etapa 04. */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');

  const from = (location.state as { from?: string } | null)?.from ?? '/admin';
  if (getSession()) return <Navigate to={from} replace />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate(
      { usuario, password },
      { onSuccess: () => void navigate(from, { replace: true }) },
    );
  }

  return (
    <main className="adm-login">
      <form className="adm-login__form l-stack" onSubmit={handleSubmit}>
        <img className="adm-login__logo" src={logoUrl} alt="Black Station" />
        <h1>Panel</h1>
        <label className="l-stack l-stack--sm">
          Usuario
          <input
            name="usuario"
            autoComplete="username"
            required
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
        </label>
        <label className="l-stack l-stack--sm">
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {loginMutation.error && <p role="alert">{loginMutation.error.message}</p>}
        <button type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
