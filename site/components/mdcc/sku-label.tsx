import type { ReactNode } from 'react';

export function SkuLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={['mdcc-sku', className].filter(Boolean).join(' ')}>{children}</span>;
}
