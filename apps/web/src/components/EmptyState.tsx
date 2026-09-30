import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import './emptyState.css';

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  icon?: IconName;
  /** Acción opcional (ej. un botón "Nuevo"). */
  action?: ReactNode;
  className?: string;
};

/** Pantalla o lista sin datos. */
export function EmptyState({
  title,
  description,
  icon = 'inbox',
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={['empty-state', className].filter(Boolean).join(' ')}>
      <span className="empty-state__icon">
        <Icon name={icon} />
      </span>
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__description">{description}</p>}
      {action}
    </div>
  );
}
