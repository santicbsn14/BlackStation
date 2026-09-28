import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { router } from './app/router';
import { ApiError } from './services';
import { setUnauthorizedHandler } from './services/http';
import './styles/index.css';

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
  void router.navigate('/admin/login', { replace: true });
});

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root en index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
