# DDR-096: Studio browser shell rewritten into the maude design system

- **Date:** 2026-06-06
- **Status:** Accepted (implemented — Plan B of the restructure+studio split; Tasks 1–8 live-verified)
- **Tags:** design-system, dev-server, studio, client, shell, css-layers, dogfooding, canvas-origin, tokens, command-palette
- **Related:** [DDR-095](./DDR-095-runtime-apps-extracted-to-top-level.md) (Plan A — stable `apps/studio/` tree this builds on), [DDR-014](./DDR-014-css-layer-architecture.md) (CSS `@layer` order), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (canvas iframe untrusted origin), [DDR-048](./DDR-048-dev-server-system-view-no-shell-bias.md) (SystemView reads user tokens), [DDR-021](./DDR-021-design-smoke-gate-for-infra-and-bulk-ui-work.md) (smoke gate). Plan: [`feature-studio-maude-ds-redesign.md`](../plans/feature-studio-maude-ds-redesign.md). Parity contract: [`.ai/context/studio-shell-parity.md`](../context/studio-shell-parity.md).

## Context

The dev-server browser shell (`apps/studio/client/app.jsx`, 3181 lines + a 6-file
DDR-014 layered stylesheet) was styled with a deliberately **DS-agnostic** amber-rust
"catalog stamp" theme (`client/styles/1-tokens.css`, "universal — no project tokens
needed"). The tool that *produces* maude designs did not itself look like maude. The
approved redesign (`.design/ui/Studio.tsx` + `Studio.css`, authored under the **maude**
DS) re-imagines the chrome as one cohesive dark-first studio material.

The standing `feedback_no_break_exhaustive_verify` rule applied: a risky dev-server
refactor demanding 100% feature parity, zero regressions, and **live agent-browser
verification after each slice** — not "build green."

## Decision

Rewrite the **browser shell** (the chrome AROUND the canvas iframes) into real
maude-DS components; **token-reskin** (not rewrite) the **in-canvas overlays** (the
chrome INSIDE the untrusted iframe). Five sub-decisions:

### 1. Shell-rewrite vs overlay-reskin split (load-bearing)

- **Browser shell** (`client/app.jsx` + `client/styles/*`) — full rewrite into
  `.st-*` maude components (`Menubar · Sidebar · CollapsedRail · StatusBar ·
  CommandPalette · CommentsPanel`) wired to the existing app state.
- **In-canvas overlays** (`canvas-shell.tsx` + `tool-palette`/`comments-overlay`/
  `annotations`/`cursors`/`participants` …) — **token swap only, zero logic change.**
  Per DDR-054 these render in the untrusted canvas origin and their interaction logic
  is settled + high-risk to touch.

### 2. Token coexistence via `.maude[data-theme]` scoping (not `:root`)

The maude ladder was adopted into a NEW `client/styles/1-tokens-maude.css` scoped
**only** under `.maude[data-theme="dark|light"]` — NOT `:root`. This is additive: the
legacy amber `1-tokens.css` stays intact, so old + new chrome coexist through the
slice-by-slice rewrite. The App root wraps the shell in a single `.maude[data-theme]`,
so the maude ladder drives every `.st-*` rule (which reference `var(--bg-0)` /
`var(--accent)` DIRECTLY) and the theme toggle flips the whole shell. DDR-014 `@layer`
order preserved (maude tokens → `tokens`, `.st-*` → `shell`, `.btn`/`.kbd`/`.callout`
→ `components`).

**Load-bearing CSS gotcha (the `--u-*` alias trap).** The legacy chrome (SystemView
`.sv-*`, HelpModal, tour nudge, what's-new, CommentBar) consumes the `--u-*` aliases,
NOT the raw tokens. Those aliases are declared at `:root` as `--u-accent: var(--accent)`
— and a custom property's `var()` is resolved **at the declaring element's scope, then
inherited as a fixed value**. So `--u-accent` computes against the *amber* `:root
--accent` and inherits amber into `.maude`; the `.maude` redefinition of `--accent` does
NOT re-trigger it. Direct refs (`var(--accent)` in `.st-*`) pick up maude; alias refs
(`var(--u-accent)` in legacy chrome) silently stayed amber. **Visual screenshots did not
catch this — amber-dark ≈ cool-dark at small scale; only a computed-style probe
(`getComputedStyle(.maude).getPropertyValue('--u-accent')` → `oklch(0.72 0.16 55)`)
exposed it.** Fix: re-declare the entire `--u-*` bridge under a `.maude` selector in
`1-tokens-maude.css` (theme-agnostic; `var(--accent)` etc. re-resolve per the element's
theme), so every legacy `--u-*` surface turns maude in one shot. Lesson: **for any
token-scope override, verify alias chains with a computed-style probe, not a
screenshot.**

### 3. Layout restructure: `.app` grid → `.st-shell` flex column + `.st-body` flex row

The legacy CSS-grid layout (`sidebar | main | rsidebar`, menubar/statusbar nested in
`.main`) became the mockup's structure: an outer `.maude` → `.st-shell` flex **column**
(full-width Menubar / `.st-body` / full-width StatusBar), with `.st-body` a flex **row**
(`CollapsedRail | Sidebar | main | right-panel`). Legacy panels not yet ported get flex
shims (`.st-body > .main { flex:1 }`, etc.) so each slice lands independently.

### 4. In-canvas chrome reskinned via ONE token-family edit

The overlays all consume a single token family — `--maude-hud-*` + `--maude-chrome-*`,
defined in `HUD_TOKENS_CSS` (`canvas-shell.tsx`) — and every hardcoded `#d63b1f`/
`#1c1917` is a `var(…, FALLBACK)` fallback. So **one edit** to `HUD_TOKENS_CSS` reskins
ALL overlays — no per-file changes. Swapped to maude: indigo accent `oklch(0.68 0.18
268)`, **navy accent-fg** `oklch(0.18 0.03 268)` (NOT white — maude's bright indigo
needs a dark fg for WCAG AA; white/indigo ≈ 3:1 fails, navy/indigo ≈ 6.3:1), cool
neutrals hue 255, JetBrains mono. The `data-maude-theme` chrome attribute stays
separate from the DS `data-theme` (chrome theming never touches artboard palettes).

### 5. SystemView retained; Inspector + ⌘K decisions

- **SystemView (`__system__` tab) is KEPT** — it is a shipped feature (DDR-048: renders
  the user's DS tokens) NOT present in the mockup. It already renders maude-toned (its
  `--u-*`/`--bg-*` resolve to maude values under `.maude`), so it needed no rewrite.
- **⌘K command palette ADDED** (net-new, the mockup's signature surface) — wired to six
  real shell-doable actions (system view, comments, theme, reload, what's-new, help).
  In-canvas export stays in the iframe (not a palette action).
- **Inspector panel (Inspect/Layers/CSS) DEFERRED.** The mockup's live-CSS-knob
  writeback is aspirational (its own Phase-12 callout). Rather than ship a display-only
  panel claiming functionality it lacks, it is scoped out of this pass (CSS scaffold
  `.st-insp-*` is in place; the View-dropdown Inspector item stays Phase-12). The
  what's-new `.st-toast` visual polish is deferred with it (the toast is functional and
  inherits maude tokens today). Both are additive, non-regressing follow-ups.

## Consequences

- The tool that designs in maude is now itself built in maude — full dogfooding.
- **Zero regressions:** every row of the Task-1 parity contract was live-verified via
  agent-browser per slice (theme persist, all menubar dropdowns, new-board composer
  end-to-end, delete, search, section/sidebar persistence, tabbed iframe + cross-origin
  split, comments panel, SystemView, ⌘K, WS `_active.json` tracking). `maude design
  smoke` 87/87 styled; `runtime-health` OK.
- The committed `dist/client.bundle.js` (261 KB release-minified) + `styles.css` are
  what ships — the source dev-server self-heals to unminified dev bundles, so the
  `--release` rebuild + `git checkout` of `dist/runtime/*.js` (vendored deps the boot
  self-heal had regenerated) is mandatory and last (CLAUDE.md "Runtime bundles").
- Follow-ups: Inspector panel build-out; what's-new `.st-toast` polish; eventual
  deletion of the legacy amber `1-tokens.css` + `--u-*` bridge once no legacy chrome
  remains.
