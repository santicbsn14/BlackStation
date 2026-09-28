import type { HTMLAttributes } from 'react';
import './card.css';

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'article' | 'section' | 'li';
};

export function Card({ as: Tag = 'div', className, ...rest }: CardProps) {
  return <Tag className={['card', className].filter(Boolean).join(' ')} {...rest} />;
}
