# Phase 3.5: Dev-server UI/UX refresh (shell only — viewport stays)

> **STATUS — 2026-05-15** · Design stage **DONE** on `project` DS (MDCC-DSN/01 — industrial-catalogue, Paper & Ink, Berkeley-Mono, hard-edges). Mocks live in [`.design/ui/Canvas Viewport.html`](../../.design/ui/Canvas%20Viewport.html) (10 artboards, `designSystem: "project"`). Implementation tasks 4–10 below are now actionable against the **`project` DS at `.design/system/project/`** — token names, font stack, radii, and density rules in this plan are aligned with that DS.
>
> **Coverage matrix (mocks → original sub-deliverables):**
> | Original mock                | Status     | Canvas Viewport artboard (CV-NN) |
> | ---------------------------- | ---------- | -------------------------------- |
> | Shell-overview at desktop    | ⚠ implicit | CV-01 IDLE INFINITE CANVAS = inner viewport + minimap + zoom toolbar + brand wordmark. **Surrounding chrome** (header + tabs row + statusbar wrap) is **NOT separately mocked** — implementation rebuilds it from `project` DS specimens (`.design/system/project/preview/`) + CV-08 sidebar layout. Accepted as no-mock-needed per user sign-off 2026-05-15. |
> | Sidebar tree (states matrix) | ✅ done    | CV-08 PROJECT + DS TREE — search input, sections PROJECT / DS / UI / RUNTIME, disclosure glyphs ▾▸, hover/active accent row, modified dot, unread badge "3", selected-file detail pane on right. |
> | Tabs + statusbar matrix      | ⚠ implicit | NOT a dedicated artboard — implementation derives from `project` DS specimens (tabs, status-row patterns) + CV-01's existing status row. Accepted per user sign-off 2026-05-15; if a regression appears at impl time, raise via `/design:edit` against `Canvas Viewport.html` adding CV-11. |
> | System view                  | ✅ done    | CV-09 DESIGN SYSTEM VIEW — token surface ladder + 8-step type ladder at actual size + 8 specimen thumbnails. |
> | Comments panel               | ✅ done    | CV-10 COMMENTS SIDEBAR — 380 px right sidebar over canvas-context, ALL/OPEN/RESOLVED tabs, expanded thread + collapsed items + 1 resolved muted. |
>
> **Designs hotové (2026-05-15)** — design stage tasks 1–3 closed; jdeme na implementaci. Token migration v Task 5 cílí na `project` DS, ne `studio`.

## Description

Refresh the dev-server's **shell chrome** — header, sidebars, file tree, tabs, status bar, system view, comments panel — driven by the mocks in [`.design/ui/Canvas Viewport.html`](../../.design/ui/Canvas%20Viewport.html) (artboards CV-08, CV-09, CV-10 are the load-bearing references for this phase; CV-01 anchors the viewport-area density). Theme + typography migrate from the placeholder "universal zinc grayscale" tokens (`--u-*` in `client/styles.css`) to the **`project` DS** at [`.design/system/project/colors_and_type.css`](../../.design/system/project/colors_and_type.css) — Berkeley Mono everywhere, OKLCH Paper & Ink ladder, hard-edges (radii 0/2/4), 1px hairline borders, no blur shadows, no gradients in chrome.

**Out of scope:** the canvas viewport itself (iframes + flexbox layout). Phase 4 rewrites that with Pixi.js — touching the viewport now would be wasted work.

## User Story

As a designer opening `mdcc design serve`, I want the dev-server to look like a finished v1 product (project DS aesthetic, amber-rust stamp accent on Paper & Ink, Berkeley-Mono typography, catalogue-tight density) so that the tool feels worth using — not like a placeholder that's been "good enough" since v0.5.

## Problem

