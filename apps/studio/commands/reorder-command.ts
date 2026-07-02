/**
 * @file       commands/reorder-command.ts — undo entry for element reorders
 * @scope      apps/studio/commands/reorder-command.ts
 * @purpose    Reversible record of a Phase 12.1 node-move (canvas drag /
 *             Layers-panel drag / Alt+arrow keyboard move). Before this command
 *             existed a reorder was covered by NEITHER the Cmd+Z stack NOR any
 *             in-app affordance — only /design:rollback could recover it.
 *
 * Why not an inverse move descriptor. A reorder churns every positional
 * data-cd-id at or after the touched span, so a stored "move A back before B"
 * goes stale the moment it's recorded. Instead the SERVER logs the whole-file
 * {before, after} under a monotonic `seq` (api.ts reorderLog) and this record
 * stores only { canvas, seq }: undo() asks the server to swap back to `before`,
 * redo() to `after`. The server refuses (409) when the file changed since —
 * honest failure instead of corrupting an interleaved edit.
 *
 * Origin split (DDR-054). This command runs INSIDE the untrusted canvas iframe,
 * but `/_api/reorder-revert` is main-origin-only — so do()/undo() route through
 * the injected `reorderRevertFn` sink, which posts `dgn:'reorder-revert'` to the
 * parent shell; the shell performs the privileged write. Serializable payload
 * (DDR-050 rev 2) so the stack survives the HMR reload the write triggers.
 */

import type { CommandRecord, EditCommand } from '../undo-stack.ts';
import { registerCommand } from '../undo-stack.ts';

export interface ReorderPayload {
  /** Canvas file path (same string the reorder POST used). */
  canvas: string;
  /** Server-assigned revert-log sequence number (api.ts reorderLog). */
  seq: number;
}

/** Posts the revert request to the shell (production) or a spy (tests). */
export type ReorderRevertFn = (revert: {
  canvas: string;
  seq: number;
  dir: 'undo' | 'redo';
}) => void | Promise<void>;

export const REORDER_KIND = 'reorder';

export function createReorderCommand(init: {
  payload: ReorderPayload;
  revertFn: ReorderRevertFn;
  label?: string;
}): EditCommand {
  const { payload, revertFn } = init;
  return {
    kind: REORDER_KIND,
    label: init.label ?? 'move element',
    async do() {
      await revertFn({ canvas: payload.canvas, seq: payload.seq, dir: 'redo' });
    },
    async undo() {
      await revertFn({ canvas: payload.canvas, seq: payload.seq, dir: 'undo' });
    },
  };
}

/**
 * Build a persistable record. The reorder already landed (the shell POSTed
 * /_api/reorder before telling the canvas), so push via `record()` — appends
 * WITHOUT re-running do().
 */
export function buildReorderRecord(payload: ReorderPayload, label?: string): CommandRecord<ReorderPayload> {
  return { kind: REORDER_KIND, label: label ?? 'move element', payload };
}

registerCommand<ReorderPayload>(REORDER_KIND, (record, sinks) => {
  const revertFn = sinks.reorderRevertFn as ReorderRevertFn | undefined;
  if (!revertFn) return null;
  return createReorderCommand({ payload: record.payload, revertFn, label: record.label });
});
