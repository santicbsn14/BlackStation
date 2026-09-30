import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import './table.css';

export type TableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** `end` para números y acciones. */
  align?: 'start' | 'center' | 'end';
  /** Columna angosta que no se estira (foto, switch, acciones). */
  shrink?: boolean;
};

type TableProps<T> = {
  /** Rótulo accesible de la tabla (visualmente oculto). */
  caption: string;
  columns: TableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** Fila clickeable (y activable con Enter). Los controles de la fila no la disparan. */
  onRowClick?: (row: T) => void;
  /** Fila atenuada, para registros inactivos. */
  isRowInactive?: (row: T) => boolean;
};

const INTERACTIVOS = 'a, button, input, select, textarea, label, [role="switch"]';

export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
  onRowClick,
  isRowInactive,
}: TableProps<T>) {
  function handleClick(event: MouseEvent<HTMLTableRowElement>, row: T) {
    if (event.target instanceof Element && event.target.closest(INTERACTIVOS)) return;
    onRowClick?.(row);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onRowClick?.(row);
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="u-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                data-align={col.align}
                className={col.shrink ? 'table__shrink' : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const clases = [
              'table__row',
              onRowClick && 'table__row--clickable',
              isRowInactive?.(row) && 'is-inactive',
            ].filter(Boolean);
            return (
              <tr
                key={rowKey(row)}
                className={clases.join(' ')}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? (event) => handleClick(event, row) : undefined}
                onKeyDown={onRowClick ? (event) => handleKeyDown(event, row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    data-align={col.align}
                    className={col.shrink ? 'table__shrink' : undefined}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
