# Feature: Canvas Activity Overlay — live "agent works here" indicator

> **Decision record:** [DDR-075](../decisions/DDR-075-canvas-activity-overlay-fs-watch-driven.md) (filed as -075, not the plan's reserved "-029" — that number was already taken; see the DDR's numbering note).

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — the dev-server is Bun-authoritative (DDR-009), the canvas lib is single-source in `plugins/design/dev-server/canvas-lib.tsx` (DDR-025).

## Description

When *any* agent (Claude Code via `/design:edit`, `/design:new`, an external editor, a script) modifies a canvas file under `<designRoot>`, every open canvas iframe gets a live "working here" overlay on the affected artboards — animated rim + corner badge with the file name. Pure server-side fs.watch driven, no agent-side push protocol — works for arbitrary tools, not just `/design:edit`.

## User Story

As a designer running `/design:edit` (or watching an agent iterate) I want the canvas in my browser to visibly show which artboard is being touched **right now**, so I can follow the agent's work without alt-tabbing to the terminal.

## Problem

Today the dev-server already broadcasts `fs:html` / `fs:css` / `fs:json` over WS, and the HMR broadcaster turns those into hard/soft reloads. But:

1. The reload happens after the agent has committed the edit — the user sees the *result*, not the *process*.
2. There's no visual hint of *which* artboard inside a multi-artboard canvas changed (`Smoke TSX.tsx` has Primary + Secondary + Tertiary — which one moved?).
3. Multi-canvas projects: the user has 3 tabs open; only one is being edited, but nothing differentiates them.

## Solution

Server-side activity tracker that:

1. Subscribes to existing `fs:any` bus event, filters for canvas-shaped files (`.tsx`, `.html`) under `<designRoot>`.
2. Maintains per-file activity status (`active` | `idle`) with a debounce timer — rapid saves stay `active`, ~3 s of silence flips to `idle`.
3. Broadcasts `{ type: 'activity', file, status, artboard_ids?, ts }` over the existing WS.
4. *Optionally* (MVP+1): diff prev vs current file content to figure out which `<DCArtboard id="...">` blocks changed and ship that as `artboard_ids`. When absent → client highlights every artboard in the file.

Client (canvas-lib):

5. New `ActivityContext` fed by WS `activity` messages, keyed by canvas file.
6. `DCArtboard` reads the context. When `activity.file === this canvas's file` and (`artboard_ids` absent OR includes `id`), renders an `<ArtboardActivityOverlay>` — animated rim + top-right badge `editing — <basename>`.
7. Animation is compositor-only (`transform` + `opacity`), respects `prefers-reduced-motion` (per `flow:motion-rules`).

## Metadata

