import Link from 'next/link';
import { Fragment } from 'react';

export type Crumb = { label: string; href?: string };

/**
 * Docs page breadcrumb with a trailing MDCC SKU.
 *
 * Format: Docs / <section> / <subsection> · <SKU>
 */
export function SkuBreadcrumb({ crumbs, sku }: { crumbs: Crumb[]; sku?: string }) {
  if (crumbs.length === 0 && !sku) return null;

  return (
    <nav className="mdcc-sku-breadcrumb" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <Fragment key={c.href ?? c.label}>
          {i > 0 ? (
            <span className="sep" aria-hidden="true">
              /
            </span>
          ) : null}
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
        </Fragment>
      ))}
      {sku ? (
        <>
          <span className="sep" aria-hidden="true">
            ·
          </span>
          <span className="mdcc-sku">{sku}</span>
        </>
      ) : null}
    </nav>
  );
}