- `client/styles.css` ships a hand-rolled neutral zinc palette (`--u-bg-*`, `--u-fg-*`, sky-400 accent) with no relationship to the `project` DS the marketplace + canvas already use.
- Berkeley Mono / JetBrains Mono never made it into the dev-server — it still uses Inter + JetBrains Mono fallbacks (sans-serif UI body) instead of the all-mono `project` philosophy.
- Visual density, spacing, hierarchy, radii, and border weights in header / tree / tabs / status bar were sized ad-hoc; the `project` DS specifies hard-edges + 1px hairlines + 4 px spacing base that the current shell ignores.
- Light theme support missing — `project` DS is two-theme (paper-light + phosphor-dark, both equal), dev-server only ships dark.

## Solution

Two stages (design closed, code remaining):

1. **Design stage — ✅ DONE.** Mocks in `.design/ui/Canvas Viewport.html` cover sidebar-tree (CV-08), DS view (CV-09), and comments panel (CV-10). User signed off on no separate full-chrome / tabs-statusbar artboards — those will be built from `project` DS specimens + analogy to CV-08's left-pane density.
2. **Token migration** — Replace `--u-*` token block in `styles.css` with an import (or selective copy) of `.design/system/project/colors_and_type.css`. Drop the Google-Fonts Inter/JetBrains link; wire Berkeley Mono via the `project` DS asset path (or its public CDN if local files unavailable) with JetBrains-Mono fallback. Add light-theme toggle wired to `[data-theme="light"|"dark"]` on `<html>`.
3. **Shell refactor** — Re-style + minor re-structure of chrome components in `app.jsx` to match the approved CV-08/09/10 mocks. **Keep `Viewport`/iframe rendering byte-identical** so phase 4 lands cleanly on top.

## Metadata