- **GitHub Issue**: none yet (file via `/flow:done` if desired)
- **Type**: New Capability
- **Complexity**: Medium
- **App/Package**: `plugins/design/dev-server` + injected canvas runtime
- **Affected Systems**: dev-server bus, WS protocol, canvas-lib runtime, _shell.html
- **Dependencies**: none (Bun-native, no new packages)

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/fs-watch.ts` (full, ~50 lines) — Why: where `fs:any` is emitted; we'll either add `fs:tsx` here or subscribe to `fs:any` and filter
- `plugins/design/dev-server/ws.ts` (lines 38–55) — Why: where bus events become WS broadcasts; add the `activity:change` → `{type:'activity'}` line here
- `plugins/design/dev-server/hmr-broadcast.ts` (full, ~120 lines) — Why: existing pattern of "fs event → debounced classifier → WS payload" — mirror its shape
- `plugins/design/dev-server/context.ts` — Why: where `ctx.bus` and paths come from; activity module is constructed there
- `plugins/design/dev-server/server.ts` (lines 28–48) — Why: where Inspect/Api/Ws are wired; add `createActivity(ctx)` here
- `plugins/design/dev-server/canvas-lib.tsx` (lines 1283–1407, `DCArtboard` body) — Why: where the overlay portal hooks in; reuse the existing `useWorldContext` rect logic
- `plugins/design/dev-server/canvas-lib.tsx` (lines 200–230, world context) — Why: pattern for adding a new React context published by `DesignCanvas`
- `plugins/design/dev-server/canvas-shell.tsx` — Why: where the WS client lives in the iframe; activity reducer lands next to the existing `selected` / `fs:*` handlers
- `plugins/design/dev-server/inspect.ts` (lines 50–80) — Why: snapshot pattern — `ActiveState` includes `last_change` already; we'll add `activity` to the WS-open snapshot the same way
- `plugins/design/dev-server/test/annotations-layer.test.ts` — Why: existing `bun:test` shape to mirror

### Files to Create

- `plugins/design/dev-server/activity.ts` — activity tracker module (per-file status + debounce + bus event)
- `plugins/design/dev-server/use-canvas-activity.tsx` — React hook + context provider for the iframe runtime
- `plugins/design/dev-server/artboard-activity-overlay.tsx` — overlay component (rim + corner badge)
- `plugins/design/dev-server/test/activity.test.ts` — bun:test for transitions + debounce
- `plugins/design/dev-server/test/use-canvas-activity.test.tsx` — context provider gating

### Documentation

- [`.ai/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md`](.ai/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md) — Why: new server module uses `Bun.*` APIs, not `node:fs`; tests use `bun:test`
- [`.ai/decisions/DDR-025-canvas-lib-single-source-in-dev-server.md`](.ai/decisions/DDR-025-canvas-lib-single-source-in-dev-server.md) — Why: don't even think about copying overlay component into `<designRoot>/_lib/` — single source in dev-server
- `plugins/flow/skills/motion-rules/SKILL.md` — Why: animation hard-stops (durations, easing, compositor-only, reduced-motion)
- `plugins/flow/skills/a11y-rules/SKILL.md` — Why: overlay must be `aria-hidden` (decorative) but respect motion preferences

### Patterns to Follow

**Debounced fs → bus emit** (mirror `hmr-broadcast.ts:96`):

```ts
const offAny = ctx.bus.on('fs:any', (rel: string) => {
  if (!isCanvasFile(rel)) return;
  markActive(rel);          // sets status=active, schedules idle-timer
});
```

**WS broadcast wiring** (mirror `ws.ts:42`):

```ts
ctx.bus.on('activity:change', (payload) =>
  broadcast({ type: 'activity', ...payload })
);
```

**React context published from canvas root** (mirror `useWorldContext` in `canvas-lib.tsx:200`):

```tsx
const ActivityCtx = createContext<ActivityState | null>(null);
export function useCanvasActivity() { return useContext(ActivityCtx); }
```

**Bun:test shape** (mirror `test/annotations-layer.test.ts`):

```ts
import { describe, expect, test } from 'bun:test';
import { createActivity } from '../activity.ts';
```

---

## Design Decisions

> This is an internal dev-tool overlay (not a project-DS-bound canvas surface), so there's no app design system to lift from. Visual choices follow the dev-server's own minimalist aesthetic already used by selection rings and snap guides in `canvas-lib.tsx` + the inspector outline injected by `inspect.ts`.

### Visual contract

| Element | Spec |
| ------- | ---- |
| Rim | 2 px solid outline, color = `currentColor` with reduced alpha, animated `box-shadow` pulse (compositor-only via `opacity`) |
| Corner badge | top-right, 4 px from artboard edge, `position: absolute`; small pill: `editing — <basename>`; tabular-nums typeface |
| Color | reuse existing inspector hue (~ `hsl(210 90% 58%)`) but distinct from selection ring (which is the same hue but on click); activity uses a different *animation*, not a different hue |
| Pulse | 1.2 s ease-in-out loop, `opacity 0.4 ↔ 1`. `@media (prefers-reduced-motion: reduce)` → static rim, no pulse |
| Z-index | above artboard chrome, below selection ring & snap guides (so selection still reads on top) |
| Duration | overlay shows as long as `status === 'active'`. Server flips to `idle` after **3000 ms** of fs silence. Client cross-fades out in 200 ms. |

### Behavior contract

- **MVP scope**: file-level highlight. Every `DCArtboard` inside the changed file pulses simultaneously. Corner badge text = `editing — <basename of file>`.
- **Stretch (Task 7)**: per-artboard via cheap text-diff of prev vs current file content, scoped to `<DCArtboard id="X">` … `</DCArtboard>` regions. When unambiguous, only the changed artboards pulse and the badge reads `editing — <file>:<artboard label>`.
- **Element-level**: explicitly out of scope for this phase. User confirmed "artboard stačí". Add as Phase 13.1 if there's demand.
- **Agent-agnostic**: triggered purely by fs.watch — `/design:edit`, `/design:new`, manual editor saves, `git checkout` of a canvas file all light up identically. No slash-command coupling.

### Token usage (dev-server internals — not project DS)

| Purpose | Source |
| ------- | ------ |
| Rim color | CSS var `--mdcc-activity` injected at runtime alongside the existing inspector style block in `inspect.ts:injectInspector()` |
| Badge typeface | `font-family: ui-monospace, …` (matches snap-guide labels in `canvas-lib.tsx`) |
| Animation duration | inline `--mdcc-activity-pulse-ms: 1200ms` so a single override env-var can tune it for video capture / demos |

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `ArtboardActivityOverlay` | No prior overlay primitive — selection ring and ghost are inline JSX inside `DCArtboard`. Build a dedicated, reusable component because the overlay also needs to render the badge slot. | none |
| `CanvasActivityProvider` | Context provider attached at the canvas-shell root, subscribes to WS `activity` messages. | none |

---

## Tasks

Execute in order. Each task is atomic and testable. Tasks 1–5 = MVP. Task 6 = ship it. Task 7 = stretch.

### Task 1: ADD canvas-file classifier helper

- **Do**: in `activity.ts`, export `isCanvasFile(rel: string): boolean` — true for `.tsx` or `.html` under `<designRoot>` minus `_history/`, minus `node_modules`, minus DS preview specimens (`system/*/preview/*.html` — those are not user-facing canvases). Reuse the SKIP_DIRS spirit from `api.ts:13`.
- **Pattern**: `api.ts` already has `SKIP_DIRS` + `HIDDEN_OK` — mirror those exclusions.
- **Gotcha**: `system/<ds>/preview/*.html` IS a real fs:any event during DS work; excluding it prevents false-positive overlays when a critic edits a DS preview.
- **Validate**: `bun test plugins/design/dev-server/test/activity.test.ts` — write test cases for each branch.

### Task 2: CREATE `activity.ts` tracker module

- **Do**: export `createActivity(ctx: Context): Activity` with shape:
  ```ts
  interface Activity {
    /** WS-open snapshot. */
    state: Record<string, { status: 'active' | 'idle'; ts: string }>;
    /** Test seam — manual mark for unit tests. */
    mark(file: string): void;
  }
  ```
  Internally: subscribe to `ctx.bus.on('fs:any', ...)`. Filter via `isCanvasFile`. On match → set state to `active`, clear any pending idle timer for that file, schedule a new one (3000 ms) that flips to `idle` and emits `activity:change`. Emit `activity:change` on the *transition into active*, on every refresh-while-active (so clients reset their fade-out timer), and on the flip to idle.
- **Pattern**: `hmr-broadcast.ts` for the debounce-then-emit shape. Use `setTimeout` / `clearTimeout` (Bun supports both natively).
- **Gotcha**: DON'T use the existing `fs:html` event — `fs-watch.ts:32` shows only `.html` / `.css` / `.json` get type-specific events; `.tsx` only fires `fs:any`. Subscribing to `fs:any` is the only path that catches both.
- **Validate**: unit test transitions: idle → active (on first event), active → active (rapid events keep timer fresh), active → idle (after 3 s of silence). Use `bun:test`'s fake timers if available, else inject a `now()` function into the module for testability.

### Task 3: WIRE activity into server bootstrap

- **Do**: in `server.ts`, construct `const activity = createActivity(ctx);` between `inspect` and `ws`. Pass into `createWs(ctx, api, inspect, activity)`. In `ws.ts`: subscribe to `ctx.bus.on('activity:change', ...)` and broadcast `{ type: 'activity', file, status, artboard_ids, ts }`. Include `activity.state` in the `snapshot` payload sent on `open` (next to `inspect.state`).
- **Pattern**: `ws.ts:38–55` is the existing forwarder block.
- **Gotcha**: keep the WS message envelope stable — clients already have a `type` discriminator switch in `canvas-shell.tsx`; we're adding a new case, not renaming existing ones.
- **Validate**: `bun test plugins/design/dev-server/test/` — adjust the existing `createWs` signature in tests if changed.

### Task 4: ADD `CanvasActivityProvider` + `useCanvasActivity` hook

- **Do**: in `use-canvas-activity.tsx`, build a React context provider that:
  1. Reads the initial WS snapshot's `activity` field.
  2. Listens for `{type:'activity', ...}` messages on the existing WS connection (use the same EventTarget / message-bus pattern as `use-annotation-selection.tsx`).
  3. Exposes `useCanvasActivity(file: string): { status: 'active' | 'idle'; artboardIds: string[] | null }`.
  4. Internally fades out 200 ms after status flips to `idle` (clients shouldn't show a jarring snap-off).
- **Pattern**: `use-annotation-selection.tsx` (new file at repo root of dev-server) is the closest analog — same WS subscription shape.
- **Gotcha**: the provider lives at canvas-shell root; `DCArtboard` instances inside `DesignCanvas` are descendants. Make sure the provider wraps `DesignCanvas`, not the other way around (otherwise the world-coord rect math context and the activity context fight for the same tree position — they don't, but mind the wrap order).
- **Validate**: `use-canvas-activity.test.tsx` — feed mock WS messages, assert hook return values.

### Task 5: ADD `ArtboardActivityOverlay` + integrate into `DCArtboard`

- **Do**: in `artboard-activity-overlay.tsx`, build:
  ```tsx
  export function ArtboardActivityOverlay({ rect, label }: { rect: Rect; label: string }) {
    return <div className="dc-activity-rim" aria-hidden style={{...}}>
      <span className="dc-activity-badge">editing — {label}</span>
    </div>;
  }
  ```
  In `canvas-lib.tsx:1283` (`DCArtboard`): after `rect` is resolved, call `useCanvasActivity(currentFile)`. If `status === 'active'` and (`artboardIds === null || artboardIds.includes(id)`) render `<ArtboardActivityOverlay rect={rect} label={fileBasename + (artboardIds ? ':' + label : '')} />` as a sibling of the existing `<article>`, positioned absolutely at the same `rect` coords.
- **Pattern**: the existing `dc-artboard-ghost` div in `canvas-lib.tsx:1393–1402` is the exact rendering pattern (sibling absolute element keyed off rect coords).
- **Gotcha**: `currentFile` needs to be available inside `DCArtboard`. The easiest path: `DesignCanvas` already knows its file via the world context; extend `WorldContext` with `currentFile` and read it in the same `useWorldContext()` call.
- **Gotcha 2**: motion-rules: pulse animation MUST be opacity/transform only. Don't animate `border-color` or `box-shadow` directly — animate a child pseudo or wrap the rim in a div with `opacity`. Reduced-motion → static rim, no pulse.
- **Validate**: render `DesignCanvas` in a test harness with a mocked active activity → assert overlay is in the DOM. With status idle → asserted absent.

### Task 6: STYLE the overlay (inspector-style block)

- **Do**: extend `inspect.ts:injectInspector()` to append the activity CSS rules to the existing injected `<style>` block — `dc-activity-rim`, `dc-activity-badge`, the `@keyframes` for the pulse, and the `@media (prefers-reduced-motion: reduce)` override. Keep rules scoped (`html .dc-activity-rim { … }`) so canvas-page stylesheets can't accidentally clobber them.
- **Pattern**: `inspect.ts` already injects inspector outline CSS the same way.
- **Gotcha**: this CSS rides inside the canvas iframe, NOT the outer dev-server UI. Don't try to add it to `app.jsx`.
- **Validate**: open `/design:edit "tighten Primary density"` against a smoke canvas → observe pulse in the Primary artboard for ~3 s after each Edit/Write tool call. Manually toggle `Settings → Reduce motion` in macOS → confirm static rim.

### Task 7: STRETCH — per-artboard diff detection

- **Do**: in `activity.ts`, stash last-seen text per canvas file (via `Bun.file(...).text()` on first sight, cached in-memory). On every fs:any → re-read file, run a cheap line-region diff scoped to `<DCArtboard\s+id="([^"]+)"` markers, emit `artboard_ids: string[]` when at least one block changed and at most one file was touched. When parse is ambiguous (no `<DCArtboard` matches found, or text changed outside any artboard) → omit `artboard_ids` and fall back to file-level.
- **Pattern**: deliberately not AST-based — a regex-bounded string diff is sufficient for the MVP fidelity bar; AST parsing for TSX would require bringing in `@babel/parser` which violates DDR-009's "stay zero-dep where reasonable" spirit.
- **Gotcha**: stash size — cap at last 50 files seen; LRU evict.
- **Gotcha 2**: don't read the file synchronously inside the bus handler; use the existing `seen` debouncer to read at most once per debounce window.
- **Validate**: write a unit test feeding two TSX snippets that differ inside `<DCArtboard id="secondary">` only → assert payload contains `artboard_ids: ['secondary']`.

