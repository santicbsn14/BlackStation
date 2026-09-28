import { createBrowserRouter } from 'react-router';
import { CatalogoPage } from '../features/public/pages/CatalogoPage';
import { CheckoutPage } from '../features/public/pages/CheckoutPage';
import { NotFoundPage } from '../features/public/pages/NotFoundPage';
import { PedidoPage } from '../features/public/pages/PedidoPage';
import { PublicLayout } from './layouts/PublicLayout';
import { RequireAuth } from './RequireAuth';

// Todo /admin es lazy: la app pública no descarga el panel ni su CSS.
export const router = createBrowserRouter([
  {
    hydrateFallbackElement: <p>Cargando…</p>,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <CatalogoPage /> },
          { path: '/checkout', element: <CheckoutPage /> },
          { path: '/pedido/:codigo', element: <PedidoPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: '/admin/login',
        lazy: async () => ({
          Component: (await import('../features/admin/pages/LoginPage')).LoginPage,
        }),
      },
      {
        path: '/admin',
        element: <RequireAuth />,
        children: [
          {
            lazy: async () => ({ Component: (await import('./layouts/AdminLayout')).AdminLayout }),
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('../features/admin/pages/ComandaPage')).ComandaPage,
                }),
              },
              {
                path: 'catalogo',
                lazy: async () => ({
                  Component: (await import('../features/admin/pages/AdminCatalogoPage'))
                    .AdminCatalogoPage,
                }),
              },
              {
                path: 'franjas',
                lazy: async () => ({
                  Component: (await import('../features/admin/pages/FranjasPage')).FranjasPage,
                }),
              },
              {
                path: 'clientes',
                lazy: async () => ({
                  Component: (await import('../features/admin/pages/ClientesPage')).ClientesPage,
                }),
              },
              {
                path: 'ajustes',
                lazy: async () => ({
                  Component: (await import('../features/admin/pages/AjustesPage')).AjustesPage,
                }),
              },
            ],
          },
        ],
      },
    ],
  },
]);
