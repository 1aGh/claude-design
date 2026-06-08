/**
 * MaudeMark — the maude brand mark, per the SIGNATURE spec
 * (.design/system/maude/preview/logo.tsx). The mark IS the spark: a filled
 * four-point star on a rounded indigo "bubble" tile whose bottom-right corner
 * is squared off (maude is a conversation with the agent). In-app it wears a
 * soft accent-tint halo. Styled via .mdcc-mark in global.css. The favicon
 * (app/icon.svg) is the same mark.
 *
 * Decorative here — always paired with the "maude" wordmark that names it, so
 * the tile is aria-hidden.
 */

/* The spark — a filled four-point star, the mark's one shape. */
function Spark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" fill="currentColor" />
    </svg>
  );
}

export function MaudeMark({ size = 22, halo = false }: { size?: number; halo?: boolean }) {
  return (
    <span
      className={`mdcc-mark${halo ? ' mdcc-mark--halo' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Spark />
    </span>
  );
}
