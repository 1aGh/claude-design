# DDR-077: HMR holds the last good render during agent editing (no white-flash on broken intermediates)

- **Date:** 2026-06-02
- **Status:** Accepted
- **Tags:** design, dev-server, hmr, canvas-lib, error-boundary, agent-activity, phase-13.1
- **Related:** [DDR-075](./DDR-075-canvas-activity-overlay-fs-watch-driven.md) (the activity overlay this builds on), Phase 8 AI-activity banner (the agent-active signal), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (canvas origin / `canvas-hmr` socket), [`.ai/plans/phase-13-canvas-activity-overlay.md`](../plans/phase-13-canvas-activity-overlay.md)

## Context

The dev-server HMR client (`templates/_shell.html`) reacts to a `.tsx` change with a hard `location.reload()`: it tears down the current canvas, then re-imports the (possibly broken) module. During **agent** editing (`/design:edit`, `/design:new`) an agent routinely saves *intermediate* states — a missing import, an undefined symbol, a half-written component — that break the build or throw at render. With the reload-first strategy each such save flashes the canvas to a **white screen** (the reload blanks the page, then the broken import/render leaves it empty) until the next good save. The user follows the agent live and the strobing is distracting and looks like a crash.

The user's constraint: fix this **only while an agent is connected**. Manual hand-editing should keep the current immediate-reload behavior (a white screen there is a useful "you broke it" signal the user wants).

## Decision

When — and only when — an agent is live-editing **this** canvas, the HMR client **soft-reloads** instead of `location.reload()`-ing, and the canvas runtime **keeps the last good render** on a broken intermediate, surfacing a non-destructive "holding" toast rather than blanking.

### Gate — agent-active

Reuse the Phase 8 `ai-activity` signal (the precise "an agent is running a slash command on this canvas" heartbeat — set before any write, 30 s grace TTL). The shell tracks `agentEditing` for its own file via the two channels `ai-banner` already uses: the parent's `dgn:'ai-activity'` postMessage relay (embedded / cross-origin canvas) and its own inspector WS frame (standalone / same-origin). No new signal, no PII — only the boolean "entry present." When `agentEditing` is false, the path is byte-for-byte the old `location.reload()`.

### Mechanism — two error classes, two defenses

1. **Build / unresolvable-import error** → `import(canvasUrl + '?v=<version>')` (cache-busted) **rejects** before anything is torn down. The shell keeps the current render and shows the holding toast. The next good build's `import()` resolves and swaps in (`window.__maudeCanvasRuntime.remount`).
2. **Render-time throw** (import succeeds, e.g. an undefined symbol referenced in JSX) → a resettable React **error boundary** (`CanvasErrorBoundary` in `canvas-comment-mount.tsx`) catches it and re-renders the **last good** canvas (tracked via an `OkSignal` commit effect that only advances `lastGood` when a subtree renders without throwing). A new attempt (`key`/`attempt` bump) clears the boundary and tries the fresh module.

The runtime publishes `remount` + `setHolding` on `window.__maudeCanvasRuntime`, the same window-handshake style the shell already uses (`__canvas_rel__`, etc.). Toast CSS rides the single injected inspector `<style>` (DDR-075 precedent) and is suppressed in `hide-chrome`/export captures.

## Consequences

- **Positive:** no white flash on a broken agent save — the canvas holds the last working render + an amber "⏸ build error — držím poslední funkční verzi" toast, and recovers (soft-swaps) when a good build lands. Manual editing is untouched (the gate fails closed to the old reload). Reuses `ai-activity` and the activity WS plumbing; no new dep.
- **Negative / accepted:**
  - **First-edit race:** if a broken save lands in the ~100–200 ms before `agentEditing` flips true (right as the agent starts), that one save hard-reloads. Covered in practice — `/design:edit` POSTs `ai/start` *before* its writes, so the bulk of a burst is gated true. (Observed once in testing, then stable across the rest of the burst.)
  - **ESM version retention:** each soft-reload imports `?v=<n>` = a new module URL the browser's module registry never GCs. Dozens–hundreds of small module objects accumulate over a long agent session; a manual/non-agent full reload clears it. Acceptable; noted.
  - **Canvas state reset per swap:** `key=attempt` remounts the subtree on each soft-reload, so in-canvas React state resets — identical to what a full reload already did, so no regression.
- **Security (self-assessed, low-risk):** `msg.version` is server-issued (`Date.now()`) and appended as a query param (`?v=`), not a path segment — no traversal; `canvas-hmr` sockets ignore inbound frames so a peer can't forge it. `window.__maudeCanvasRuntime.remount` grants no new power to canvas JS (a canvas already controls its own iframe render). The gate reads only `ai-activity` *presence*, not the author. Recommend the standard `/flow:validate` security pass still run over this diff at `/done`.
- **Tested:** `canvas-hmr-runtime.test.tsx` (happy-dom) — the boundary holds the fallback (not blank) on a throwing child + recovers on a new attempt. Live-verified end-to-end against a throwaway canvas + a simulated agent (`/_api/ai/start`): build-error save → held render + toast; good save → soft swap + toast cleared; `/_api/ai/end` → gate flips false → plain reload restored.
