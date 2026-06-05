# Feature: Studio UI redesign — rewrite the dev-server browser shell into the maude Design System (per `Studio.tsx`)

Validate docs and codebase patterns before implementing. Pay attention to the canvas-origin split (DDR-054 — the in-iframe overlays are untrusted, treat them differently from the shell), the CSS layer architecture (DDR-014), the committed-bundle release rule (CLAUDE.md "In-app What's New feed" + "Runtime bundles"), and the **no-break exhaustive-verify discipline** below.

> **Plan B of two.** Depends on **Plan A** (`feature-runtime-restructure-apps-packages.md`) having landed — all paths below assume the dev-server lives at `apps/studio/`. If A hasn't merged, substitute `plugins/design/dev-server/`. Do NOT start B on a moving directory.

> **⚠ Risk-class invariant (user standing rule — `feedback_no_break_exhaustive_verify`):** This is a risky dev-server refactor. **Target: 100% feature parity, zero regressions.** Inventory every existing client feature FIRST (Task 1), write a per-feature parity checklist, and verify EVERY feature live via `agent-browser` after each slice — not just at the end. A "build green" is not "feature green."

## Description

The dev-server's browser shell — the canvas file-tree, tabbed iframe viewport, menubar, status bar, design-system view, comments/inspector panels — currently lives as one 3181-line `client/app.jsx` with a bespoke, DS-agnostic stylesheet (`client/styles/*.css`, "universal — no project tokens needed"). The approved redesign (`.design/ui/Studio.tsx` + `Studio.css`, authored under the **maude** DS) re-imagines this shell as ONE cohesive dark-first studio chrome: branded menubar with real dropdowns, file-tree sidebar with collapse rail, floating canvas toolbar, right inspector/comments/CSS-knobs panel, bottom context status bar, command palette, what's-new toast, light-theme handoff dialog.

This plan **rewrites the browser shell** (`apps/studio/client/`) into real components decomposed from the mockup — `Shell · Menubar · Sidebar · CollapsedRail · FloatingToolbar · ZoomHud · Minimap · InspectorPanel · CommentsPanel · StatusBar` — adopting the maude DS token ladder and component classes as the styling source of truth.

### Scope split (load-bearing)

| Surface | Where | This plan does |
| ------- | ----- | -------------- |
| **Browser shell** (the chrome AROUND the iframes) | `apps/studio/client/app.jsx` + `client/styles/*` | **Full rewrite** into maude-DS components per `Studio.tsx`. |
| **In-canvas overlays** (inject INTO the untrusted iframe) | `apps/studio/*.tsx` (canvas-shell, tool-palette, contextual-toolbar, comments-overlay, annotations-layer, cursors-overlay, participants-chrome, …) | **Token re-skin only** — adopt maude tokens + match mockup visuals; **NO behavioral rewrite** (DDR-054 untrusted origin; their interaction logic is settled and high-risk to touch). |

The mockup shows both surfaces unified visually; only the shell is re-architected in code.

## User Story

