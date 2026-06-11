/**
 * DiagramFrame — shared chrome for every docs diagram primitive.
 *
 * A <figure> with: a mono part-number stamp top-left (+ accent tick), an oversized
 * faint mono watermark (the SKU's trailing segment) bleeding behind, the diagram
 * body, and a caption row. The recurring signature so the eight diagrams read as one
 * instrument-panel set. Ported from .design/ui/Docs Infographics.tsx → Frame.
 *
 * Server component — no client hooks.
 */
import type { ReactNode } from 'react';

export function DiagramFrame({
  sku,
  name,
  caption,
  ariaLabel,
  dense = false,
  bodyClassName,
  children,
}: {
  /** Mono part-number, e.g. "MDCC-DGM/MAP". The trailing segment becomes the watermark. */
  sku: string;
  /** Component name shown top-right (e.g. "ArchitectureMap"). */
  name?: string;
  /** Caption row at the bottom — also the figure's accessible name. */
  caption: string;
  /** Override the accessible name (defaults to `${name} — ${caption}` or the caption). */
  ariaLabel?: string;
  /** Tighter body padding. */
  dense?: boolean;
  /** Extra class on the body (per-diagram layout hooks). */
  bodyClassName?: string;
  children: ReactNode;
}) {
  const watermark = sku.includes('/') ? sku.slice(sku.lastIndexOf('/') + 1) : sku;
  // A <figure> is labelled natively by its <figcaption>; aria-label only when an
  // explicit override is supplied (keeps biome's a11y rules happy — no redundant role).
  const label = ariaLabel ?? (name ? `${name} — ${caption}` : undefined);
  return (
    <figure className={`mdcc-dgm${dense ? ' mdcc-dgm--dense' : ''}`} aria-label={label}>
      <span className="mdcc-dgm-wm" aria-hidden="true">
        {watermark}
      </span>
      <header className="mdcc-dgm-stamp">
        <span className="mdcc-dgm-tick" aria-hidden="true" />
        <span className="mdcc-dgm-part">{sku}</span>
        {name ? <span className="mdcc-dgm-name">{name}</span> : null}
      </header>
      <div className={`mdcc-dgm-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
      <figcaption className="mdcc-dgm-cap">{caption}</figcaption>
    </figure>
  );
}