### Task 8: UPDATE `/design:edit` docs (light)

- **Do**: in `plugins/design/commands/edit.md` add a tiny note (1–2 lines) near step 3 / 7 that the user "will see an activity overlay on the affected artboard while edits land — no action required". Same for `plugins/design/commands/new.md` step 9.
- **Pattern**: keep it short, non-load-bearing — this is purely informational because the feature is automatic.
- **Validate**: re-render `/design:help` and `/design:edit --help`; confirm no markup regression.

### Task 9: ADD DDR

- **Do**: file `.ai/decisions/DDR-029-canvas-activity-overlay-fs-watch-driven.md` recording: (a) why we chose fs.watch over agent push (agent-agnostic, no protocol to maintain), (b) the 3000 ms idle debounce constant, (c) the decision to ship file-level MVP and gate per-artboard behind Task 7, (d) why we extended `inspect.ts:injectInspector` instead of shipping a separate CSS file (single injection point keeps the canvas iframe self-contained).
- **Pattern**: `.ai/decisions/DDR-025-…` is the closest neighbor in size and shape.
- **Validate**: `ls .ai/decisions/` shows the new file; cross-link from `phase-13-canvas-activity-overlay.md`.

---

## Validation

Run these commands to confirm zero regressions:

1. **Types**: `bun --cwd plugins/design/dev-server tsc --noEmit` (or equivalent if a script exists)
2. **Tests**: `bun --cwd plugins/design/dev-server test` — must include the new `activity.test.ts` and `use-canvas-activity.test.tsx`
3. **Smoke**: start the dev-server against this repo (`npm run dev`), open the existing `Smoke TSX` canvas at `/Smoke%20TSX.tsx`, run `/design:edit "trivial nudge"` in a separate Claude Code window, watch the overlay pulse for ~3 s on each Edit/Write tool call, then fade.
4. **Multi-canvas smoke**: open 3 canvases (Canvas Viewport, Docs Site, Smoke TSX), edit only Smoke TSX → confirm only that tab pulses.
5. **Reduced motion**: toggle macOS Reduce Motion → confirm rim is static (no pulse) but still visible.
6. **Manual fs touch**: `touch .design/ui/Smoke\ TSX.tsx` → confirm overlay still fires (proves agent-agnostic path).
7. **Cross-platform scenario**: NOT required — this feature is dev-tool-only, never ships to end users; no app-side surface to validate across web-mobile / ios / android.
8. **Design System Guard / a11y-auditor**: NOT required for the same reason; the overlay is `aria-hidden` decorative chrome and explicitly respects `prefers-reduced-motion`.