- **Type:** Refactor (visual + minor structural)
- **Complexity:** Medium
- **App/Package:** `plugins/design/dev-server/` (shell only)
- **Affected Systems:** dev-server client (React UI), project DS consumers
- **Depends on:** **Phase 3.4** (Bun runtime + `build.ts` orchestrator + Preact + 7-module server split + `client/styles/` `@layer` architecture + per-platform binary distribution) must land first. This phase consumes 3.4's bundled `index.html`, the Lightning-CSS-emitted `dist/styles.css`, and the existing `1-tokens.css` `@layer` for the DS import.
- **Dependencies (npm):** `project` DS already bootstrapped (`.design/system/project/`); no new npm deps; Berkeley Mono webfont (or self-hosted asset under `.design/system/project/assets/`).
- **Blocks:** phase-4 (will land on refreshed shell — viewport rewrite stays clean)

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/client/app.jsx` (1000 LOC) — single React file, components: `Tree`, `Tabs`, `Viewport`, `Header`, `StatusBar`, `SystemView`, `CommentsPanel`. **Touch everything except `Viewport`.**
- `plugins/design/dev-server/client/styles/1-tokens.css` (created in Phase 3.4) — this is the `@layer tokens` source that `@import`s `.design/system/project/colors_and_type.css`. Phase 3.5's work is **inside this layer** — add `[data-theme="light"]` overrides, define the `--u-*` alias bridge for any holdover call-sites, and ensure the font stack is right.
- `plugins/design/dev-server/client/index.html` (already rebuilt by 3.4 to load the Bun-built bundle + Lightning CSS output) — drop Google-Fonts Inter/JetBrains link, inject Berkeley-Mono (or fallback chain).
- `.design/system/project/colors_and_type.css` — source of truth for tokens (OKLCH ladder, both themes). Imported into `1-tokens.css` at Lightning CSS build time.
- `.design/system/project/README.md` + `SKILL.md` — DS philosophy + hard-stops (hard-edges, no blur, no gradients in chrome, mono everywhere, balanced docs density).
- `.design/system/project/preview/*.html` — specimens (buttons, inputs, tables, callouts) — density bible. Mirror their padding/radii/border treatment.
- `.design/ui/Canvas Viewport.html` — the approved mocks (CV-08 sidebar, CV-09 DS view, CV-10 comments). Open via `/design:browse` or pull screenshots via `/design:screenshot --screen tree|dsview|comments`.
- `.design/ui/Canvas Viewport.meta.json` — `tokens_used` array is the *exact* CSS-var allowlist the mocks compile against (useful diff for "did I miss a token").
- `.ai/plans/phase-4-canvas-v2-rendering-engine.md` (lines 31–41) — confirms phase 4 rewrites `app.jsx` into `Canvas/Viewport/Toolbar/` subtrees → shell components must be portable to that split.

### Files to Create

- **No new files** in this phase — all targets are edits to files Phase 3.4 already created:
  - `plugins/design/dev-server/client/styles/1-tokens.css` — adds `[data-theme="light"]` overrides driven by `project` light-theme tokens; adds the `--u-*` alias bridge for holdover call-sites.
  - `plugins/design/dev-server/client/index.html` — swaps font `<link>` from Google-Fonts to Berkeley-Mono source (self-hosted or CDN).
- (Optional) `plugins/design/dev-server/client/assets/berkeley-mono/*.woff2` — only if we self-host the font; otherwise CDN.

### Documentation

- `plugins/design/skills/design-system/SKILL.md` — read mode: how to consume DS during iteration.
- `plugins/design/CATEGORIES.md` — for any new command discovery.

### Patterns to Follow

- **`project` DS philosophy:** industrial catalogue, Paper & Ink palette, Berkeley-forward typography, hard-edges signature. ONE accent family (`--accent` amber-rust = catalog-stamp red). No `--accent2`. Density comes from typography + part-number framing, not blur/glass/shadow.
- **Typography:** Berkeley Mono everywhere (UI body, paths, counts, timestamps, IDs) — sans-serif is absent by design. `--type-base: 13px`, `--lh-base: 20px`. SKU/all-caps uses `--tracking-wide`; body uses `--tracking-tight`.
- **Hard-edges contract:** radii are `0 / 2 / 4` only (no pills, no 6 px / 8 px). Shadows are **1 px hairline rules**, never blur (`box-shadow: 0 0 0 1px var(--border-default)` patterns). No backdrop-blur, no gradients in chrome.
- **Spacing:** 4 px base (`--space-1: 2`, `--space-2: 4`, `--space-3: 8`, `--space-4: 12`, `--space-5: 16`, `--space-6: 24`, `--space-7: 32`).
- Specimens in `.design/system/project/preview/` are the density bible — match their padding/radius/border treatment.

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| Buttons | `.design/system/project/preview/components-buttons.html` | Reuse hover/active/disabled states. Hard-edges = no rounded pills. |
| Inputs | `.design/system/project/preview/components-inputs.html` | Search field in sidebar — 1 px hairline border, `--bg-3` bg, mono placeholder. |
| Tooltips | `.design/system/project/preview/components-tooltips.html` | Header buttons, status-bar metrics. Hairline border, no blur backdrop. |
| Callouts | `.design/system/project/preview/components-callout.html` | Empty states (no canvas open, no comments). |
| Tables | `.design/system/project/preview/components-tables.html` | Density reference for tree rows + comments list. |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
| -------------- | ------ | ----- |
| Sidebar tree (states) | `.design/ui/Canvas Viewport.html` § CV-08 | Mirror directly: search input top, multi-section grouping, disclosure glyphs, hover/active accent row, modified dot, unread badge. |
| DS view | `.design/ui/Canvas Viewport.html` § CV-09 | Tokens surface ladder + 8-step type ladder at actual size + specimen thumbnail grid. Drive from `colors_and_type.css` (don't hardcode the swatches — render `getComputedStyle` of each `--bg-N` / `--fg-N` etc.). |
| Comments sidebar | `.design/ui/Canvas Viewport.html` § CV-10 | 380 px right sidebar over canvas-context. ALL/OPEN/RESOLVED tabs (counters mono). Expanded thread item layout + collapsed items + 1 resolved muted. |
| Viewport (anchor for chrome-around-it density) | `.design/ui/Canvas Viewport.html` § CV-01 | Status-row pattern at bottom of viewport informs status-bar visuals; minimap + zoom toolbar are phase-4 territory but their visual weight tells us how loud the chrome may go (answer: not very). |

### Icons

| Icon | Library | Size | Usage |
| ---- | ------- | ---- | ----- |
| File, Folder, ChevronRight/Down (disclosure), Search, X, Settings, MessageSquare, Eye, Sun/Moon, Refresh, Dot, Hash | Lucide line (inline SVG via `<Icon d=...>` already in `app.jsx`) | 14 / 16 | Tree, tabs, header, status bar, comments. |

> Keep the existing zero-dep `<Icon d={path}>` pattern — don't introduce a Lucide npm dep. Just curate the path data. Stroke width = 1 (matches hard-edges hairlines).

### Tokens

`project` DS exposes both themes off `.mdcc[data-theme="dark|light"]` (and `:root` defaults to light). The dev-server flips `<html data-theme="…">` and scopes tokens at `:root` instead — both layers need the alias.

| Purpose | `project` token | Current `--u-*` placeholder being replaced |
| ------- | --------------- | ------------------------------------------ |
| Page background | `--bg-0` | `--u-bg-0` (`#09090b`) |
| Surface 1 (sidebar, header) | `--bg-1` | `--u-bg-1` (`#18181b`) |
| Surface 2 (nested panel, active row) | `--bg-2` | `--u-bg-2` (`#27272a`) |
| Input bg / subtle hover row | `--bg-3` | `--u-bg-3` |
| Pressed state / focus row | `--bg-4` | `--u-bg-4` |
| Border subtle (interior hairlines) | `--border-subtle` | — (new) |
| Border default (panel separators) | `--border-default` | `--u-border` |
| Border strong (selected / focus) | `--border-strong` | `--u-border-strong` |
| Primary text | `--fg-0` | `--u-fg-0` |
| Secondary text | `--fg-1` | `--u-fg-1` |
| Tertiary / muted | `--fg-2` | `--u-fg-2` |
| Disabled / placeholder | `--fg-3` | `--u-fg-3` |
| Accent (catalog-stamp red) | `--accent` | `--u-accent` (sky-400) |
| Accent hover / active | `--accent-hover` / `--accent-active` | `--u-accent-strong` |
| Accent foreground (text on stamp) | `--accent-fg` | — (new) |
| Accent tint (cell wash) | `--accent-tint` | `--u-accent-bg` |
| Status success / warn / error / info | `--status-success` / `--status-warn` / `--status-error` / `--status-info` | `--u-status-success` / `--u-status-warn` / `--u-status-error` (no info) |
| Live indicator (connection dot) | `--status-error` (deeper red than accent) | `--u-status-live` |
| Mono cell bg / fg / rule (inline code in DS view) | `--mono-cell-bg` / `--mono-cell-fg` / `--mono-rule` | — (new) |
| Radii (xs/sm/md = 0/2/4; lg/xl clamp to 4; pill collapses to 0) | `--radius-xs` / `--radius-sm` / `--radius-md` | `--u-r-xs` … `--u-r-pill` (6/8/999 must vanish) |
| Spacing 1..9 (2/4/8/12/16/24/32/48/64 px) | `--space-1` … `--space-9` | `--u-s-1` … `--u-s-5` (rescale) |
| Font display / body / mono — all Berkeley Mono | `--font-display` / `--font-body` / `--font-mono` | `--u-font-sans` (Inter) / `--u-font-mono` (JetBrains) — sans family vanishes |
| Type scale 8-step xs..3xl (11/12/13/15/18/22/28/40) + matching `--lh-*` | `--type-xs` … `--type-3xl`, `--lh-xs` … `--lh-3xl` | hardcoded sizes in styles.css |
| Tracking ladder (tight/normal/wide/sku) | `--tracking-tight` / `--tracking-normal` / `--tracking-wide` / `--tracking-sku` | — (new) |

> **Bridge strategy:** start with an **alias layer** (`--u-bg-0: var(--bg-0)` etc.) so the diff lands in one commit, then a follow-up commit can rename `--u-*` call-sites if total touch < 200 lines (likely is). Decide at Task 5.

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `StatusBarSlot` | Split status bar into named slots (active canvas / unread comments / connection / theme) so phase 4 can inject viewport-fps + zoom level. | Existing inline `<footer className="statusbar">` markup. |
| `ThemeToggle` | Currently dark-only; project DS is two-theme (paper-light + phosphor-dark, both equal). Toggle flips `<html data-theme>` and persists to `localStorage`. | New, placed in `Header`. |
| `SectionGroup` (sidebar) | CV-08 splits the tree into PROJECT / DS / UI / RUNTIME sections with their own headers + collapsible state. Current tree is single-rooted. | Wraps existing `Tree` recursively. |

---

## Tasks

Execute in order. Design stage (Tasks 1–3) closed — implementation starts at Task 4.

### Task 1 — `[x]` DONE · 2026-05-15 — Design stage: shell-overview surfaces

> Sidebar, DS view, comments panel mocked in `.design/ui/Canvas Viewport.html` (CV-08, CV-09, CV-10). `meta.json` declares `designSystem: "project"`, `iteration_count: 2`, signature-moment + design + frontend + a11y critic panel: 24 blockers in iter 1 → micro-fix in iter 2 (aspiration 4.4, specificity pass). Full-chrome wrapper + tabs-statusbar matrix accepted as no-mock-needed (build from `project` DS specimens) per user sign-off 2026-05-15.

### Task 2 — `[x]` DONE · 2026-05-15 — Design stage: sub-mocks

> Folded into CV-08/09/10 — see Task 1.

### Task 3 — `[x]` DONE · 2026-05-15 — Review gate

> User-signed-off 2026-05-15 (this conversation): "navrhy ui jsou hotove". Implementation cleared to start.

### Task 4: UPDATE `index.html` — Berkeley Mono webfont + theme attribute

- **Do:** Replace the Google-Fonts Inter/JetBrains link (line 6-7) with the `project` DS font stack. Three options, pick by what works offline: (a) self-host Berkeley Mono `.woff2` under `client/assets/berkeley-mono/` and `@font-face` it in `styles.css`; (b) CDN-fetch via Vercel-style `cdn.jsdelivr.net/.../berkeley-mono` (verify license); (c) ship without Berkeley Mono and fall back to JetBrains Mono (which the existing link already loads). The token chain in `colors_and_type.css` already specifies `'Berkeley Mono', 'TX-02', 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, …` so the fallback is automatic.
- **Also:** Keep `<html data-theme="dark">` as initial value; theme toggle in Header will flip it.
- **Pattern:** Match whatever `.design/system/project/preview/*.html` uses for font loading.
- **Validate:** `mdcc design serve` against this repo — DevTools computed style on `body` shows `Berkeley Mono` (or `JetBrains Mono` first fallback if BM unavailable); zero Inter references in computed styles.
- **Decision to record (DDR candidate):** font hosting strategy (a/b/c) → `/flow:record-ddr` if non-obvious.

### Task 5: REFACTOR `styles.css` — bridge to `project` DS tokens

- **Do:** Replace the `:root { --u-* }` block (lines 1–63) with:
  1. `@import url('/_design/system/project/colors_and_type.css');` (server already exposes `.design/` under `/_design/` — verify route or add it) — OR — copy the relevant token blocks inline if cross-origin loading breaks.
  2. Add `[data-theme="light"]` overrides driven by `project` light-theme tokens (the DS file already defines both — just reach for the right selectors).
  3. **Alias layer:** keep `--u-*` names defined as `var(--*)` aliases so the rest of `styles.css` compiles unchanged in this task. Example: `--u-bg-0: var(--bg-0); --u-accent: var(--accent); --u-r-pill: 0; /* hard-edges collapses pills */ …`.
- **Pattern:** Single source of truth for tokens. No hex literals in styles.css after this task — only var refs.
- **Gotcha:** `--u-r-pill: 999px` consumers in `app.jsx` need to be reviewed when we alias to `0` — anywhere the pill shape is semantically required (badges?), switch to `--radius-md` (4 px) in the next task. Likewise `--u-accent-bg: rgba(56,189,248,0.14)` aliases to `var(--accent-tint)` which is already a baked OKLCH wash — don't redo the math.
- **Gotcha 2:** Spacing rescale — `--u-s-3: 12px` ≈ `--space-4: 12px`, but `--u-s-2: 8px` = `--space-3` and `--u-s-1: 4px` = `--space-2`. Alias carefully; off-by-one will visibly shift the layout.
- **Validate:**
  - `grep -E '#[0-9a-f]{3,6}|rgba?\(\s*[0-9]' plugins/design/dev-server/client/styles.css` returns zero matches (or only `rgba()` over CSS-var components for state mixing — document any exception).
  - Visual smoke: dev-server boots, sidebar + header + tree + tabs render without layout collapse.

### Task 6: REFACTOR `app.jsx` chrome — Header + ThemeToggle

- **Do:** Update `Header` layout/spacing/icons to match the chrome implied by CV-08 (top edge above the sidebar/canvas split). Add a `ThemeToggle` component (Sun/Moon Lucide path) wired to `<html data-theme>` + `localStorage` persistence. No prop API changes (downstream `App` callsite untouched).
- **Pattern:** Mono labels, 1 px hairline borders top + bottom, `--bg-1` background, accent only on hover for icon buttons (no filled buttons in chrome).
- **Validate:** Visual diff vs `.design/system/project/preview/components-buttons.html` density; theme toggle round-trips after reload.

### Task 7: REFACTOR `app.jsx` chrome — Sidebar + Tree (CV-08)

- **Do:** Adjust `Tree`, search input, section grouping, and unread-badge positions per CV-08.
  - Search input top, full-width, 1 px hairline border, mono placeholder ("filter…").
  - Introduce `SectionGroup` wrapper: PROJECT / DS / UI / RUNTIME headers (mono uppercase, `--tracking-wide`, `--fg-2`).
  - Disclosure glyphs ▾/▸ (or Lucide ChevronDown/ChevronRight at 14 px).
  - Active row: `--accent-tint` background + `--border-strong` 1 px left edge inside the row (NOT a 6 px-radius pill — hard-edges).
  - Modified dot: 4 px `--status-warn`, right of filename.
  - Unread badge: mono digit on `--accent` chip, `--radius-sm` (2 px), `--accent-fg` text.
- **Keep:** `buildTree`/`filterTree` logic identical — only JSX + className + section-grouping changes.
- **Validate:** All sidebar states (collapsed / search-hit / active / unread / empty / section-collapsed) match CV-08. Diff `app.jsx` excluding `Tree`'s data-shape — only render + className lines should be different.

### Task 8: REFACTOR `app.jsx` chrome — Tabs + StatusBar slots

- **Do:** Re-style `Tabs` per `project` DS conventions (mono labels, 1 px hairline bottom-border on active tab as the underline, `--bg-1` bg, no pill shapes). Split `StatusBar` into named `StatusBarSlot` children so phase 4 can inject viewport metrics. Default slots in order: active path (mono, `--fg-1`) · separator (`--border-subtle` 1 px vertical hairline) · unread count (mono digit + `MessageSquare` icon) · separator · connection dot (`--status-error` = live red) + "live" label · ThemeToggle (right-anchored).
- **Pattern:** Cross-reference CV-01's status row (bottom of viewport) for visual weight — chrome status bar should match that density.
- **Validate:** All existing status-bar info preserved. Slot order matches plan. No regression on `<footer className="statusbar">` data flow.

### Task 9: REFACTOR `app.jsx` chrome — SystemView (CV-09) + CommentsPanel (CV-10)

- **Do:**
  - `SystemView` — render token surfaces ladder + 8-step type ladder + specimen thumbnail grid by reading `getComputedStyle(document.documentElement)` for each `--bg-N` / `--fg-N` / `--accent*` / `--status-*`. Match CV-09 layout (3-column grid: surfaces · type · specimens).
  - `CommentsPanel` — adopt CV-10 sidebar layout: ALL / OPEN / RESOLVED tabs at top with mono counters, expanded thread item with avatar + author mono + timestamp + message body, collapsed items below, resolved items at bottom with `--fg-2` muted treatment.
- **Validate:** Comment add/resolve/reopen flows still work (no logic touched — purely visual). DS view re-renders correctly when ThemeToggle flips light/dark (swatches must update).

### Task 10: A11y + theme verification

- **Do:** Spawn `flow:a11y-auditor` against `http://localhost:4399` in **both** themes (dark + light). Verify contrast on `--accent` against `--bg-0` in both themes (project DS already specifies this in its hard-stops — confirm). Confirm focus rings present on all interactive elements (search input, tree rows, tabs, theme toggle, comment-thread buttons).
- **Pattern:** `project` DS contrast guarantees are in its `SKILL.md` / `README.md` hard-stops — read those for the exact AA thresholds expected.
- **Validate:** 0 blockers from a11y-auditor on web-desktop in both themes.

