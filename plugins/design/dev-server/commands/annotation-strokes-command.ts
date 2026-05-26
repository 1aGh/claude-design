/**
 * @file       commands/annotation-strokes-command.ts — undo entry for annotation
 *             stroke add / erase / batch-translate.
 * @scope      plugins/design/dev-server/commands/annotation-strokes-command.ts
 * @purpose    Records a `Stroke[]` pair (before/after) and routes both
 *             directions through a single `putFn`. The server endpoint is
 *             `PUT /_api/annotations` which replaces the entire SVG; we
 *             match that shape rather than diffing.
 *
 *             Why per-stroke commands (not coalesced into a 300 ms window):
 *             matches Figma/FigJam — Cmd+Z reverts the most recent tap or
 *             pen stroke individually. Coalescing into windows lead to a
 *             matoucí "why did Cmd+Z erase two of my last lines?" UX.
 */

import type { Stroke } from '../annotations-layer.tsx';
import type { EditCommand } from '../undo-stack.ts';

/**
 * Push-once callable that submits a full `Stroke[]` to the server (or its
 * test stub). The annotations layer's `commitStrokes` helper wraps the
 * production fetch + cancels any pending debounced auto-save first.
 */
export type StrokesPutFn = (next: readonly Stroke[]) => void | Promise<void>;

export interface AnnotationStrokesCommandInit {
  before: readonly Stroke[];
  after: readonly Stroke[];
  putFn: StrokesPutFn;
  /** Optional label override (eraser → "erase 1 stroke"). */
  label?: string;
  /** Telemetry kind. */
  kind?: string;
}

export function createAnnotationStrokesCommand(
  init: AnnotationStrokesCommandInit
): EditCommand {
  const { putFn } = init;
  const before = init.before.map(cloneStroke);
  const after = init.after.map(cloneStroke);
  const label = init.label ?? defaultLabel(before, after);
  const kind = init.kind ?? 'annotation-strokes';

  return {
    kind,
    label,
    async do() {
      await putFn(after.map(cloneStroke));
    },
    async undo() {
      await putFn(before.map(cloneStroke));
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals

/**
 * Structured clone — works for every Stroke variant because they're plain
 * JSON-shaped (no Date / Map / DOM nodes). The pen `points: WorldPoint[]`
 * array is nested-cloned too so callers can't poison the snapshot by
 * mutating the source.
 */
function cloneStroke<T extends Stroke>(s: T): T {
  // structuredClone is available on every runtime we ship to (Bun, modern
  // browsers, Node 17+). Fall back to JSON for the rare older harness.
  if (typeof structuredClone === 'function') return structuredClone(s);
  return JSON.parse(JSON.stringify(s)) as T;
}

function defaultLabel(before: readonly Stroke[], after: readonly Stroke[]): string {
  const added = after.length - before.length;
  if (added > 0) return `add ${added} stroke${added === 1 ? '' : 's'}`;
  if (added < 0) {
    const erased = -added;
    return `erase ${erased} stroke${erased === 1 ? '' : 's'}`;
  }
  // Same count — could be translate / edit / fill-change.
  return `edit ${after.length} stroke${after.length === 1 ? '' : 's'}`;
}