As a Maude user, I want the studio chrome to look and feel like the cohesive maude design system — branded menubar, collapsible file tree, floating tools, a real inspector/comments panel, dark-first with a clean light handoff — so the tool that designs in maude is itself built in maude, **without losing any existing capability** (tree, tabs, new-canvas, delete, search, system view, comments, presence, tour, what's-new, theme persistence).

## Problem

- The current shell's styling is intentionally DS-agnostic — it doesn't dogfood maude, so the tool that produces maude designs looks unlike maude.
- `client/app.jsx` is a 3181-line monolith; the mockup already provides a clean component decomposition that we should land as real code.
- The maude DS (`.design/system/maude/`) has a full token ladder + component classes + preview specimens that the shell ignores.

## Solution

Adopt the maude DS into the shell bundle, then rebuild the shell slice-by-slice from `Studio.tsx`, verifying parity against the Task-1 inventory after each slice. The mockup's CSS (`Studio.css`, every value a `var(--*)` token) is the visual reference; the maude `colors_and_type.css` + `_components.css` become the token/component source the shell's `client/styles/_index.css` imports.

## Metadata

- **Type**: Refactor + Enhancement (UI)
- **Complexity**: High — full rewrite of a 3181-line client + 6-file stylesheet + token-system adoption + committed-bundle rebuild
- **App/Package**: `@maude/dev-server` (`apps/studio/client/` + `client/styles/`); in-canvas overlay `*.tsx` reskin
- **Affected Systems**: `build.ts` (client bundle + Lightning CSS), committed `dist/client.bundle.js` + `dist/styles.css`, `/design:smoke` (specimen + UI canvas gate), what's-new feed surfaces
- **Dependencies**: none new (React 19 already; maude tokens are CSS)

---

## Context References

### Must-Read Files

> Read in parallel in a single message during `/flow:execute`.

- `.design/ui/Studio.tsx` (full, 770 lines) — Why: the approved component decomposition + every visual state; the spec.
- `.design/ui/Studio.css` — Why: the maude-token CSS for every shell element (`.st-*` classes) — lift these, don't re-derive.
- `.design/system/maude/colors_and_type.css` + `preview/_components.css` — Why: the token ladder (`--bg-0..4`, `--fg-0..3`, `--accent*`, `--presence-*`, `--status-*`, `--dur-*`, `--radius-*`) + shared component classes (`.btn`, `.kbd`, `.callout`) the shell adopts.
- `apps/studio/client/app.jsx` (full) — Why: the feature surface being rewritten; Task 1 inventories it.
- `apps/studio/client/styles/{0-reset,1-tokens,2-layout,3-shell,4-components,5-utilities}.css` + `_index.css` — Why: the layered stylesheet (DDR-014) being replaced; keep the `@layer` ordering.
- `apps/studio/build.ts` (client + CSS sections, ~L84-180) — Why: bundle entrypoints + Lightning CSS input; the rebuild contract.
- `apps/studio/client/whats-new.jsx` + `client/tour/` — Why: surfaces that must survive the rewrite (what's-new badge/toast/panel, usage tour).
- The in-canvas overlay roots: `apps/studio/canvas-shell.tsx`, `tool-palette.tsx`, `contextual-toolbar.tsx`, `comments-overlay.tsx`, `annotations-layer.tsx`, `cursors-overlay.tsx`, `participants-chrome.tsx` — Why: the reskin targets; read to scope token swaps without touching logic.
- CLAUDE.md "In-app What's New feed" + "Runtime bundles" sections — Why: the committed-bundle release-rebuild rule (release-minified, commit `dist/client.bundle.js` + `dist/styles.css`).

### Design canvases

| Canvas | Status | Tags | Notes |
| ------ | ------ | ---- | ----- |
| `.design/ui/Studio.tsx` | (see meta) | maude, app-shell | **The spec.** 6 artboards: hero (live) · comments · annotate · palette · inspector · handoff. Ground every shell component here. |
| `.design/ui/Studio Hub.tsx` / `Studio Docs.tsx` / `Studio Intro Video.tsx` | new | maude | Adjacent maude surfaces — visual consistency reference, not in shell scope. |
| `.design/ui/Canvas Viewport.tsx` | modified | maude | The viewport/world chrome reference the hero stage is built from. |

### Patterns to Follow

- **Lift, don't reinvent** (CLAUDE.md "Pattern priors come first"): `Studio.css` already solves every `.st-*` chrome element in maude tokens — port it into `client/styles/` near-verbatim, adapting selectors to the real component tree. Grep the maude preview specimens before hand-rolling any new component.
- DDR-014 CSS `@layer` ordering — preserve `0-reset → 1-tokens → 2-layout → 3-shell → 4-components → 5-utilities`; the maude tokens slot into `1-tokens`, the `.st-*` chrome into `3-shell`/`4-components`.
- DDR-054 — the in-canvas overlays render in an untrusted origin; reskin via token swaps only.

---

## Design Decisions

### Components (from mockup → real code)

| Component | Source (mockup) | Notes |
| --------- | --------------- | ----- |
| `Shell` | `Studio.tsx:533` | `.maude[data-theme]` scope wrapper; `position:absolute inset:0`. |
| `Menubar` | `Studio.tsx:167` | brand mark + File/Edit/View/Selection/Tools/Help + View/Tools dropdowns + presence avatars + what's-new + stamp + file/artboard/zoom counters. Maps to current `Menubar`+`ViewDropdown`+`SelectionDropdown`+`ToolsDropdown`+`Wordmark`+`ThemeToggle`. |
| `Sidebar` + `CollapsedRail` | `Studio.tsx:216,256` | file tree (DS folders + UI canvases + runtime), search box, collapse rail. Maps to current `Sidebar`+`Tree`+`DirRow`+`DsFolderRow`+`FileRow`+`CanvasRow`. |
| `FloatingToolbar` / `ZoomHud` / `Minimap` | `Studio.tsx:274,301,289` | in-viewport chrome — reskin of the in-canvas `tool-palette.tsx` equivalents; shell renders the world-frame versions. |
| `InspectorPanel` (Inspect/Layers/CSS tabs) | `Studio.tsx:330` | new right-panel; supersedes part of current `SystemView` knobs. |
| `CommentsPanel` | `Studio.tsx:387` | right-panel comments list — wire to existing comments data source. |
| `StatusBar` | `Studio.tsx:313` | bottom context bar: active file · selected · comments · live · hub sync · theme toggle. |
| `SystemView` (Token/Type ladders) | current `app.jsx:1609-1720` | **keep** — the DS view (`__system__` tab) is not in the mockup; restyle to maude tokens, do not drop. |

### Tokens

Adopt the maude ladder verbatim (`colors_and_type.css`): surfaces `--bg-0..4`, text `--fg-0..3`, `--accent` + `--accent-fg`, `--presence-{online,agent}`, `--status-{info,success,warn,error}`, `--radius-{sm,pill}`, `--dur-*`. **No hardcoded hex** in shell CSS (the mockup is already 100% tokenized).

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| Command palette (⌘K) | mockup AB-D shows it; current shell has none | maude `components-command-palette` specimen exists — lift it. |
| What's-new toast/panel | exists (`whats-new.jsx`) — restyle to `.st-toast` | keep behavior, swap styling. |

---

## Tasks

Execute in order. Each slice ends with an agent-browser parity pass.

### Task 1: INVENTORY — enumerate every existing shell feature into a parity checklist (no code yet)

- **Do**: Read `client/app.jsx` end-to-end and produce `.ai/context/studio-shell-parity.md` — one row per user-facing capability with its trigger + expected result. Seed from the inventory already surfaced: file tree (dir/DS-folder/file/canvas rows, open-count badges, delete, show-hidden), sidebar search, **new-canvas creation flow** (name/validate/busy/error), section collapse persistence (`SECTIONS_STORE`), sidebar open persistence (`SIDEBAR_STORE`), theme toggle + persistence (`THEME_STORE`), tabbed viewport (open/close/switch iframes), **SystemView** (`__system__` tab — TokenLadder + TypeLadder + DS selector), menubar dropdowns (View panels toggles, Selection actions, Tools actions), **HelpModal + usage tour** (`USAGE_TOUR_STORE`), what's-new (badge/toast/panel, `mdcc-whatsnew-seen`), comments overlay, presence cursors, keyboard shortcuts.
- **Gotcha**: This file is the regression contract — every row must stay green through every slice. Missing a row = a silently-dropped feature (the exact failure the standing rule forbids).
- **Validate**: checklist reviewed; every `useState`/`_STORE`/dropdown/modal in `app.jsx` has a row.

### Task 2: ADD — adopt maude tokens into the shell stylesheet (`1-tokens` layer)

- **Do**: Import `.design/system/maude/colors_and_type.css` token definitions into `client/styles/1-tokens.css` (or add a `maude` token block), scoped under the shell root with `data-theme` light/dark. Bring `_components.css` shared classes (`.btn`, `.kbd`, `.callout`) into `4-components`. Keep DDR-014 `@layer` order.
- **Pattern**: the mockup pins tokens via `import "../system/maude/colors_and_type.css"` + a `.maude[data-theme]` scope (specificity 0,2,0) — replicate that scoping so the shell theme toggle drives the ladder.
- **Gotcha**: the shell currently persists `mdcc-theme` and ships `index.html` with `data-theme="dark"` — keep that contract; the maude tokens must respond to the SAME `data-theme` attribute.
- **Validate**: `bun run build.ts` (dev) → open `/design:browse` → tokens resolve, dark default intact, theme toggle flips the ladder. No visual feature broken yet (still old layout, new token values).

### Task 3: REFACTOR — Shell scaffold + StatusBar + Menubar (slice 1 of the rewrite)

- **Do**: Introduce `Shell`, `StatusBar`, `Menubar` (+ `ViewDropdown`/`ToolsDropdown`/`SelectionDropdown`) as real components ported from `Studio.tsx`, wired to the EXISTING app state (theme, active file, panels, dropdowns). Replace the old menubar/wordmark/theme-toggle markup. Port `.st-menubar`/`.st-statusbar`/`.st-dropdown` CSS from `Studio.css` into `3-shell`.
- **Pattern**: keep the existing handlers (`onMenuClick`, theme toggle, panel toggles) — only the markup + classes change.
- **Validate**: agent-browser — menubar dropdowns open/close, theme toggle persists, status bar shows active file + counts. Parity-checklist menubar/theme rows green.

### Task 4: REFACTOR — Sidebar + file tree + CollapsedRail (slice 2)

- **Do**: Port `Sidebar`/`CollapsedRail`/`TreeRow` from the mockup, mapping the existing `Tree`/`DirRow`/`DsFolderRow`/`FileRow`/`CanvasRow` data + handlers (open, delete, open-count badge, new-canvas creation, search, section collapse, show-hidden) onto the `.st-sidebar`/`.st-tree`/`.st-row`/`.st-rail` structure. Preserve all `_STORE` persistence.
- **Gotcha**: the **new-canvas creation flow** (`creating`/`newName`/`newErr`/`newBusy` state, `submitNewBoard`) is the highest-risk feature to drop — port it explicitly; the mockup's static sidebar doesn't show it, so design the affordance (the `+` in `.st-sb-hd`).
- **Validate**: agent-browser — expand/collapse sections, search filters, create a canvas end-to-end, delete a canvas, collapse the sidebar to the rail and re-expand. Every tree/sidebar parity row green.

### Task 5: REFACTOR — Viewport (tabbed iframes) + world chrome (FloatingToolbar/ZoomHud/Minimap) (slice 3)

- **Do**: Restyle the tabbed iframe `Viewport` into the `.st-stage`/`.st-world` frame; render the world-frame `FloatingToolbar`/`ZoomHud`/`Minimap` chrome from the mockup AROUND the iframe (these are shell chrome, distinct from the in-canvas `tool-palette.tsx`). Keep tab open/close/switch + the `SYSTEM_TAB` branch.
- **Gotcha**: the iframe content is the untrusted canvas (DDR-054) — the world chrome is shell-side, drawn over/around the iframe, never injected into it.
- **Validate**: agent-browser — open multiple canvases as tabs, switch, close; zoom HUD + minimap render; iframe still loads + hot-reloads. Viewport parity rows green.

### Task 6: REFACTOR — right panel: InspectorPanel + CommentsPanel + restyled SystemView (slice 4)

- **Do**: Add the `InspectorPanel` (Inspect/Layers/CSS tabs) + `CommentsPanel` as the right dock per mockup; wire CommentsPanel to the existing comments data; restyle `SystemView` (TokenLadder/TypeLadder/DS selector) to maude tokens and dock it under the `__system__` tab. Port command palette (⌘K) from the maude `components-command-palette` specimen + what's-new toast (`.st-toast`).
- **Gotcha**: `SystemView` is NOT in the mockup but is a real shipped feature — restyle, don't remove. The inspector's live-CSS-knob writeback is aspirational in the mockup (Phase-12 callout) — scope to display now unless the writeback already exists; flag in a DDR if building new.
- **Validate**: agent-browser — open `__system__` tab (token/type ladders render in maude), open comments panel, ⌘K palette opens, what's-new toast shows. Parity rows for system-view/comments/what's-new green.

### Task 7: ADD — in-canvas overlay token re-skin (NOT a rewrite)

- **Do**: Swap hardcoded colors / bespoke tokens in the in-canvas overlay `*.tsx` (`tool-palette`, `contextual-toolbar`, `comments-overlay`, `annotations-layer`, `cursors-overlay`, `participants-chrome`) for the maude ladder so the in-iframe chrome matches the shell. **No logic / DOM-structure / event-handling changes.**
- **Gotcha**: DDR-054 untrusted origin + the canvas-runtime bundles are committed/authoritative — a structural change here risks the "parse-clean, fails-at-module-eval" class (`runtime-health.sh` guards it). Keep diffs to color/token values.
- **Validate**: `maude design runtime-health --restart` clean; agent-browser on a canvas with comments + annotations + presence — overlays render in maude tokens, behavior identical.

### Task 8: VERIFY — full parity sweep + `/design:smoke` + release rebuild

- **Do**:
  1. Walk the entire Task-1 parity checklist live via agent-browser — every row green, zero regressions (the standing rule's bar).
  2. `maude design smoke` — every UI canvas + preview specimen renders, no blank iframes, no unstyled specimens.
  3. Cross-platform/responsive sanity if the shell claims any responsive behavior.
  4. **Release rebuild** (CLAUDE.md rule): `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` → commit `dist/client.bundle.js` + `dist/styles.css` (release-minified, ~250 KB — never the 3.6 MB dev bundle).
- **Gotcha**: booting the source dev-server self-heals to UNMINIFIED dev bundles; whatever is committed is what ships — the `--release` rebuild + commit is mandatory and last.
- **Validate**: parity checklist 100% green; `/design:smoke` exit 0; committed bundles are the release-minified size.

### Task 9: RECORD — DDR + what's-new entry

- **Do**: DDR for the shell-rewrite decision (maude-DS adoption, shell-rewrite vs overlay-reskin split, SystemView retention). Append a what's-new entry via the `whats-new-entry` skill ("Studio redesigned in the maude design system").
- **Validate**: DDR recorded; what's-new entry pending (version null); roadmap regen committed.

---

## Validation

1. **Build**: `cd apps/studio && bun run build.ts` (dev) then `--release` — both succeed; Lightning CSS emits `dist/styles.css`.
2. **Parity (the bar)**: every row of `.ai/context/studio-shell-parity.md` verified green via agent-browser — **zero regressions**.
3. **Smoke**: `maude design smoke` — UI canvases + specimens render styled.
4. **Runtime health**: `maude design runtime-health` — no defective dynamic builds after overlay reskin.
5. **Committed bundles**: `dist/client.bundle.js` + `dist/styles.css` are release-minified and committed.
6. **A11y**: `a11y-auditor` over the shell — contrast (maude dark + light), focus indicators, keyboard nav of menubar/tree/dropdowns, motion respects `prefers-reduced-motion`.
7. **Visual**: `/design:screenshot` shell vs `Studio.tsx` artboards — visual match.

## Acceptance Criteria

- [ ] Browser shell rewritten into maude-DS components per `Studio.tsx`; in-canvas overlays re-skinned (not rewritten).
- [ ] **100% feature parity — every Task-1 checklist row green via agent-browser, zero regressions** (standing rule).
- [ ] New-canvas creation, delete, search, section/sidebar/theme persistence, tabbed viewport, SystemView, comments, presence, help/tour, what's-new ALL preserved.
- [ ] maude token ladder adopted; no hardcoded hex in shell CSS; DDR-014 `@layer` order intact.
- [ ] `dist/client.bundle.js` + `dist/styles.css` rebuilt `--release` and committed (release-minified size).
- [ ] `/design:smoke` + `runtime-health` green; a11y 0 blockers (dark + light).
- [ ] DDR recorded; what's-new entry appended; roadmap regen committed.
- [ ] No DDR-worthy decision (SystemView retention, inspector-writeback scope) left unrecorded.
