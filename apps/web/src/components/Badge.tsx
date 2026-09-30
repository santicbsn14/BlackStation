import type { EstadoPedido } from '@blackstation/shared';
import type { HTMLAttributes, ReactNode } from 'react';
import './badge.css';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  /** Estado de pedido: toma su color (`data-estado`). Sin estado, badge neutro. */
  estado?: EstadoPedido;
  children: ReactNode;
};

export function Badge({ estado, className, children, ...rest }: BadgeProps) {
  return (
    <span className={['badge', className].filter(Boolean).join(' ')} data-estado={estado} {...rest}>
      {children}
    </span>
  );
}
