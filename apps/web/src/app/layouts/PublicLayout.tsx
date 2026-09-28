import { Outlet } from 'react-router';
import { CartDrawer } from '../../features/public/carrito/components/CartDrawer';
import { CartProvider } from '../../features/public/carrito/CartProvider';
import { ProductoSheet } from '../../features/public/catalogo/components/ProductoSheet';
import { PublicHeader } from '../../features/public/components/PublicHeader';
import './publicLayout.css';

// El carrito y el detalle de producto viven acá: se abren desde cualquier pantalla pública.
export function PublicLayout() {
  return (
    <CartProvider>
      <div className="pub-shell">
        <PublicHeader />
        <main className="l-container pub-main">
          <Outlet />
        </main>
      </div>
      <CartDrawer />
      <ProductoSheet />
    </CartProvider>
  );
}
