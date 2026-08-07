/**
 * @file artboard-hug-commit.ts
 * @purpose Pure decision for what the Artboard Inspector's Height field
 *          should do when a value is committed (issue #79 — typing a height
 *          while the artboard hugs its content silently did nothing; Width
 *          worked because it has no such mode). Kept framework-free + in a
 *          .ts file so it's unit-testable (app.jsx is bundled JSX, and its
 *          module-scope `createRoot(...).render(...)` makes it unsafe to
 *          import directly in a test) — same shape as sizing-mode.ts.
 */

export type HeightCommitAction =
  | { kind: 'resize'; height: number }
  | { kind: 'promote-to-fixed'; height: number }
  | { kind: 'noop' };

/**
 * Fixed mode: a typed height is an ordinary resize, same lane as Width.
 * Hug mode (DDR-027 Design Decision 1 — height is a content-driven floor,
 * not an exact size): a typed height now PROMOTES the artboard to Fixed at
 * that height — the same "freeze current height" write the Hug/Fixed
 * segmented toggle already performs, just seeded from the typed value
 * instead of the last measured one — rather than being silently dropped.
 */
export function resolveHeightCommit(fixed: boolean, typedHeight: number): HeightCommitAction {
  const height =
    Number.isFinite(typedHeight) && typedHeight > 0 ? Math.round(typedHeight) : undefined;
  if (height == null) return { kind: 'noop' };
  return fixed ? { kind: 'resize', height } : { kind: 'promote-to-fixed', height };
}
