# Phase 3.5: Dev-server UI/UX refresh (shell only — viewport stays)

> **STATUS UPDATE — 2026-05-15** · Plan written against `studio` DS; project pivoted to **`project` DS (MDCC-DSN/01 — industrial-catalogue, Paper & Ink, Berkeley-mono, hard-edges)**. Design-stage tasks 1–2 are now **partially fulfilled** by [`/Volumes/D/git/claude-design/.design/ui/Canvas Viewport.html`](../../.design/ui/Canvas%20Viewport.html) (10 artboards). Implementation tasks 4–10 still pending. See "Tasks" section below for the per-task delta — original checkboxes preserved, current state annotated inline.
>
> **Coverage delta against original Task 1 + Task 2:**
> - Shell-overview at desktop → **partial** (CV-01 IDLE INFINITE CANVAS shows viewport + minimap + zoom toolbar + brand wordmark; no full app chrome with header + tabs + statusbar surrounding it)
> - Sidebar-tree-states (collapsed / search / active / unread) → **done** (CV-08 PROJECT + DS TREE shows search input, disclosure glyphs ▾▸, hover/active row in accent, modified dot, unread badge "3" on active file row, multi-section grouping PROJECT / DS / UI / RUNTIME)
> - Tabs + statusbar (states matrix) → **not covered** (separate canvas needed)
> - System view + right-side comments panel → **done** as 2 separate canvases (CV-09 DESIGN SYSTEM VIEW shows token ladder + type ladder + specimen gallery; CV-10 COMMENTS LIST · TABS shows all/open/resolved filter with expanded thread)
>
> **What remains for design stage to count as fully done:** one more canvas covering the **tabs-row + status-bar states matrix** (active tab / unsaved dot / scrolling overflow; status-bar slots for active path / unread / connection / theme). Could be added as CV-11 to the existing Canvas Viewport file via `/design:edit "add CV-11 · TABS + STATUS BAR STATES"`, OR scaffolded as a separate canvas. Plus a full app-chrome mock that wraps CV-01 with the surrounding header / tabs / sidebar shell.

## Description

Refresh the dev-server's **shell chrome** — header, sidebars, file tree, tabs, status bar, system view, comments panel — driven by new `.design/ui/studio/` mocks authored with the design agent against the existing `studio` design system. Theme + typography migrate from the placeholder "universal zinc grayscale" tokens (`--u-*` in `client/styles.css`) to the studio DS (Geist + Geist Mono, amber/lava accent, Zed/Raycast/Arc precision).

**Out of scope:** the canvas viewport itself (iframes + flexbox layout). Phase 4 rewrites that with Pixi.js — touching the viewport now would be wasted work.

## User Story

As a designer opening `mdcc design serve`, I want the dev-server to look like a finished v1 product (studio DS aesthetic, amber accent, Geist typography, refined density) so that the tool feels worth using — not like a placeholder that's been "good enough" since v0.5.

## Problem

- `client/styles.css` ships a hand-rolled neutral zinc palette (`--u-bg-*`, `--u-fg-*`, sky-400 accent) that has no relationship to the `studio` DS the project already invested in.
- Geist / Geist Mono never made it into the dev-server — it still uses Inter + JetBrains Mono fallbacks.
- Visual density, spacing, and hierarchy in header / tree / tabs / status bar were sized ad-hoc; no spec ever existed.
- No design mocks exist for the dev-server shell — `.design/ui/studio/` is empty. The `studio` DS preview gallery (`.design/system/studio/preview/`) shows specimens, not actual app surfaces.

## Solution

Three stages, gated by review:

1. **Design stage** — Author 4 multi-artboard canvases in `.design/ui/studio/` via `/design:new`: `shell-overview` (full app at desktop), `sidebar-tree-states` (collapsed / search / active / unread), `tabs-statusbar` (tabs + selection states + status bar), `system-and-comments-panel` (DS view + right-side comments panel). Iterate via `/design:edit --perfect` until critic panel ≥ 4.5/5.
2. **Token migration** — Replace `--u-*` token block in `styles.css` with bridge to `studio` DS tokens (`colors_and_type.css`). Wire Geist via `<link>` in `index.html`.
3. **Shell refactor** — Re-style + minor re-structure of chrome components in `app.jsx` to match approved mocks. **Keep `Viewport`/iframe rendering byte-identical** so phase 4 lands cleanly on top.