---

## Scenario Coverage (UI tasks — required)

> Marked **N/A** for this feature. The overlay is internal dev-tooling living inside the canvas iframe injected by the dev-server; it has no presence in any shipped product, so the cross-platform scenario harness doesn't apply. The smoke checklist above (Validation §3–§6) is the substitute.

---

## Acceptance Criteria

- [x] All 9 tasks completed (Task 7 per-artboard diff shipped, not deferred)
- [x] `bun test` passes for the dev-server workspace — 1082 pass / 0 fail, incl. `activity.test.ts`, `use-canvas-activity.test.tsx`, `artboard-activity-overlay.test.tsx`
- [x] Visible rim + corner badge on a canvas edit (verified live via agent-browser: `touch` → rim + badge "editing — Smoke TSX.tsx")
- [x] Multi-canvas (§4) confirms scoping by file (touching Smoke TSX leaves Canvas Viewport dark)
- [x] Reduced-motion (§5) — `@media (prefers-reduced-motion: reduce)` drops the pulse to a static rim (served + verified)
- [x] Manual touch (§6) confirms agent-agnostic trigger (the whole live proof used `touch`, not a slash command)
- [x] No regression — canvas renders cleanly (artboard + body, no mount error); 1082 tests green; overlay coexists with existing chrome
- [x] DDR filed (**DDR-075** — "-029" was already taken) and cross-linked from this plan
- [x] No DDR-worthy decision left unrecorded — DDR-075 covers the 3 s debounce, file-level-first scope, inject-into-inspector CSS, fs-watch-vs-push, the cross-bundle provider placement, and the snapshot-seed-across-reload
- [x] Code follows conventions: `Bun.file`/`setTimeout` in `activity.ts` (no `node:fs` reads), `bun:test` for tests, single-source canvas-lib (overlay lives in dev-server `canvas-lib.tsx`, no `_lib/` shadow), `name:`/namespace conventions N/A (no new command)

