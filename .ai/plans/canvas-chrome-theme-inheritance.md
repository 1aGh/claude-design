# Feature: Canvas-shell chrome follows the Maude theme + per-artboard theme override

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This is a **risky dev-server refactor** (repoints CSS custom-property sources across the whole in-iframe canvas chrome) — the no-break exhaustive-verify discipline applies: inventory every surface, map each token, and verify every canvas feature in BOTH themes via agent-browser with zero regressions.

## Description

The Maude chrome (outer dev-server app, `client/app.jsx`) has a working dark/light theme toggle. The **canvas-shell chrome** — the workspace background, floating toolbar, minimap, zoom HUD, and selection halos that render **inside the canvas iframe** — does not follow it. Toggling the chrome theme leaves the canvas iframe on the design-system's default palette. This feature makes the canvas-shell chrome track the Maude theme, while artboards stay on the DS theme by default (with an opt-in per-artboard right-click override).

## User Story

As a designer iterating in the Maude dev-server, I want the canvas workspace (background, toolbar, minimap, zoom HUD) to switch dark/light together with the rest of the chrome when I toggle the theme — so the tool reads as one coherent product — while my artboards keep the theme my design system defines, and I can flip an individual artboard's theme from a right-click menu when my DS supports both.

## Problem

Three isolated theme layers, only one of which is wired:

1. **Maude chrome** (`client/app.jsx`): `data-theme` on the chrome document `<html>`, toggled at `app.jsx:1715`, synced at `app.jsx:1688-1694`. Works.
2. **Canvas-shell chrome** (inside the iframe — `canvas-shell.tsx` + `canvas-lib.tsx` engine/overlay CSS + `tool-palette.tsx` + `contextual-toolbar.tsx` + `ai-banner.tsx`): every neutral surface reads the **DS palette tokens** (`--bg-0/1/2`, `--fg-0/1`, `--u-bg-0`, …) off the iframe's `:root`. The iframe's `:root` theme is **never synced** to the chrome → the canvas-shell chrome is frozen on the DS default theme. **This is the bug** (system review D9).
3. **Artboards** (`.app[data-theme]` wrappers inside the iframe): DS tokens are scoped to `.app[data-theme="dark"]` / `.app[data-theme="light"]`; bare `:root` only ever resolves the *default* (dark) block. So you **cannot** light-theme the canvas-shell chrome merely by flipping `<html data-theme>` — the DS's light values require the `.app` class that only artboard wrappers carry.

Consequence of (3): the robust fix is a **dedicated, self-contained chrome token family** with embedded light+dark values — *not* propagating the iframe's `data-theme`. This exactly mirrors the existing `--maude-hud-accent` precedent (`canvas-shell.tsx:101-121`), which already owns its own token family precisely so the HUD doesn't inherit the canvas DS palette.

## Solution

**Core.** Introduce a `--maude-chrome-*` neutral token family (a superset that absorbs the existing `--maude-hud-*` accent block), injected by `canvas-shell.tsx` into the iframe `<head>` with **both** a dark and a light value set, selected by a `[data-maude-theme="dark"|"light"]` attribute on the iframe `documentElement`. Repoint every canvas-shell chrome surface from the DS palette tokens to `--maude-chrome-*`. Propagate the Maude theme into the iframe over the existing `dgn:*` postMessage bridge (`app.jsx:1671` `postToActiveCanvas` / broadcast loop at `app.jsx:1805`; handler at `canvas-shell.tsx:947`) as `{ dgn: 'theme', theme }`; the shell sets `documentElement.dataset.maudeTheme`. The accent (`--maude-hud-accent*`) stays theme-agnostic brand orange. Artboards are untouched — their `.app[data-theme]` wrapper overrides nothing chrome-side, so they "stay as the DS has them."

**Right-click override.** Add a `Theme ▸ DS default / Light / Dark / Follow chrome` submenu to the artboard context menu (registry built at `canvas-shell.tsx:630`). It sets the `data-theme` attribute on the artboard's `.app` root. Light/Dark entries are **enabled only when the DS declares both theme blocks**, detected by a cheap runtime computed-style probe (render a hidden `.app[data-theme="light"]` vs `.app[data-theme="dark"]`, compare resolved `--bg-0`). "Follow chrome" mirrors the propagated Maude theme onto that artboard.

## Metadata

