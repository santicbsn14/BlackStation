import type { EstadoPedido } from '@blackstation/shared';
import type { ReactNode } from 'react';
import './badge.css';

type BadgeProps = {
  /** Estado de pedido: toma su color (`data-estado`). Sin estado, badge neutro. */
  estado?: EstadoPedido;
  className?: string;
  children: ReactNode;
};

export function Badge({ estado, className, children }: BadgeProps) {
  return (
    <span className={['badge', className].filter(Boolean).join(' ')} data-estado={estado}>
      {children}
    </span>
  );
}
