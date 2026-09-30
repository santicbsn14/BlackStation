import type { SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';
import './select.css';

/**
 * `<select>` nativo con el estilo de `.input` y un chevron. `className` va al contenedor; el resto
 * de las props (incluidos los `aria-*` de `fieldAria`) al `<select>`.
 */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={['select', className].filter(Boolean).join(' ')}>
      <select className="select__control" {...rest}>
        {children}
      </select>
      <span className="select__chevron">
        <Icon name="chevron" />
      </span>
    </div>
  );
}