---

## Validation

1. **Lint:** none configured — skip per CLAUDE.md "no test suite, lint config, or build step".
2. **Types:** none configured — skip.
3. **Smoke:** `node cli/bin/mdcc.mjs --help` (CLI surface intact).
4. **Build:** none in this repo — dev-server is no-build (babel-standalone).
5. **Cross-platform scenario:** `scenario-runner` on web-desktop only (dev-server is desktop-only by design — `project` DS desktop density rules).
6. **Design System Guard:** spawn `design-system-guard` subagent against (a) the live dev-server URL in both themes, (b) `.design/ui/Canvas Viewport.html` CV-08/09/10 as reference truth.
7. **A11y:** spawn `flow:a11y-auditor` against `http://localhost:4399` in both themes (see Task 10).
8. **Manual:**
   - Boot dev-server in a fresh scratch project (`/tmp/scratch` with a minimal `.design/`) — theme toggle, file tree open/close, tab switch, comment thread all visually match CV-08/09/10.
   - Run dev-server against `/Volumes/D/git/dugmate/.design/` (canonical real-world example from CLAUDE.md) — no regression on real workload.
   - Visual diff at 100% zoom: open `.design/ui/Canvas Viewport.html` in one tab, dev-server in another, side-by-side. CV-08 sidebar = dev-server left pane; CV-09 system view = dev-server SystemView; CV-10 comments = dev-server CommentsPanel. Tolerance ≤ 4 px on spacing, exact match on tokens.