- **Type**: Enhancement (architecture gap closure — system review D9 / action D)
- **Complexity**: High
- **App/Package**: `plugins/design` (dev-server)
- **Affected Systems**: canvas iframe runtime (canvas-lib, canvas-shell), floating chrome (tool-palette, contextual-toolbar, ai-banner, context-menu), Maude chrome client (app.jsx), runtime bundles
- **Dependencies**: none new. Uses the existing `dgn:*` postMessage bridge and the `--maude-hud-*` token precedent.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel (single message, multiple Read calls).

- `plugins/design/dev-server/canvas-shell.tsx` (lines 101-303 HUD_TOKENS_CSS + HALO_CSS + `ensureHaloStyles`; 630 registry `useMemo`; 942-964 `onMessage` handler) — Why: token-family injection point, halo inner-ring `--bg-0` usages (141/155/189), context-menu registry, and the postMessage handler to extend.
- `plugins/design/dev-server/canvas-lib.tsx` (lines 116-208 engine CSS `.dc-canvas`/`.dc-world`; 1721 FLOATING_SHADOW; 1724-1807 OVERLAY_CSS minimap `.dc-mm*` + zoom HUD `.dc-zoom-tb`; `ensureOverlayStyles` 1809) — Why: workspace background + minimap + zoom HUD token sources to repoint.
- `plugins/design/dev-server/tool-palette.tsx` (lines 38-174) — Why: floating toolbar + popover neutral tokens (`--u-bg-0`/`--bg-0`/`--u-fg-0`/`--fg-0/1`/`--u-font-mono`).
- `plugins/design/dev-server/contextual-toolbar.tsx` (lines 44-76) — Why: same `--u-*`/`--fg-*` neutral surface family.
- `plugins/design/dev-server/ai-banner.tsx` (lines 43-60) — Why: banner uses accent (keep) + `--fg-0`/`--border-default` (repoint).
- `plugins/design/dev-server/context-menu.tsx` (lines 51-63 `MenuItem`/`MenuSection`/`ContextRegistry` types; 82-131 default registry shape incl. `artboard-chrome`/`canvas` sections) — Why: how to add the Theme submenu item and where real `onSelect` callbacks replace the `noop()` defaults.
- `plugins/design/dev-server/client/app.jsx` (lines 1665-1716 `postToActiveCanvas` + `toggleAnnotations` broadcast pattern + theme `useEffect` 1688-1694 + `toggleTheme` 1715; 1837-1845 tab-open / iframe registration; 1980-1990 iframe-load `comments-set` push) — Why: where to broadcast `{dgn:'theme'}` on toggle AND on iframe load.
- `plugins/design/dev-server/client/styles/1-tokens.css` (lines 176-219 `--u-*` alias bridge) and `client/styles.css` (flat fallbacks: `--u-bg-0: #09090b`, `--u-fg-0: #fafafa`) — Why: source the neutral light/dark values the new family should mirror, so canvas-shell chrome and app chrome read as one product.

### Files to Create

- (none required for Core — all edits are to existing files.) Optionally `plugins/design/dev-server/test/canvas-theme.test.ts` (bun:test) for the theme-probe + message-handler logic.

### Documentation

- `.ai/logs/system-reviews/design-plugin-dogfood-kanban-review-2026-05-28.md` (D9 + improvement action D + key-learning 3) — Why: the originating diagnosis; action D's recommended doc text for the canvas theme model.
- `plugins/design/dev-server/canvas-shell.tsx:101-112` (HUD-token rationale comment) — Why: the precedent and reasoning for a chrome-owned token family.

### Patterns to Follow