## Metadata

- **Type:** Refactor (visual + minor structural)
- **Complexity:** Medium
- **App/Package:** `plugins/design/dev-server/` (shell only)
- **Affected Systems:** dev-server client (React UI), studio DS consumers
- **Dependencies:** `studio` DS already bootstrapped (`.design/system/studio/`); no new npm deps
- **Blocks:** phase-4 (will land on refreshed shell — viewport rewrite stays clean)

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/client/app.jsx` (1000 LOC) — single React file, components: `Tree`, `Tabs`, `Viewport`, `Header`, `StatusBar`, `SystemView`, `CommentsPanel`. **Touch everything except `Viewport`.**
- `plugins/design/dev-server/client/styles.css` (lines 1-63) — token block to replace
- `plugins/design/dev-server/client/index.html` — needs Geist `<link>` injection
- `.design/system/studio/colors_and_type.css` — source of truth for studio tokens
- `.design/system/studio/README.md` + `SKILL.md` — DS philosophy + hard-stops
- `.design/system/studio/preview/*.html` — specimens to mirror density / radii / type ladder
- `.ai/plans/phase-4-canvas-v2-rendering-engine.md` (lines 31-41) — confirms phase 4 rewrites `app.jsx` into `Canvas/Viewport/Toolbar/` subtrees → shell components must be portable to that split

### Files to Create

- `.design/ui/studio/shell-overview.html` — full-app mock (header + sidebar + viewport placeholder + status bar)
- `.design/ui/studio/sidebar-tree.html` — sidebar states matrix
- `.design/ui/studio/tabs-statusbar.html` — tabs + status bar matrix
- `.design/ui/studio/system-and-comments.html` — DS view + right comments panel
- Each gets a sibling `.meta.json` with `designSystem: "studio"`

### Documentation

- `plugins/design/skills/design-system/SKILL.md` — read mode: how to consume DS during iteration
- `plugins/design/CATEGORIES.md` — for any new command discovery

### Patterns to Follow

- Studio DS philosophy: **direct-terse, hackerský tón, dense, keyboard-first**. Amber/lava accent is the only chromatic note — everything else is graphite/ink. No gradients, no glass, no pastel.
- Typography: Geist for UI (13px base), Geist Mono for paths / counts / timestamps / IDs.
- Specimens in `preview/` are the density bible — match their padding/radius/border treatment.

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| Buttons | `.design/system/studio/preview/components-buttons.html` | Reuse hover/active/disabled states |
| Inputs | `.design/system/studio/preview/components-inputs.html` | Search field in sidebar |
| Tooltips | `.design/system/studio/preview/components-tooltips.html` | Header buttons, status-bar metrics |
| Callouts | `.design/system/studio/preview/components-callout.html` | Empty states (no canvas open, no comments) |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
| -------------- | ------ | ----- |
| — | `.design/ui/studio/` is empty | All shell mocks new in this phase |

### Icons

| Icon | Library | Size | Usage |
| ---- | ------- | ---- | ----- |
| File, Folder, Search, X, Settings, Comment, Eye, Sun/Moon, Refresh | Lucide line (inline SVG via `<Icon d=...>` already in `app.jsx`) | 14 / 16 | Tree, tabs, header, status bar |

> Keep the existing zero-dep `<Icon d={path}>` pattern — don't introduce a Lucide npm dep. Just curate the path data.

### Tokens

| Purpose | Studio token (CSS var) | Current placeholder being replaced |
| ------- | ---------------------- | --------------------------------- |
| Page background | `--studio-bg-canvas` | `--u-bg-0` (`#09090b`) |
| Surface 1 | `--studio-bg-elev-1` | `--u-bg-1` (`#18181b`) |
| Surface 2 (active row) | `--studio-bg-elev-2` | `--u-bg-2` |
| Primary text | `--studio-fg-primary` | `--u-fg-0` |
| Secondary text | `--studio-fg-secondary` | `--u-fg-2` |
| Accent (amber/lava) | `--studio-accent` | `--u-accent` (sky-400) |
| Border | `--studio-border` | `--u-border` |
| Font UI | `--studio-font-sans` (Geist) | `--u-font-sans` (Inter) |
| Font mono | `--studio-font-mono` (Geist Mono) | `--u-font-mono` (JetBrains Mono) |

> Exact studio var names verified in `.design/system/studio/colors_and_type.css` during Task 2.

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `StatusBarSlot` | New: split status bar into named slots (active canvas / unread comments / connection / theme) so phase 4 can inject viewport-fps + zoom level | Existing inline `<footer className="statusbar">` markup |

---

## Tasks

Execute in order. Stop at the gate after Task 4 — design review before any code change.

### Task 1: CREATE shell-overview canvas — `[~]` PARTIAL (project DS, not studio)

> **2026-05-15:** CV-01 IDLE INFINITE CANVAS in `ui/Canvas Viewport.html` covers the **inner viewport** (world + brand wordmark + minimap + zoom toolbar + status row). A full app-chrome wrapper (header / tabs / sidebar surrounding the viewport) is **NOT** in scope for that artboard — would need a separate CV-11 mock that puts CV-01 inside the chrome frame.

- **Do:** `/design:new "Full dev-server shell at desktop — header (logo, project selector, theme toggle, settings), left sidebar (search + collapsible tree with active row + unread badges), main viewport area (placeholder rectangle labelled 'canvas — phase 4'), status bar (active canvas path mono, separator, unread count, separator, connection dot + 'live'). Studio DS, dark theme."`
- **Pattern:** Mirror density from `.design/system/studio/preview/components-tables.html`. 13px base, 4/8/12/16 spacing, 6px radii on inner cards, 1px borders.
- **Gotcha:** Studio DS opts out of gradients/glass/pastel — no shadows beyond 1-layer subtle inset on hover.
- **Validate:** Critic panel ≥ 4.5/5 after `--perfect` loop. No Lorem in copy.

### Task 2: CREATE sidebar / tabs+statusbar / system+comments mocks — `[~]` 2/3 PARTIAL (project DS)

> **2026-05-15:** Three sub-mocks were intended (sidebar-tree-states · tabs-statusbar · system+comments). Current state:
> - ✅ **sidebar-tree-states** → CV-08 PROJECT + DS TREE in `ui/Canvas Viewport.html` covers search input, multi-section grouping (PROJECT / DS / UI / RUNTIME), disclosure glyphs ▾▸, hover/active row in accent, modified dot, unread badge, selected file detail pane on right
> - ❌ **tabs-statusbar** → NOT covered (separate canvas pending). States needed: active tab + accent underline, unsaved dot, tab-overflow scroll, statusbar slots (active path / unread count / connection dot / theme toggle).
> - ✅ **system+comments** → split across CV-09 (DS VIEW: tokens, type ladder, specimens) + CV-10 (COMMENTS LIST: ALL / OPEN / RESOLVED tabs with expanded thread + open-state pills)

- **Do:** Three more `/design:new` runs for the remaining matrices (states matrix grids — collapsed, search-active, hover, selected, with-unread-badge, empty).
- **Validate:** Each ≥ 4.5/5. Visual consistency check across the 4 mocks (`/design:critic --agent graphic-design-critic` on the latest).

### Task 3: REVIEW gate

- **Do:** Open all 4 mocks in browser via `/design:browse`. User sign-off needed before any code change.
- **Validate:** Explicit user "go" recorded in commit message.

### Task 4: UPDATE index.html — Geist webfont link

- **Do:** Inject `<link href="https://cdn.jsdelivr.net/...geist..." rel="stylesheet">` for Geist + Geist Mono. Verify offline fallback chain works.
- **Pattern:** Whatever the studio DS preview gallery already uses (likely fontsource or Vercel-hosted Geist).
- **Validate:** `mdcc design serve` against this repo — font visibly Geist in DevTools computed styles.

### Task 5: REFACTOR styles.css — token bridge to studio DS

- **Do:** Replace the `:root { --u-* }` block with `@import` of (or selective copy from) `colors_and_type.css`, then either rename `--u-*` consumers throughout the file to `--studio-*`, or keep `--u-*` as thin alias layer (decide based on diff size — alias if rename touches > 80 lines).
- **Pattern:** Single source of truth for tokens. No hex literals in styles.css after this task — only var refs.
- **Gotcha:** Some `--u-accent-bg` use `rgba()` with hardcoded channels — re-derive from studio amber.
- **Validate:** `grep -E '#[0-9a-f]{3,6}|rgba?\(\s*[0-9]' plugins/design/dev-server/client/styles.css` returns zero matches (or only `rgba()` of var-derived alpha).

### Task 6: REFACTOR app.jsx chrome — Header

- **Do:** Update `Header` component layout/spacing/icons to match `shell-overview` mock. No prop API changes (downstream `App` callsite untouched).
- **Validate:** Visual diff vs mock — within DS density tolerances. Status-bar still functions.

### Task 7: REFACTOR app.jsx chrome — Sidebar + Tree

- **Do:** Adjust `Tree`, search input, unread-badge positions per `sidebar-tree.html`. Keep `buildTree`/`filterTree` logic identical — only JSX + className changes.
- **Validate:** All sidebar states (collapsed / search-hit / active / unread / empty) match mock states matrix.

### Task 8: REFACTOR app.jsx chrome — Tabs + StatusBar

- **Do:** Re-style `Tabs`. Split `StatusBar` into named `StatusBarSlot` children so phase 4 can inject viewport metrics. Default slots: active path, separator, unread count, separator, live indicator.
- **Validate:** All existing status-bar info preserved. Slot order matches mock.

### Task 9: REFACTOR app.jsx chrome — SystemView + CommentsPanel

- **Do:** Re-style only. DS panel and comments thread visuals to match `system-and-comments.html`.
- **Validate:** Comment add/resolve/reopen flows still work (no logic touched).

### Task 10: A11y + theme verification

- **Do:** Spawn `flow:a11y-auditor` against `http://localhost:4399`. Verify contrast on amber accent (studio token must pass WCAG AA on `--studio-bg-canvas`). Confirm focus rings present on all interactive elements.
- **Validate:** 0 blockers from a11y-auditor.

---

## Validation

1. **Lint:** none configured — skip per CLAUDE.md "no test suite, lint config, or build step".
2. **Types:** none configured — skip.
3. **Tests:** `node cli/bin/mdcc.mjs --help` (smoke check that we didn't break CLI surface).
4. **Build:** none in this repo — dev-server is no-build (babel-standalone).
5. **Cross-platform scenario:** `scenario-runner` on web-desktop only (dev-server is desktop-only by design — see studio DS density-per-platform: desktop=command center).
6. **Design System Guard:** spawn `design-system-guard` subagent against the 4 mocks + the live dev-server URL.
7. **A11y:** spawn `flow:a11y-auditor` against `http://localhost:4399` (see Task 10).
8. **Manual:**
   - Boot dev-server in a fresh scratch project (`/tmp/scratch` with a minimal `.design/`) and confirm theme toggle, file tree open/close, tab switch, comment thread all visually match mocks.
   - Run dev-server against `/Volumes/D/git/dugmate/.design/` (the canonical real-world example from CLAUDE.md) and confirm no regression in a real workload.

---

## Scenario Coverage (UI tasks — required)

**Existing scenarios covering affected flows:**

| Scenario | Covers | Status |
|----------|--------|--------|
| — | dev-server has no recorded `.ai/scenarios/` yet | 🆕 new |

**New scenarios to create:**

- `dev-server-shell-tour` — flow: open dev-server → search "buttons" in tree → click an entry → switch theme → open comment thread → resolve a comment. Persona: project designer iterating on a single canvas. Fixtures: pre-seeded `.design/` with 3 HTML files + 2 comments. Web-desktop only.

---

## Acceptance Criteria

- [ ] All 10 tasks completed
- [~] 4 design mocks live in `.design/ui/studio/` and signed off — **partial; pivoted to `project` DS:** 3 of 4 mock surfaces covered in `ui/Canvas Viewport.html` (CV-08 sidebar-tree, CV-09 system view, CV-10 comments list); tabs-statusbar states matrix + full app-chrome wrapper still missing. Sign-off pending.
- [ ] `styles.css` contains zero hardcoded hex literals after Task 5
- [ ] `app.jsx` `Viewport` component is byte-identical pre/post phase (diff = 0 in that subtree)
- [ ] `design-system-guard` subagent: 0 blockers vs studio DS
- [ ] `flow:a11y-auditor`: 0 blockers
- [ ] `dev-server-shell-tour` scenario recorded + passes on web-desktop
- [ ] Manual smoke against `/Volumes/D/git/dugmate/.design/` shows no regression
- [ ] No DDR-worthy decision left unrecorded (token-bridge approach is one candidate — alias vs full rename)
- [ ] Phase 4 plan remains valid (no task there blocked by this refactor)