---

## Scenario Coverage (UI tasks — required)

**Existing scenarios covering affected flows:**

| Scenario | Covers | Status |
|----------|--------|--------|
| — | dev-server has no recorded `.ai/scenarios/` yet | 🆕 new |

**New scenarios to create:**

- `dev-server-shell-tour` — flow: open dev-server → search "buttons" in tree → click an entry → switch theme (dark→light→dark) → open comment thread → resolve a comment → open System View → toggle theme again (verify swatches update). Persona: project designer iterating on a single canvas. Fixtures: pre-seeded `.design/` with 3 HTML files (including one in `system/project/preview/`) + 2 comments (1 open / 1 resolved). Web-desktop only.

---

## Acceptance Criteria

- [ ] All 10 tasks completed (Tasks 1–3 already closed)
- [x] Design stage signed off — CV-08 / CV-09 / CV-10 in `.design/ui/Canvas Viewport.html` covering sidebar-tree / DS view / comments panel; full-chrome wrapper + tabs-statusbar accepted as no-mock-needed per user 2026-05-15
- [ ] `styles.css` contains zero hardcoded hex literals after Task 5 (only `var(--*)` refs and OKLCH inherited from `project` DS import)
- [ ] Both themes render (paper-light + phosphor-dark) — ThemeToggle persists across reload
- [ ] `app.jsx` `Viewport` component is byte-identical pre/post phase (diff = 0 in that subtree)
- [ ] `design-system-guard` subagent: 0 blockers vs `project` DS in both themes
- [ ] `flow:a11y-auditor`: 0 blockers in both themes
- [ ] `dev-server-shell-tour` scenario recorded + passes on web-desktop
- [ ] Manual smoke against `/Volumes/D/git/dugmate/.design/` shows no regression
- [ ] No DDR-worthy decision left unrecorded — candidates: (a) font-hosting strategy (self-host vs CDN vs fallback-only), (b) token-bridge approach (alias-layer vs full rename in single commit)
- [ ] Phase 4 plan remains valid (no task there blocked by this refactor)