`--maude-hud-*` token block (the exact precedent — extend it, don't invent a parallel mechanism):

```css
/* canvas-shell.tsx HUD_TOKENS_CSS (current) */
:root {
  --maude-hud-accent:        #d63b1f;
  --maude-hud-accent-hover:  #b8331b;
  --maude-hud-accent-active: #962a16;
  --maude-hud-accent-fg:     #ffffff;
  --maude-hud-accent-tint:   color-mix(in oklab, #d63b1f 14%, transparent);
}
```

postMessage bridge (extend, mirror `view-annotations`):

```js
// app.jsx — broadcast to ALL open iframes (mirror the git-lifecycle loop ~1805)
for (const el of iframesRef.current.values()) {
  try { el.contentWindow.postMessage({ dgn: 'theme', theme }, '*'); } catch {}
}
```

```ts
// canvas-shell.tsx onMessage (~956) — add a branch
if (m.dgn === 'theme') {
  const t = (m as { theme?: string }).theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.maudeTheme = t;
  return;
}
```

---

## Design Decisions

### Token family (new) — `--maude-chrome-*`, injected by canvas-shell, theme-keyed

| Token | Role | Dark value (anchor) | Light value (anchor) |
| --- | --- | --- | --- |
| `--maude-chrome-bg-0` | floating surface (toolbar, minimap, zoom HUD, popover) | `#1c1c1f` / mirror `--u-bg-0 #09090b` family | `#ffffff` |
| `--maude-chrome-bg-1` | workspace plane / minimap body | `#161618` | `#f4f1ea`→ neutral `#f5f5f6` |
| `--maude-chrome-bg-2` | recessed dotted-grid step | `#0f0f11` | `#e9e9ec` |
| `--maude-chrome-fg-0` | primary chrome text / hairline border | `#fafafa` | `#1c1917` |
| `--maude-chrome-fg-1` | secondary chrome text | `rgba(250,250,250,0.7)` | `rgba(40,30,20,0.7)` |
| `--maude-chrome-border` | hairline divider | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.10)` |
| `--maude-chrome-font-mono` | chrome label font | `ui-monospace, …` | same |
| `--maude-hud-accent*` | **unchanged** — brand orange, theme-agnostic | `#d63b1f` family | same |

> Values above are anchors; the implementer tunes contrast (WCAG AA on chrome text vs surface). The dark set must equal the *current* default appearance so the default theme is pixel-stable (no visual change when `data-maude-theme` is absent/`dark`). Mechanism: `:root` and `:root[data-maude-theme="dark"]` carry the dark set; `:root[data-maude-theme="light"]` carries the light set.

### Chrome surface inventory — current token → new token (the no-break map)

| Surface | File:line | Current | New |
| --- | --- | --- | --- |
| Workspace background | `canvas-lib.tsx:128` `.dc-canvas` | `--bg-1` | `--maude-chrome-bg-1` |
| Dotted-grid step | `canvas-lib.tsx:129-132` | (grid image) | derive from `--maude-chrome-bg-2`/`fg` |
| World plane | `canvas-lib.tsx:194` `.dc-world` | `--bg-0` | `--maude-chrome-bg-0` |
| World plane step | `canvas-lib.tsx:208` | `--bg-2` | `--maude-chrome-bg-2` |
| Floating shadow tint | `canvas-lib.tsx:1721` | `--fg-0` | `--maude-chrome-fg-0` |
| Minimap shell | `canvas-lib.tsx:1731-1736` `.dc-mm` | `--bg-0`,`--fg-0`,`--fg-1`,`--font-mono` | `--maude-chrome-*` |
| Minimap header/body | `canvas-lib.tsx:1748,1756` | `--bg-1` | `--maude-chrome-bg-1` |
| Minimap world-rect | `canvas-lib.tsx:1760-1761` | `--fg-0` | `--maude-chrome-fg-0` |
| Minimap viewport-rect | `canvas-lib.tsx:1768-1769` | `--maude-hud-accent` | **keep (accent)** |
| Zoom HUD | `canvas-lib.tsx:1780-1805` `.dc-zoom-tb` | `--bg-0`,`--fg-0`,`--fg-1`,`--font-mono`,accent | neutrals→chrome; accent stays |
| Tool palette | `tool-palette.tsx:38-44` | `--u-bg-0`/`--bg-0`,`--u-fg-0`,`--u-font-mono` | `--maude-chrome-*`; accent stays |
| Tool palette hover/active | `tool-palette.tsx:73-120` | `--fg-0/1`,`--maude-hud-accent`,`--bg-0` | neutrals→chrome; accent stays |
| Tool palette popover | `tool-palette.tsx:135-174` | `--u-bg-0`/`--bg-0`,`--u-fg-0` | `--maude-chrome-*` |
| Contextual toolbar | `contextual-toolbar.tsx:44-76` | `--u-bg-0`/`--bg-0`,`--u-fg-0`,`--fg-1`,`--u-border-subtle` | `--maude-chrome-*`; accent stays |
| Halo hover/selected inner ring | `canvas-shell.tsx:141,155,189` | `var(--bg-0,#fff)` (contrast ring) | `--maude-chrome-bg-0` |
| AI banner border/text | `ai-banner.tsx:44-46` | `--fg-0`,`--border-default` | `--maude-chrome-fg-0`/`--maude-chrome-border`; accent stays |
| Context menu | `context-menu.tsx` (audit full file) | neutral surface tokens | `--maude-chrome-*` |
| Comments overlay chrome | `comments-overlay.tsx` (audit) | neutral surface tokens | `--maude-chrome-*` (pins/threads that should match the artboard stay DS) |
| Export dialog | `export-dialog.tsx` (audit) | neutral surface tokens | `--maude-chrome-*` |

