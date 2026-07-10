/**
 * @file       commands/edit-source-command.ts — undo entry for inline source edits
 * @scope      apps/studio/commands/edit-source-command.ts
 * @purpose    Reversible record of a single in-canvas direct edit that writes
 *             the canvas `.tsx` source: an inspector CSS commit/reset
 *             (`/_api/edit-css`), an inline text rewrite (`/_api/edit-text`), or
 *             a custom HTML-attribute edit (`/_api/edit-attr`). Before this
 *             command existed these edits were covered by NEITHER the Cmd+Z
 *             undo stack NOR the `_history` snapshot stack, so they were
 *             unrecoverable in-app (the reported bug). See the undo/redo
 *             coverage RCA: `.ai/logs/rca/issue-undo-redo-coverage-gaps.md`.
 *
 * Why a single `edit-source` kind for all three ops. Each is invertible
 * through the SAME endpoint by re-applying the prior value — `editCss(prop,
 * before)` undoes `editCss(prop, after)`; `null` means "remove the inline
 * prop / attr" (the reset path) or "field was unset, undo by reset". Storing
 * the op + before/after as a flat record keeps one builder + one sink.
 *
 * Origin split (DDR-054). This command runs INSIDE the untrusted canvas iframe
 * (where the undo stack lives), but `/_api/edit-*` are main-origin-only — the
 * iframe cannot fetch them. So `do()` / `undo()` route through the injected
 * `editSourceApplyFn` sink, which posts `dgn:'apply-edit'` to the parent shell;
 * the shell performs the privileged write. Records are built per iframe mount
 * from a serializable `CommandRecord` (DDR-050 rev 2) so the stack survives the
 * `mode:'module'` HMR reload that the source write triggers.
 */

import type { CommandRecord, EditCommand } from '../undo-stack.ts';
import { registerCommand } from '../undo-stack.ts';

/** Which main-origin edit route this record re-applies through. */
export type EditSourceOp = 'css' | 'text' | 'attr';

export interface EditSourcePayload {
  op: EditSourceOp;
  /** Canvas file path (repo- or designRoot-relative — same string the edit POST used). */
  canvas: string;
  /** `data-cd-id` of the target element. */
  id: string;
  /**
   * CSS property name (`op:'css'`) or HTML attribute name (`op:'attr'`).
   * Empty string for `op:'text'` (the whole text node is the target).
   */
  key: string;
  /** Value before the edit. `null` = the prop/attr was unset (undo ⇒ reset). */
  before: string | null;
  /** Value after the edit. `null` = the edit removed the prop/attr (the reset path). */
  after: string | null;
  /**
   * `op:'text'` only — which rendered instance this edit targeted (index among
   * same-cd-id DOM nodes). Needed to re-apply a `{variable}` text edit through
   * undo/redo: the engine traces the string back to the right `.map()` item or
   * component-prop usage, and that resolution needs the occurrence. Undefined
   * for literal text (the engine ignores it there) and for css/attr.
   */
  occurrence?: number;
}

/**
 * One application of an inline edit. The production binding (canvas-shell.tsx)
 * posts `dgn:'apply-edit'` to the parent shell; tests pass a spy. `value` null
 * means "reset" — remove the inline prop / attr (for `op:'text'` a null value
 * never occurs, text always has a body).
 */
export type EditSourceApplyFn = (apply: {
  op: EditSourceOp;
  canvas: string;
  id: string;
  key: string;
  value: string | null;
  /**
   * `op:'text'` re-application only — the value CURRENTLY on disk (the side we
   * replace FROM: `before` on redo, `after` on undo), so a `{variable}` edit
   * can be traced to the right source string. Plus the occurrence. Ignored by
   * css/attr and by literal-text edits.
   */
  from?: string | null;
  occurrence?: number;
}) => void | Promise<void>;

export const EDIT_SOURCE_KIND = 'edit-source';

export interface EditSourceCommandInit {
  payload: EditSourcePayload;
  applyFn: EditSourceApplyFn;
  label?: string;
}

export function createEditSourceCommand(init: EditSourceCommandInit): EditCommand {
  const { payload, applyFn } = init;
  // `from` = the value on disk BEFORE this re-application (what a `{variable}`
  // text resolver matches against). do() writes `after` over `before`; undo()
  // writes `before` over `after`.
  const apply = (value: string | null, from: string | null) =>
    applyFn({
      op: payload.op,
      canvas: payload.canvas,
      id: payload.id,
      key: payload.key,
      value,
      from,
      occurrence: payload.occurrence,
    });
  return {
    kind: EDIT_SOURCE_KIND,
    label: init.label ?? defaultLabel(payload),
    async do() {
      await apply(payload.after, payload.before);
    },
    async undo() {
      await apply(payload.before, payload.after);
    },
  };
}

/**
 * Build a persistable record. The caller (the shell's CssKnobs for css/attr,
 * canvas-shell's text commit for text) has already applied the edit once, so
 * this record is pushed onto the stack via `useUndoStack().record()` — which
 * appends WITHOUT re-running `do()` — not via `push()`.
 */
export function buildEditSourceRecord(
  payload: EditSourcePayload
): CommandRecord<EditSourcePayload> {
  return { kind: EDIT_SOURCE_KIND, label: defaultLabel(payload), payload };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry

registerCommand<EditSourcePayload>(EDIT_SOURCE_KIND, (record, sinks) => {
  const applyFn = sinks.editSourceApplyFn as EditSourceApplyFn | undefined;
  if (!applyFn) return null;
  return createEditSourceCommand({ payload: record.payload, applyFn, label: record.label });
});

// ─────────────────────────────────────────────────────────────────────────────
// Internals

function defaultLabel(p: EditSourcePayload): string {
  if (p.op === 'text') return 'edit text';
  const verb = p.after == null ? 'reset' : 'edit';
  const what = p.op === 'attr' ? `@${p.key}` : p.key;
  return `${verb} ${what}`;
}
