/**
 * @file       commands/annotation-strokes-command.ts — undo entry for annotation
 *             stroke add / erase / batch-translate.
 * @scope      apps/studio/commands/annotation-strokes-command.ts
 * @purpose    Records a `Stroke[]` pair (before/after) and routes both
 *             directions through a single `putFn`. The server endpoint is
 *             `PUT /_api/annotations` which replaces the entire SVG; we
 *             match that shape rather than diffing.
 *
 *             Per DDR-050 rev 2 the runtime command is rebuilt per iframe
 *             mount from a serializable `CommandRecord` so the stack
 *             survives canvas switches. The `putFn` here also updates the
 *             iframe's local React strokes state (see annotations-layer
 *             `putStrokes`) so undo/redo visibly refresh, not just PUT.
 *
 *             Why per-stroke commands (not coalesced into a 300 ms window):
 *             matches Figma/FigJam — Cmd+Z reverts the most recent tap or
 *             pen stroke individually. Coalescing into windows led to a
 *             matoucí "why did Cmd+Z erase two of my last lines?" UX.
 */

import type { Stroke } from '../annotations-layer.tsx';
import type { CommandRecord, EditCommand } from '../undo-stack.ts';
import { registerCommand } from '../undo-stack.ts';

/**
 * Push-once callable that submits a full `Stroke[]` to the server (or its
 * test stub) AND updates the iframe's local strokes state. The
 * annotations-layer `putStrokes` is the production binding.
 *
 * `before` is the baseline THIS command's `next` was computed from — passed
 * through so the consumer can distinguish "an id `prev` still has that
 * `before` already lacked too" (a genuinely concurrent addition, fold it in)
 * from "an id `before` had that `next` deliberately dropped" (this command's
 * own delete — must stay dropped even if React's rendered state hasn't
 * caught up yet). See `reconcileCommit` in annotations-layer.tsx.
 */
export type StrokesPutFn = (
  next: readonly Stroke[],
  before: readonly Stroke[]
) => void | Promise<void>;

export interface AnnotationStrokesPayload {
  before: readonly Stroke[];
  after: readonly Stroke[];
}

export const ANNOTATION_STROKES_KIND = 'annotation-strokes';

export interface AnnotationStrokesCommandInit {
  before: readonly Stroke[];
  after: readonly Stroke[];
  putFn: StrokesPutFn;
  /** Optional label override (eraser → "erase 1 stroke"). */
  label?: string;
  /** Telemetry kind. */
  kind?: string;
}

export function createAnnotationStrokesCommand(init: AnnotationStrokesCommandInit): EditCommand {
  const { putFn } = init;
  const before = init.before.map(cloneStroke);
  const after = init.after.map(cloneStroke);
  const label = init.label ?? defaultLabel(before, after);
  const kind = init.kind ?? ANNOTATION_STROKES_KIND;

  return {
    kind,
    label,
    async do() {
      await putFn(after.map(cloneStroke), before.map(cloneStroke));
    },
    async undo() {
      await putFn(before.map(cloneStroke), after.map(cloneStroke));
    },
  };
}

/**
 * Build a persistable record from the same inputs as `createAnnotationStrokesCommand`.
 * Used by the consumer alongside the EditCommand so the runtime side-effect
 * and the stored shape share one snapshot.
 */
export function buildAnnotationStrokesRecord(opts: {
  before: readonly Stroke[];
  after: readonly Stroke[];
  label?: string;
}): CommandRecord<AnnotationStrokesPayload> {
  const before = opts.before.map(cloneStroke);
  const after = opts.after.map(cloneStroke);
  return {
    kind: ANNOTATION_STROKES_KIND,
    label: opts.label ?? defaultLabel(before, after),
    payload: { before, after },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry

registerCommand<AnnotationStrokesPayload>(ANNOTATION_STROKES_KIND, (record, sinks) => {
  const putFn = sinks.strokesPutFn as StrokesPutFn | undefined;
  if (!putFn) return null;
  return createAnnotationStrokesCommand({
    before: record.payload.before,
    after: record.payload.after,
    putFn,
    label: record.label,
  });
});

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