> **Audit caveat:** the last three rows (context-menu, comments-overlay, export-dialog) were not line-audited during planning — Task 2 must grep each for `var(--bg`/`var(--fg`/`var(--u-` and classify every hit as *chrome* (repoint) or *content-that-should-track-the-artboard* (leave on DS tokens). Comment pins/threads anchored to artboard content are a deliberate ambiguity — default to leaving them DS-themed unless they read as floating chrome.

### Context-menu item (right-click)

| Item | Source | Notes |
| --- | --- | --- |
| `Theme` submenu | `context-menu.tsx` `artboard-chrome` section (registry built `canvas-shell.tsx:630`) | Entries: `DS default` (remove explicit `data-theme`), `Light`, `Dark`, `Follow chrome`. Light/Dark disabled unless DS-supports-both probe passes. Real `onSelect` wired in the `canvas-shell.tsx:630` registry (replaces `noop()`), operating on `target` (the artboard's `.app` root). |

### Custom Components Needed

| Component | Reason | Extends |
| --- | --- | --- |
| `dsSupportsBothThemes()` probe | gate the Light/Dark menu entries; no reliable config flag in arbitrary downstream DSs | new helper in canvas-shell or canvas-lib (computed-style compare of hidden `.app[data-theme=light/dark]`) |

---

## Tasks

Execute in order. Each task is atomic and testable. Keep each canvas feature working at every step (run the dev-server against `/private/tmp/maude-scratch` which has the `kanban` DS + `User Admin Panel` canvas, and a second dark-only DS if available).

### Task 1: ADD the `--maude-chrome-*` theme-aware token family

- **Do**: In `canvas-shell.tsx`, replace `HUD_TOKENS_CSS` with a block that keeps `--maude-hud-accent*` AND adds the `--maude-chrome-*` neutrals, with three selectors: `:root, :root[data-maude-theme="dark"] { …dark… }` and `:root[data-maude-theme="light"] { …light… }`. Dark values MUST reproduce the current default appearance (pixel-stable).
- **Pattern**: existing `HUD_TOKENS_CSS` at `canvas-shell.tsx:113-121`; `ensureHaloStyles` injects it before HALO_CSS — preserve that ordering so the cascade still resolves before any imported DS `:root`.
- **Gotcha**: keep the block injected with id `dc-cv-hud-tokens-css` (idempotency) and BEFORE `HALO_CSS` and before the DS `colors_and_type.css` import in the cascade.
- **Validate**: open a canvas; in devtools confirm `getComputedStyle(document.documentElement).getPropertyValue('--maude-chrome-bg-0')` resolves; default render unchanged.

### Task 2: REFACTOR every canvas-shell chrome surface onto `--maude-chrome-*`

- **Do**: Repoint each row in the inventory table. Engine + overlay CSS in `canvas-lib.tsx` (`.dc-canvas`, `.dc-world`, FLOATING_SHADOW, `.dc-mm*`, `.dc-zoom-tb`), toolbar in `tool-palette.tsx`, `contextual-toolbar.tsx`, halo inner-rings in `canvas-shell.tsx` HALO_CSS, `ai-banner.tsx`. Then audit `context-menu.tsx`, `comments-overlay.tsx`, `export-dialog.tsx` per the audit caveat and repoint chrome (not content).
- **Pattern**: keep `var(--maude-chrome-bg-0, <current-fallback>)` form so a missing token still falls back to today's literal (e.g. `#ffffff`). Accent stays `var(--maude-hud-accent, …)` everywhere.
- **Gotcha**: do NOT touch DS tokens consumed *inside* artboards or by comment pins anchored to content. Only floating chrome moves. The minimap viewport-rect and all accent usages stay on `--maude-hud-accent`.
- **Validate**: visual diff at default (dark) theme = no change; grep confirms no remaining `var(--bg-` / `var(--fg-` / `var(--u-` in the floating-chrome CSS blocks except intentional content.

### Task 3: ADD `dgn:'theme'` to the postMessage handler (iframe side)

- **Do**: In `canvas-shell.tsx` `onMessage` (~956), add a `m.dgn === 'theme'` branch that sets `document.documentElement.dataset.maudeTheme` to `'light'`/`'dark'`. Default the attribute to `'dark'` at shell mount if unset.
- **Pattern**: existing `tool-set` branch at `canvas-shell.tsx:956-960`.
- **Gotcha**: this must NOT touch the DS `data-theme` on `<html>` or on artboards — `data-maude-theme` is a *separate* attribute that only `--maude-chrome-*` selectors read.
- **Validate**: from devtools console of the chrome, `iframe.contentWindow.postMessage({dgn:'theme',theme:'light'},'*')` flips workspace/toolbar/minimap to light; artboards unchanged.

### Task 4: UPDATE the Maude chrome to broadcast theme (chrome side)

- **Do**: In `app.jsx`, in the theme `useEffect` (1688-1694) broadcast `{dgn:'theme',theme}` to every open iframe (mirror the `git-lifecycle` loop ~1805). ALSO send the current theme to a freshly-loaded iframe — on tab open / iframe `load` (where `comments-set` is already pushed, ~1983-1990) push the theme so a canvas opened after a toggle starts correct.
- **Pattern**: `toggleAnnotations` per-iframe post (1680-1683) for single-iframe; `git-lifecycle` loop (1805) for broadcast-to-all.
- **Gotcha**: broadcast to ALL iframes, not just `activePath` (multiple canvases can be open). Wrap each `postMessage` in `try/catch` per existing convention.
- **Validate**: toggle chrome theme with two canvases open → both iframes' chrome flips; open a third → it loads already-correct.

### Task 5: ADD the per-artboard right-click Theme submenu + DS-supports-both probe

- **Do**: Add `dsSupportsBothThemes()` (hidden `.app[data-theme=light]` vs `[data-theme=dark]` computed `--bg-0` compare; memoize). In the `canvas-shell.tsx:630` registry, add a `Theme` group to the `artboard-chrome` section with `DS default` / `Light` / `Dark` / `Follow chrome`; wire real `onSelect` to set/remove `data-theme` on the artboard `.app` root (resolve it from `target`). Disable Light/Dark when the probe is false.
- **Pattern**: `DEFAULT_REGISTRY` shape + `noop()` placeholders in `context-menu.tsx:98-131`; real-callback injection pattern noted in `context-menu.tsx:79`.
- **Gotcha**: "Follow chrome" must read the current `data-maude-theme` and keep following subsequent `dgn:'theme'` messages (store a per-artboard "follow" flag; on theme message, restamp followers). Don't leak listeners — clean up when the artboard unmounts.
- **Validate**: right-click an artboard on a both-theme DS → Light/Dark enabled and flip just that artboard; on a dark-only DS → Light/Dark disabled with a hint; "Follow chrome" tracks the toggle.

### Task 6: UPDATE docs — canvas theme model (system-review action D)

- **Do**: Add the theme-model note (from review action D) to `plugins/design/templates/canvas.tsx.template` header + `plugins/design/commands/new.md`: chrome and iframe are isolated; canvas-shell chrome follows `data-maude-theme` (auto); artboards pin `data-theme` (DS default) or use the right-click override; generation must NOT hardcode `data-theme` on artboards unless dark-only is intended.
- **Validate**: `new.md` + template read consistently; no contradiction with the new mechanism.

### Task 7: REBUILD runtime bundles + verify on-disk

- **Do**: `cd plugins/design/dev-server && bun run build.ts` (dev) to regenerate `client.bundle.js` + affected `dist/runtime/*.js`. Commit the regenerated bundles (they are authoritative per CLAUDE.md). Run `bin/runtime-health.sh` and `bin/check-runtime-bundles.sh` against `.min-sizes.json`.
- **Gotcha**: runtime bundles are committed and authoritative; whatever lands on disk ships. Do not skip the health check.
- **Validate**: `check-runtime-bundles.sh` green; canvas loads with no `ReferenceError` at module eval.

---

## Validation

Run to confirm zero regressions:

1. **Types**: `cd plugins/design/dev-server && bunx tsc --noEmit` (or the project's typecheck path) over the touched `.ts/.tsx`.
2. **Build**: `cd plugins/design/dev-server && bun run build.ts`; then `bin/runtime-health.sh --restart` + `bin/check-runtime-bundles.sh`.
3. **Unit (optional)**: `bun test` for `canvas-theme.test.ts` (probe + message handler).
4. **Cross-platform / live UI (REQUIRED, exhaustive — per the no-break-exhaustive-verify discipline)**: spawn `scenario-runner` / drive `agent-browser` against a real canvas in `/private/tmp/maude-scratch`. For BOTH themes (toggle chrome dark↔light) capture screenshots and confirm **each** canvas feature still works AND themes correctly:
   - workspace background, `.dc-world` plane, dotted grid
   - tool palette (every tool: select/hand/pen/rect/ellipse/arrow/eraser/comment) + popover
   - contextual toolbar
   - minimap (shell, header, body, world-rect track theme; viewport-rect stays accent) + minimap click-to-pan
   - zoom HUD (buttons, %, hover, focus ring)
   - halos: hover, selected (ticks), selected-member, group bbox, active-artboard ring, marquee
   - context menu (incl. new Theme submenu) on element / artboard-chrome / canvas
   - comments: compose, pin, thread, mention popup
   - annotations layer (draw, select, resize, visibility toggle)
   - AI banner
   - LOD bands (zoom < 0.35 and > 4.0)
   - Then: artboards **unchanged** by chrome toggle (Core); right-click Light/Dark flips one artboard (both-theme DS); right-click Light/Dark disabled on a **dark-only** DS while chrome STILL toggles light (this is the proof the decoupling works).
5. **A11y**: `a11y-auditor` over the canvas chrome in BOTH themes — chrome text vs surface contrast meets AA in light and dark; `prefers-reduced-motion` still collapses transitions.
6. **Design System Guard**: confirm canvas-shell chrome no longer inherits a violet/branded DS accent (the original `--maude-hud-*` invariant) and the new neutrals don't leak DS palette.
7. **Manual**: open two canvases on different DSs simultaneously, toggle theme, confirm both chromes flip and neither artboard set changes.

---

## Scenario Coverage (UI — required)

| Scenario | Covers | Status |
| --- | --- | --- |
| `canvas-theme-toggle` | chrome toggle → canvas-shell chrome flips, artboards stay; per-artboard right-click override; dark-only-DS decoupling proof | 🆕 new |

New scenario `canvas-theme-toggle` — flow: open canvas → screenshot dark → toggle chrome theme → screenshot light (assert workspace/toolbar/minimap flipped, artboard unchanged) → right-click artboard → Theme ▸ Light → screenshot (assert only that artboard flipped) → repeat against a dark-only DS (assert Light/Dark disabled, chrome still flips). Fixtures: `maude-scratch` `kanban` DS + `User Admin Panel` canvas; one dark-only DS.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] Default (dark) render is pixel-stable — no visual change when no theme is propagated
- [ ] Toggling the Maude chrome theme flips canvas-shell chrome (workspace bg, toolbar, minimap, zoom HUD, halos, contextual toolbar, AI banner) in every open iframe
- [ ] Artboards stay on their DS theme by default; right-click Light/Dark flips one artboard when the DS supports both, and is disabled (with hint) when it doesn't
- [ ] Dark-only DS: chrome still toggles light (decoupling proven) — the core requirement holds regardless of DS theme support
- [ ] `--maude-hud-accent` stays brand orange in both themes; no DS palette leaks into chrome
- [ ] `agent-browser` exhaustive pass: every canvas feature verified in BOTH themes, 0 regressions
- [ ] `a11y-auditor`: 0 blockers, AA contrast in light AND dark
- [ ] Runtime bundles regenerated + committed; `check-runtime-bundles.sh` green
- [ ] Canvas theme-model documented in `canvas.tsx.template` + `new.md` (closes review action D)
- [ ] No DDR-worthy decision left unrecorded (a DDR documenting the `--maude-chrome-*` decoupling + `data-maude-theme` attribute is likely warranted — mirrors the `--maude-hud-*` rationale)
