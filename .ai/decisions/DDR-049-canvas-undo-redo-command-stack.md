# DDR-049 — Canvas undo / redo via per-canvas command-record stack

**Status:** Accepted — 2026-05-26. **Revised 2026-05-26 (rev 2)** — see § "Rev 2 — cross-canvas persistence" at the bottom.
**Supersedes:** rev 1 of this DDR ("per-iframe-ephemeral" scope) — the user-facing fix landed hours after the initial commit when bug reports surfaced two issues.
**Related:** [DDR-013](DDR-013-server-modular-split-typescript.md) (module-split + ≤300 LOC convention), [DDR-048](DDR-048-dev-server-system-view-no-shell-bias.md) (input-router classify table provenance), [DDR-027](DDR-027-canvas-meta-layout-positions-only.md) (size is JSX-authoritative — only positions persist), [DDR-046](DDR-046-canvas-chrome-three-state-halo-language.md) (HUD chrome consistency), [DDR-047](DDR-047-collab-scope-cut-no-lan-mode-hub-admin-ui.md) (Phase 8 Yjs is intentionally deferred — see "Phase 8 forward-compat" below).

## Context

Canvas iteration in the dev-server (drag artboard, marquee batch-move, equal-spacing distribute, annotation strokes, comment drop) commits every mutation straight to disk through fetch-PATCH/PUT, with **no reversal channel**. The Phase 4.2 plan explicitly deferred this: `archive/phase-4.2-artboard-free-move.md:333` — _"Undo/redo for drag commits — single-canvas undo isn't infra'd yet. Add when project-wide undo is planned."_

By Wave 3 (Phase 19) the gap was hurting. A user iterating on layout had to either:

- Open the .meta.json in a text editor and revert by hand.
- Run `/design:rollback` — but that's file-grained (rolls back the entire canvas snapshot including unrelated changes since the last auto-save).
- Live with the change and re-do it later.

None of these match the Figma muscle-memory: Cmd+Z reverses the last gesture.

## Decision

**Per-canvas in-memory command stack with Cmd+Z / Cmd+Shift+Z keyboard wiring.** Seven coordinated rules.

### 1. Command-pattern stack — NOT snapshot stack

Each mutator emits an `EditCommand { kind, label, do(), undo() }` carrying the **inverse payload** as a closure (e.g. `MoveArtboardsCommand` holds `before: ArtboardLayoutEntry[]` + `after: ArtboardLayoutEntry[]` + an injected `patchFn`). The stack is a pure reducer (`undo-stack.ts`) with no DOM / React / fetch dependencies — testable in isolation under `bun:test`.

Snapshot stacks were rejected because:

- A canvas .meta.json + .annotations.svg + .comments.json full snapshot per gesture is ~20 KB × 50 commands = 1 MB of stack memory per canvas iframe. Not catastrophic, but unnecessary.
- File-grained snapshots are already `/design:rollback`'s job — duplicating that here muddies the separation.
- Command-pattern composes naturally with future Y.UndoManager (see rule 4) — Yjs commands ARE inverse payloads.

### 2. Scope: per-canvas-iframe, in-memory, ephemeral

The `UndoStackProvider` is mounted INSIDE `<DesignCanvas>` (canvas-lib.tsx), one level above `<CanvasShell>` so both the artboard commit path (inside `DesignCanvasInner`) AND the input-router callbacks (inside the shell) read the same context. Switching canvases mounts a fresh provider with an empty stack.

No persistence across sessions. Closing the tab discards the stack. Rationale: the persistent layer IS the file, mediated by `/design:rollback`. A persisted in-memory stack would either:

- Compete with the auto-save snapshot trail (double-bookkeeping for the same intent).
- Survive code edits that change the mutator interface (the inverse payload becomes invalid).

Iframe reload (the dominant external-edit case — user saves the `.tsx`) naturally clears the stack via provider unmount. See rule 6 for the `.meta.json` edge case.

### 3. Viewport + selection are NOT undoable

