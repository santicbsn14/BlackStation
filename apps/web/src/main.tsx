// Primero de todo: declara el orden de @layer antes que cualquier CSS de componente.
// Si otro CSS llega antes, su capa queda primera y pierde contra reset/base.
import './styles/index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { router } from './app/router';
import { ToastProvider } from './components/Toast';
import { loginPath } from './lib/session';
import { ApiError } from './services';
import { setUnauthorizedHandler } from './services/http';

const MAX_REINTENTOS = 2;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Los 4xx son definitivos: reintentar solo errores de red o del servidor.
      retry: (failureCount, error) =>
        failureCount < MAX_REINTENTOS &&
        !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

setUnauthorizedHandler(() => {
  queryClient.clear();
  const { pathname, search } = router.state.location;
  void router.navigate(loginPath(pathname + search), { replace: true });
});

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root en index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
