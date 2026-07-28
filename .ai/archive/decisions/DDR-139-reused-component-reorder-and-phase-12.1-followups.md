# DDR-139: Reordering reused-component instances (occurrence-index → parent usage) + Phase 12.1 drag-to-reorder follow-ups

- **Date:** 2026-07-02
- **Status:** Accepted (shipped — extends `phase-12.1-layers-reorder.md`)
- **Tags:** dev-server, inspector, layers-tree, source-rewrite, reorder, drag-and-drop, component-instances, canvas-origin, undo, live-sync
- **Related:** [DDR-138](./DDR-138-jsx-node-move-reorder-and-id-resettle.md) (the node-move primitive this builds on), [DDR-019](./DDR-019-canvas-tsx-format.md) (positional `data-cd-id` — the shared-id root cause), [DDR-103](./DDR-103-phase-12-in-canvas-direct-edit.md) (Phase 12 direct-edit write model), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (canvas-origin trust → main-origin-only writes), [DDR-029](./DDR-029-artboard-activity-overlay.md) (the "agent works here" rim this suppresses for user edits). Plan: [`phase-12.1-layers-reorder.md`](../plans/phase-12.1-layers-reorder.md).

## Context

DDR-138 shipped drag-to-reorder for **distinct** elements. A long dogfood loop then surfaced several gaps, the sharpest being: **instances of the same reusable component can't be reordered.** A Kanban board's three `<Column>`s (or any `<Card>` reused N times) render N DOM nodes that all carry **one** `data-cd-id` — the id of an element *inside the component's body* (`data-cd-id = hash(componentName:preOrderIndex)` is computed per SOURCE node; the component is defined once, so all instances share it). The Layers panel greyed them "repeated — reorder in code" and the canvas drag / server move could only 422 ("empty parenthesized expression"). But the user genuinely wants to reorder the columns.

## Decision

### 1. Reorder reused-component instances by mapping DOM instance → parent USAGE

The shared id names an element inside the component body (not movable per-instance), **but each USAGE in the parent** (`<Column title="To Do"/>` …) **is a distinct, movable JSX element.** The reorder now carries the DOM **occurrence index** (which rendered instance), and the server maps `sharedInternalId + occurrenceIndex` → the `occurrenceIndex`-th `<Component>` usage before moving (`canvas-edit.ts` `resolveUsageId` + `collectElementsFull`, an element/frame/tag walk):

- The occurrence index of ANY element inside the component equals the instance index equals the usage index (render order), so a click anywhere on the instance resolves — not just its frame root.
- A `.map()`ed single-usage element (one `<Component>` inside the loop) has `usages.length <= 1` → falls through to the raw id → still 422s + reverts. The client can't tell reuse from `.map`; the server decides.
- A same-id move is now **valid** when the occurrence indices differ (two instances → two usages); only a true self-move (same id AND same index) is refused.
- Client wiring: the in-canvas drag **snapshots the pre-reflow stamped-node order** and computes each id's occurrence from that snapshot (the post-reflow live DOM would give the wrong index, since instances share the id); the Layers drag/keyboard send the tree node's `.index`. The repeated-id drag-block + greying were removed on both surfaces.
- **Not reachable:** reordering elements *within* a reused component's definition (editing the component itself) — a drag on an inner element always means "this instance." Edit the component source for that.

### 2. Reorder undo/redo via a server-side whole-file revert log — NOT inverse descriptors

A reorder churns every positional id at/after the touched span, so a stored "move A back before B" goes stale the instant it's recorded. Instead the server logs whole-file `{before, after}` per reorder under a monotonic `seq` (`api.ts` `reorderLog`, cap 50, in-memory/ephemeral); `POST /_api/reorder-revert {canvas, seq, dir}` swaps the file back. Id-churn-proof; **refuses (409) when the file changed since** (never corrupts an interleaved edit); 404 on a rotated/lost seq (honest failure). Same DDR-054 origin split as edit-*: the canvas undo-command (`commands/reorder-command.ts`) posts `dgn:'reorder-revert'`, the shell performs the main-origin-only write. The route is absent from BOTH canvas-origin allowlists; CSRF + gate + round-trip tests added.

### 3. Live-sync the Layers panel from the canvas DOM — not snapshot-on-request

The panel used to re-post its tree only on selection / explicit request, so a canvas reorder didn't reflect and vice-versa. A `MutationObserver` (`canvas-shell.tsx` `LayersLiveSync`) re-serializes + re-posts the tracked artboard's tree on any structural change — the in-canvas live reflow, a drop, or the post-write HMR — so the panel mirrors the canvas both ways with fresh ids. **The tracked artboard id lives on `window`, not a module `let`:** a source edit triggers a SOFT HMR that re-evaluates the module, and a `let` reset to null exactly when it mattered (the observer bailed post-reorder — the actual bug). The moved element is re-selected by its new id when the fresh tree lands (soft HMR fires no `dgn:'loaded'`), guarded to fire only once the tree actually contains `movedId` (a drag's preview tree carries old ids).

### 4. A rejected reorder reverts the optimistic move (no phantom "it didn't save")

The canvas applies a reorder optimistically (applyDrop) before the server confirms. A REJECTED move (a `.map`ed element, an invalid reparent) wrote nothing, so the phantom lingered until the next canvas switch re-synced from source — and Cmd+Z had no entry to undo. The shell now posts `dgn:'reorder-failed'` on a non-ok response; the canvas puts the node back (its observer re-posts the tree, so the panel reverts too); a layers-panel reorder additionally re-requests the tree.

### 5. Drop-zone + interaction polish (accepted, low-risk)

- **Whole-element 50/50 drop zone** — top/left half inserts before, bottom/right after (axis = parent flex direction); the middle third of a CONTAINER nests inside (the only way to drop into a non-empty container, so a node lifted to the root can come home); an empty container nests wholesale. No thin-divider aiming.
- **Settle-preview + FLIP** — hover a target for 500 ms and the layout reflows LIVE (the node moves there while still floating); the displaced siblings FLIP-glide (180 ms) instead of jumping; Esc aborts to the lift origin; drop commits.
- **Selection-driven keyboard model** — ↑/↓ select through the flattened tree, Alt+↑/↓ move within the parent, Alt+Shift+↑/↓ move across (out at first/last, into an adjacent open container). Driven by the SELECTION (re-selected via movedId after each move), not DOM focus, which the HMR re-render churns.
- **User edits don't light the "agent works here" rim** — the reorder/revert writes emit `activity:suppress` (internal bus, not an HTTP route); `activity.ts` swallows the next `fs:any` for that file (one-shot + 2.5 s TTL; the diff baseline still refreshes).

## Consequences

- Reordering reused components (columns, cards, any `<Component>` reused N times) works on both surfaces and persists to source. `.map()`ed data-driven lists remain non-reorderable (they'd mean reordering the array literal, not the JSX) and fail gracefully.
- The occurrence-index protocol is a small additive extension to the DDR-138 reorder shape (`idIndex`/`refIndex`, integer, validated) — no change to the positional-id model itself.
- The revert log is ephemeral: a server restart drops it (undo answers 404), acceptable for an in-session affordance; `/design:rollback`'s `_history` snapshot remains the durable path.
- Verified live in a sandbox (agent-browser, synthetic pointers) across all five surfaces + `bun test` (reorder/guard suites incl. new resolution + undo/redo/409/404/403 round-trips).
