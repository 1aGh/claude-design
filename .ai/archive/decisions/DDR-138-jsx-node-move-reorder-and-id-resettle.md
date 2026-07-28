# DDR-138: JSX node-move reorder (drag-to-reorder) — deterministic span-move, positional-id re-settle, reparent guardrails

- **Date:** 2026-07-01
- **Status:** Accepted (implementing — `phase-12.1-layers-reorder.md`)
- **Tags:** dev-server, inspector, layers-tree, source-rewrite, reorder, drag-and-drop, canvas-origin, trust-boundary
- **Related:** [DDR-019](./DDR-019-canvas-tsx-format.md) (two-pass transform + positional `data-cd-id` — the identity model this move churns), [DDR-103](./DDR-103-phase-12-in-canvas-direct-edit.md) (Phase 12 direct-edit write model; this DDR implements the drag-to-reorder it spun off), [DDR-104](./DDR-104-css-panel-ux-model.md) (CSS panel UX the reorder shares chrome with), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (why the write endpoint is main-origin-only), [DDR-007](./DDR-007-stable-element-id-schema-data-dc-attrs.md) (`data-dc-element` author-semantic handles — the stable re-select key). Plan: [`phase-12.1-layers-reorder.md`](../plans/phase-12.1-layers-reorder.md).

## Context

Phase 12 shipped a browsable, click-to-select Layers tree + the deterministic `canvas-edit.ts` engine (`editAttribute` / `editText`), but DDR-103 explicitly deferred **drag-to-reorder** because it needs two things the attribute/text engine does not do:

1. **Node-move AST surgery** — relocating a whole `JSXElement` (opening tag + children + closing tag) to a new sibling/parent position, not rewriting one attribute in place.
2. **Positional-id churn** — `data-cd-id = Bun.hash(componentName + ":" + preOrderIndex)` (DDR-019). Moving a node changes the pre-order index of the moved node **and every node after it**, so all their ids renumber on the next pipeline pass. A naïve "re-select by the old id" silently selects the *wrong* element after every move.

The user wants to reorder via two surfaces — the Layers panel **and** direct drag on the canvas — and to move an element into a *different* container (reparent), e.g. "drag this `<div>` above that `<div>`".

## Decision

### 1. One deterministic source primitive — `moveElement` in `canvas-edit.ts`

Add `moveElement(canvasAbsPath, id, refId, position)` (+ pure `applyMove`) alongside `editAttribute`/`editText`, sharing the same stack: `oxc-parser` parse → `magic-string` mutate → atomic write under the per-file mutex.

- `position ∈ 'before' | 'after' | 'inside-start' | 'inside-end'`, all relative to the element with `data-cd-id === refId`.
- Locate both nodes with the existing `findOpening` walk (identical component + `jsxIndex` bookkeeping as `canvas-pipeline.ts` `walkInjectIds`).
- Move = **remove the moved element's line-span** (element + its leading newline/indent) **+ insert a re-indented copy** at the anchor derived from `refId` + `position`. Re-indent (not raw `magic-string.move`) so a **reparent** lands at the new depth's indentation. A same-parent reorder is the degenerate case where source and target indent are equal (no re-indent).
- **Deterministic over agent rewrite:** the whole point is a bounded, byte-minimal, repeatable edit reachable from a drag gesture — never a ~100 KB full-file agent rewrite.

### 2. Reparenting is in scope, guarded

`refId` may live in a different parent; the same remove+insert primitive handles it. Guardrails (throw `CanvasEditError`, write nothing):

- `id === refId` — cannot move an element relative to itself.
- `refId` is inside the moved element's own subtree — cannot move a node into itself.
- `inside-*` where the target is **self-closing / has no closing tag** — nothing to nest into.
- **Reparse gate:** the mutated source is re-parsed before it is written; any parse error aborts the write. This is the catch-all that guarantees a move never lands a corrupt `.tsx` — so we deliberately do **not** over-block valid-but-unusual shapes (e.g. inserting an element among expression children `{items.map(...)}`, which is legal JSX). Honesty over paranoia: refuse the genuinely-unsafe, let the reparse gate catch the rest.

### 3. Positional-id churn is accepted; selection re-settles by a priority chain

We do **not** try to make `data-cd-id` stable (that would mean abandoning the DDR-019 positional model). Instead the move response carries re-settle hints and the client re-selects after the HMR reload settles, in priority order:

1. **`movedId`** — the moved element's **recomputed** positional id. `moveElement` re-parses its own output and runs the *same* pipeline walk to assign ids, so `movedId` equals the `data-cd-id` the browser will carry after reload. Best-effort (ambiguous only for byte-identical duplicate elements).
2. **`semanticId`** — the moved element's `data-dc-element` value (DDR-007), if present. This author-emitted handle lives in source and survives the move **byte-for-byte**, so `[data-dc-screen] [data-dc-element="…"]` resolves it regardless of id churn. The *reliable* key when available.
3. **jsxPath** — for a same-parent reorder the moved node's tag-breadcrumb is unchanged, so the existing resolver can fall back to it.

If all three miss, selection clears and the user re-clicks — never a wrong selection masquerading as right.

### 4. One write route, main-origin only (DDR-054)

`POST /_api/reorder` sits next to `/_api/edit-css`: `sameOriginWrite` CSRF-guarded, **absent** from `CANVAS_SAFE_API` and the `startCanvasServer` routes map, so it 405s from the canvas origin (asserted in `test/canvas-origin-gate.test.ts`). It snapshots pre-move via `history.ts` (`reason: "pre-reorder"`) so `/design:rollback` and the undo stack cover a reorder, then delegates to `moveElement`.

### 5. Two surfaces, one request path — canvas requests, shell writes

The **Layers-panel** drag runs in the same-origin shell and calls `/_api/reorder` directly. The **in-canvas** drag runs in the untrusted iframe (DDR-054) and may only *request*: it posts `dgn:'reorder-request'`; the shell (main origin) performs the privileged write — exactly the `edit-text` → `/_api/edit-text` precedent. No new trust surface beyond what `edit-text`/`apply-edit` already opened: a reorder is bounded to the one canvas the user is editing.

## Consequences

- **Positive:** deterministic, byte-minimal reorder reachable from a gesture; reparent for free; undo via the existing snapshot stack; no new dependency (`oxc-parser` + `magic-string` already ship); no new trust surface.
- **Negative / accepted:** a reorder renumbers downstream `data-cd-id`s — any client holding a stale id (a queued edit, another pane) must re-resolve after reload; the re-settle chain mitigates the active selection but callers that cache ids across a reorder must re-read. Re-indent is best-effort; a reparent into a radically different depth may leave one cosmetically off block until the next edit (accepted — reparse-valid, and Prettier/agent-edit normalizes later).
- **Rejected:** (a) stable per-node uuids in source — pollutes authored TSX and fights DDR-019; (b) full-file agent rewrite from the drag — non-deterministic, ~100 KB, not gesture-latency; (c) `magic-string.move` of raw spans — cannot re-indent, so reparent output is mis-indented.