Cmd+Z does not reverse viewport pan/zoom or selection changes. Figma + Sketch + tldraw all agree — viewport is _ephemeral navigation_, selection is _intent_, only edits go onto the stack. Reversing a viewport pan via Cmd+Z is jarring because the user usually moves selection via Cmd+Z _expecting_ the viewport to stay put while the edit reverts.

Concretely:

- `useViewportController.onSettle` (every 500 ms) writes viewport to meta.json — but that write is NOT routed through the undo stack. The fs:json echo from this write is dampened by `isMetaSelfEcho()` so it doesn't clear the stack as a "phantom external edit" either.
- `useSelectionSet.replace/add/clear/toggle` — no command emitted, no push.

### 4. Phase 8 forward-compat: interface freeze

When Phase 8 (Yjs live collab) lands, undo swaps to `Y.UndoManager`. The public `UndoStackValue` interface MUST stay byte-compatible — `{ push, undo, redo, clear, canUndo, canRedo, lastLabel, lastTick }`. Only the implementation flips. Reason: every consumer (canvas-lib commit path, annotations-layer commit path, the HUD, the input-router callbacks) needs to keep working through the migration without touching its call site.

This means no leaking implementation details (e.g. the current async runner's promise chain) through the interface. `EditCommand` is the user-facing shape — Y-doc commands implement the same `do() / undo()` contract.

### 5. Depth cap = 50

Ring buffer in `past`; once full, the oldest entry shifts off. 50 was picked because:

- Typical design sessions iterate 10–30 edits between a save/rollback boundary and a context switch (anecdotal — Wave 3 dogfooding).
- 50 × ~few-hundred-bytes per command ≈ 25–50 KB, well under any concern threshold.
- Larger caps tempt users to use the stack as a journaling tool, which `/design:rollback` already serves better.

### 6. External edit → stack clear, NOT merge

When the user manually edits `.meta.json` outside the dev-server (e.g. text editor), the in-memory before/after snapshots become stale — undoing would restore the file to a state that contradicts the user's external edit. Solution: **clear the stack entirely** + flash `"Edit history reset (external change)"` in the HUD.

The producer/consumer wiring:

- `canvas-lib.patchCanvasMeta` stamps `window.__maude_last_meta_self_write_at = Date.now()` before its fetch.
- `client/hmr.mjs` forwards `fs:json` events for `*.meta.json` files into the matching iframe via `CustomEvent('maude:invalidate-undo', { detail: { reason } })`.
- `use-undo-stack.tsx` Provider listens for that event. Inside a **500 ms self-echo window** after the last self-write, the event is treated as our own PATCH echoing back through `fs-watch` and ignored. Outside the window, stack clears.

Iframe reload (the .tsx case) handles itself — provider unmount discards everything. Comments + annotations have their own persistence path; they're outside scope of this invalidation but follow the same iframe-reload-on-source-change rule.

### 7. Comments are out of v0

Comments persist via WebSocket (`commentsAdd / commentsPatch / commentsDelete` in `api.ts`). An undo command for `CommentCreate` would need to call the existing `commentsDelete(id)` server endpoint — that part is fine. Where it gets messy: `commentsPatch` mutates a server-stored comment object with timestamps + author info that are NOT round-trippable through a client-side snapshot (server may have applied conflict-resolution since our snapshot).

For v0 we leave comments off the stack. Follow-up issue: design a CRDT-shaped comment undo (likely concurrent with Phase 8 Y.js when comments become Yjs-shared types).

## Implementation surface

| File | Role |
| ---- | ---- |
| `undo-stack.ts` | Pure types + reducer. `bun:test` covers push / undo / redo / branch-discard / depth cap. |
| `use-undo-stack.tsx` | React Context Provider. Owns the ref-as-authoritative-store + async runner. |
| `commands/move-artboards-command.ts` | First command — handles single drag, marquee batch, equal-spacing distribute, align (label override only — same command type per DDR-013 module discipline). |
| `commands/annotation-strokes-command.ts` | Second command — handles add / erase / translate / text. Per-stroke granularity (no coalescing window — matches Figma). |
| `commands/equal-spacing-command.ts` | Label-format helpers only. No new command type. |
| `undo-hud.tsx` | aria-live="polite" toast, 1.2 s auto-dismiss, fades via `--dur-fast` / `--dur-base` tokens, `prefers-reduced-motion` collapses to 1 ms per DDR-043. |
| `input-router.tsx` | Classify table extended with `{ kind: 'undo' | 'redo' }`; Callbacks extended with `onUndo / onRedo`. |
| `client/hmr.mjs` | Forwards `fs:json` for canvas .meta.json into iframes as `CustomEvent('maude:invalidate-undo')`. |

## Consequences

**Positive:**

- Cmd+Z works for drag, marquee batch, equal-spacing distribute, align, and annotation strokes — the most common iteration gestures.
- Per-iframe scope means switching canvases is implicitly safe (no cross-canvas undo leaks).
- No new server API. Every command replays through existing PATCH/PUT endpoints.
- Phase 8 swap is a one-file diff (provider impl) — interface is frozen.

**Negative:**

- Comments are not undo-able yet. Follow-up issue tracked.
- External `.meta.json` edits inside the 500 ms echo window are misclassified as self-writes — but in practice no human types fast enough.
- Cmd+Z held down can flood the runner promise queue. The chain is serial so writes don't race, but the user might experience a "delayed unwind" if the network is slow.

**Known risks (from plan):**

- **fs-watch echo flake** — mitigated via the 500 ms `__maude_last_meta_self_write_at` window. Could theoretically drift on a system where `Date.now()` jumps; we accept that.
- **Async command failure mid-stack** — runner catches do/undo errors via `onCommandError`, defaults to `console.warn`, and does NOT commit the state transition. Stack stays consistent; HUD's `lastLabel` doesn't update. Future polish: surface "Undo failed" toast.

## Alternatives considered

- **Snapshot stack** — rejected per rule 1.
- **Server-side undo log** — rejected: cross-tab single-source confusion, would compete with `_history/` snapshot trail.
- **Coalesce strokes into a 300 ms window** — rejected per Figma reference. Cmd+Z per individual stroke is what users expect.
- **Eager Yjs from v0** — rejected: Phase 8 hasn't gated, the Y.UndoManager API has its own contract we'd be guessing at. Better to ship the simple command-pattern now and migrate later (interface frozen makes that cheap).

## Validation

`bun test plugins/design/dev-server/` — new test files:

- `test/undo-stack.test.ts` — 9 reducer tests.
- `test/use-undo-stack.test.tsx` — 7 Provider contract tests (SSR-capture pattern).
- `test/input-router.test.ts` — extended with 9 undo/redo classify cases.
- `test/move-artboards-command.test.ts` — 11 tests (do/undo, label, deep-clone, layout diff).
- `test/annotation-strokes-command.test.ts` — 7 tests.

Manual smoke (Validation #8 in `.ai/plans/phase-20-canvas-undo-redo.md`): drag → Cmd+Z → restore; marquee batch → Cmd+Z → all restored; equal-spacing distribute → Cmd+Z → original; annotation stroke add/erase → Cmd+Z → reversed; depth cap at 50; external `.meta.json` edit → "Edit history reset"; Cmd+Z inside textarea → browser native; switch canvas → empty stack (**reverted in rev 2** — see below); cross-platform Mac Cmd+Z + Win/Linux Ctrl+Z/Y.

---

## Rev 2 — cross-canvas persistence + annotation local-state fix (2026-05-26)

The rev-1 ship was followed within hours by two real bug reports from the user:

1. **`/design:edit` annotation undo didn't visually update.** Server SVG reverted on Cmd+Z but the iframe's React `strokes` state stayed at the post-edit value. The `putStrokes` closure called the PUT but never called `setStrokesState`, so undo/redo round-tripped the server while the canvas painted stale strokes until the next user-initiated edit.
2. **Switching canvases lost history entirely.** Per the rev-1 rule "scope: per-canvas-iframe, in-memory, ephemeral," the user got an empty stack every time they re-opened a canvas they'd been editing. The user's expectation: `"Ano historie per canvas ale musi si to pamatovat i kdyz prepipan mezi canvas"` — per-canvas history, but must persist across switches.

### Fixes

**Bug 1** — fold `setStrokesState` into `putStrokes`. Every PUT (initial, undo, redo) now refreshes the iframe's local React state in the same call. The `commitStrokes` helper no longer needs its own optimistic `setStrokesState` because `push()` calls `cmd.do() = putStrokes(next)` which does both.

**Bug 2** — promote the stack from per-iframe-ephemeral to per-canvas-session-persistent. Three architectural shifts:

1. **The stack now stores `CommandRecord[]`, not `EditCommand[]`.** A `CommandRecord = { kind, label, payload }` is a fully serializable description of an edit. The `payload` carries the inverse data (full before/after layout snapshots for moves, full Stroke[] pairs for annotations) — anything the command's `do()` / `undo()` needs to replay.

2. **Commands are rebuilt per iframe mount via a registry.** Each `commands/*-command.ts` calls `registerCommand(kind, builder)` at module-load time. The builder takes a record + the current iframe's `CommandSinks` and returns a runnable `EditCommand`. Sinks (`layoutPatchFn`, `strokesPutFn`) are bound by descendants of `UndoStackProvider` via `useUndoSinks().setSink(...)` inside a `useEffect`. When the iframe unmounts, the closures it created go away — but the records survive, ready to be rebuilt against the next iframe's fresh closures.

3. **The state map lives on `window.top` (with `globalThis` fallback for tests), keyed by canvas file path.** Same-origin iframes share `window.top`, so closing Foo.tsx, opening Bar.tsx, and coming back to Foo.tsx finds `window.top.__maude_undo_stacks.get('ui/Foo.tsx')` populated with the original history. The provider's `loadStackState(canvasFile)` hydrates on mount; every reducer transition `saveStackState`s back.

### Updated rules table

Rules from rev 1 stay intact EXCEPT rule 2:

- **Rule 2 (rev 2):** **Per-canvas, in-memory, session-scoped** (was: per-canvas-iframe, ephemeral). Stack persists across canvas switches in `window.top.__maude_undo_stacks: Map<canvasFile, UndoStackState>`. Page reload destroys it (no localStorage). Multiple iframes of the SAME canvas share one stack (a degenerate case the dev-server doesn't intentionally produce, but the design tolerates).

### Why not just persist EditCommand[]?

Tried that path mentally — won't work. Each EditCommand holds closures over the iframe-mount-time `setArtboards`/`setStrokes`/`patchCanvasMeta` references. When the iframe unmounts, those refs point to dead React state. Calling `cmd.undo()` after a remount would set state on an unmounted component (no-op at best, crash at worst). The record + registry split is the minimum architecture that survives iframe lifecycle.

### Why not localStorage?

Serializable records would technically allow it. We don't because:
- An edit on canvas Foo.tsx that survives a tab close + reopen would have nothing to undo against — the file might have been edited externally between sessions, and the in-memory `before` snapshot is no longer reachable from any concrete prior file state.
- Page reload is also when external-edit invalidation should happen most aggressively (the user likely reloaded BECAUSE they edited externally).
- localStorage scope leak across multiple repos / multiple dev-server instances would be a debugging nightmare.

In-memory session scope is the right ceiling.

### Test surface added

- `test/undo-stack.test.ts` — extended with `command builder registry` (3 tests) + `cross-iframe persistence` (3 tests using `_clearStackStore()` test seam).
- `test/use-undo-stack.test.tsx` — extended with `cross-canvas persistence` (2 tests verifying state survives a captureProvider remount with the same `canvasFile`, and isolation across different canvasFiles).
- `test/move-artboards-command.test.ts` / `test/annotation-strokes-command.test.ts` — internals (createCommand) unchanged; the registry side-effect runs on module load.

Total: 461 / 461 bun tests green (was 452 after rev 1, +9 net).

### Forward-compat note unchanged

Rule 4 still holds — Phase 8 Yjs swap replaces the impl, not the interface. `UndoStackValue.push` taking a `CommandRecord` is in fact a BETTER fit for `Y.UndoManager`: Y-doc commands ARE serializable transactions, no closures involved.