---

## Retro

- **fs-watch over agent-push was the right call.** The overlay (and everything built on it) is agent-agnostic for free — `/design:edit`, manual saves, `git checkout` all light up identically, no protocol to version. Worth the "no author attribution" tradeoff (which 13.2 then recovered from `ai-activity` separately).
- **The cross-bundle React-context trap bit twice.** comment-mount.js and canvas-lib are separate bundles, so a provider mounted in one is invisible to consumers in the other (DCArtboard saw `null`). Both the activity context (13) and the agent context (13.2) had to live in `DesignCanvas` (canvas-lib), matching how the real ToolProvider already does. Captured in DDR-077; this should be a known prior for any future canvas-runtime context.
- **HMR + overlays interact — verify the composition, not just the unit.** 13.1's soft-reload remount reset the activity provider and silently dropped the overlay until I made `_shell.html` keep a live `__maude_activity_seed__`. Unit tests were green throughout; only the live agent-browser run surfaced it. The `no-break-exhaustive-verify` rule earned its keep.
- **Visual iteration is cheap when it's injected CSS.** 13.3 went through ~5 looks (scan beam → too forceful → wave → invisible → tide → "beam again" → final descending hard-edge wave) entirely in `inspect.ts` strings with no rebuild and a screenshot/short-video loop. Two gotchas paid for: a backtick in an injected-CSS comment crashed boot (the whole INSPECTOR_SCRIPT is a template literal), and `overflow:hidden` on the rim clipped the agent border's glow.
- **The adversarial security pass found a real (if gated) spoof.** The `ai-activity` postMessage listeners trusted any sender; fixed in-flight with an `e.source === window.parent` guard across all three (incl. the pre-existing ai-banner). Lesson: when a feature *amplifies* a pre-existing accepted residual (here, into a named/durable identity), re-weigh that residual rather than inheriting its acceptance.
- **Process:** four sub-phases (13 → 13.1 → 13.2 → 13.3) accreted from live user feedback after the first `/flow:validate`. Worked, but next time fold a known multi-part visual feature into one plan with explicit sub-phase acceptance rows so the validate/done gate runs once at the end, not mid-stream.
