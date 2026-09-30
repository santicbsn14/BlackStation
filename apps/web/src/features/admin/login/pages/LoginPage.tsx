import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import logoUrl from '../../../../assets/brand/logo.svg';
import { Button } from '../../../../components/Button';
import { Field, Input, fieldAria } from '../../../../components/Field';
import { Icon } from '../../../../components/Icon';
import { useToast } from '../../../../components/Toast';
import { getSession, safeNextPath } from '../../../../lib/session';
import { ApiError } from '../../../../services';
import { useLogin } from '../hooks/useLogin';
import './loginPage.css';

const ERROR_CREDENCIALES = 'Usuario o contraseña incorrectos';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginMutation = useLogin();
  const toast = useToast();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ya logueado: directo a la comanda.
  if (getSession()) return <Navigate to="/admin" replace />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    loginMutation.mutate(
      { usuario: usuario.trim(), password },
      {
        onSuccess: () => void navigate(safeNextPath(searchParams.get('next')), { replace: true }),
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
            setError(ERROR_CREDENCIALES);
          } else if (err instanceof ApiError && err.code !== 'NETWORK_ERROR') {
            toast(err.message);
          } else {
            toast('No pudimos conectarnos. Revisá tu conexión.');
          }
        },
      },
    );
  }

  function limpiarError() {
    if (error) setError(null);
  }

  return (
    <main className="adm-login">
      <form className="adm-login__form" onSubmit={handleSubmit} noValidate>
        <img className="adm-login__logo" src={logoUrl} alt="Black Station" />
        <h1 className="adm-login__title">Panel</h1>

        <Field id="login-usuario" label="Usuario">
          <Input
            id="login-usuario"
            name="usuario"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={usuario}
            onChange={(e) => {
              setUsuario(e.target.value);
              limpiarError();
            }}
            // El error de credenciales es de los dos campos; el texto va debajo de la contraseña.
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-password-error' : undefined}
          />
        </Field>

        <Field id="login-password" label="Contraseña" error={error}>
          <div className="adm-login__password">
            <Input
              id="login-password"
              name="password"
              type={verPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                limpiarError();
              }}
              {...fieldAria('login-password', { error })}
            />
            <button
              type="button"
              className="adm-login__ver"
              onClick={() => setVerPassword((v) => !v)}
              aria-pressed={verPassword}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              <Icon name={verPassword ? 'eyeOff' : 'eye'} />
            </button>
          </div>
        </Field>

        <Button
          type="submit"
          variant="primary"
          block
          loading={loginMutation.isPending}
          disabled={!usuario.trim() || !password}
        >
          {loginMutation.isPending ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </main>
  );
}
