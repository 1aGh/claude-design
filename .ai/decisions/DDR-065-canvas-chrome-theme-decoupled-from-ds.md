## DDR-065 — Canvas-shell chrome owns a theme-aware `--maude-chrome-*` family, decoupled from the DS palette; per-artboard override via injected stylesheet

- **Status:** Accepted — 2026-05-29
- **Authors:** 1aGh (decision) + Claude (implementation + agent-browser verification + security fan-out)
- **Phase:** D9 closure (system-review `design-plugin-dogfood-kanban-review-2026-05-28.md`, improvement action D)
- **Supersedes:** —
- **Amends:** the `--maude-hud-*` HUD-token precedent (`canvas-shell.tsx`, system-review 2026-05-27 D-4) — extends the same "chrome owns its own tokens" idea from accent to the full neutral surface family.
- **Related:**
  - `.ai/plans/archive/canvas-chrome-theme-inheritance.md` — the plan (archived on close)
  - `.ai/logs/system-reviews/design-plugin-dogfood-kanban-review-2026-05-28.md` — D9 diagnosis + action D
  - Security fan-out (this `/done`): security-auditor + ethical-hacker both PASS; ethical-hacker F2 (token-value exfil) mitigated — see Decision §4.

## Context

The Maude dev-server has three isolated theme layers; only the outer chrome's dark/light toggle was wired. The **canvas-shell chrome** rendered *inside the canvas iframe* — workspace plane, floating toolbar, minimap, zoom HUD, halos, contextual toolbar, AI banner, context menu, undo HUD, presence chrome — read the **DS palette tokens** (`--bg-*`/`--fg-*`/`--u-*`) off the iframe `:root`, so it never followed the chrome theme (system-review D9).

Two facts made the naive fix ("propagate the iframe's `data-theme`") wrong:

1. **DS tokens are scoped to a wrapper class, and the default varies.** The kanban DS scopes to `:root, .mdcc[data-theme="light"]` + `.mdcc[data-theme="dark"]` — so bare `:root` resolves the *light* default, and the chrome was accidentally rendering **light** on a dark chrome theme. Flipping `<html data-theme>` can't reach the DS light values (they need the `.mdcc` class the artboard wrappers carry, not the chrome).
2. **The wrapper class is DS-specific** (`.mdcc` here, `.app` elsewhere, sometimes bare `[data-theme]`) — there is no reliable config flag across arbitrary downstream DSs.

## Decision

**1. The canvas-shell chrome owns a self-contained, theme-aware `--maude-chrome-*` neutral token family** (bg-0/1/2, fg-0/1, border, shadow, font-mono), injected into the iframe `<head>` by `canvas-shell.tsx` with BOTH a dark and a light value set, selected by a **separate `data-maude-theme` attribute** on the iframe `documentElement`. Values mirror the Maude app-chrome neutrals (`client/styles/1-tokens.css` oklch) so chrome reads as one product. Every floating-chrome surface reads `--maude-chrome-*`; **accent stays the theme-agnostic `--maude-hud-accent*` orange.** Artboards are untouched — they keep their DS theme. This mirrors the `--maude-hud-*` precedent (chrome must not inherit the DS palette).

   - `data-maude-theme` is **deliberately a different attribute** from the DS `data-theme`: chrome theming never touches artboard palettes, and DS theming never touches chrome.
   - The DARK set is also the bare-`:root` default, so an un-propagated canvas renders coherent-dark (matching the dev-server default). NOTE: literal "pixel-stable" couldn't hold — the prior per-DS-leaking behavior *was* the bug.
   - A dedicated `--maude-chrome-shadow` token exists because mapping the floating shadow to `--fg-0` (as the surface-token map implied) would produce a **white glow** in dark theme.

**2. The theme propagates over the existing `dgn:*` postMessage bridge.** `app.jsx` broadcasts `{dgn:'theme', theme}` to **every** open iframe on toggle and seeds a freshly-loaded iframe on `dgn:'loaded'`; the iframe's `canvas-shell` sets `data-maude-theme`. The inbound handler enum-guards `theme ∈ {light,dark}` (no DOM-text sink). This works identically same-origin and across the DDR-063 canvas-origin split.

**3. The per-artboard right-click override (Theme ▸ DS default / Light / Dark / Follow chrome) is applied via an injected `<style>` keyed by the stable `data-dc-screen` attribute — NOT by stamping the artboard element.** Stamping `data-theme`/class on the `.dc-artboard` `<article>` fails twice: React reconciles the element back to its JSX props on every re-render (wiping the mutation), and the canvas content carries its OWN `rootClass[data-theme]` wrapper that re-establishes the default *below* the artboard. Instead, `collectThemeDeclarations()` reads the DS theme block's `--*` declarations via CSSOM and `rebuildArtboardThemeStyle()` re-emits them scoped to `[data-dc-screen="<id>"] .<wrapperClass>` (id `CSS.escape`'d; wrapper detected by `detectDsThemeSupport()`'s computed-style probe). The rule is keyed by an attribute React always re-renders WITH → survives re-renders, beats the wrapper on cascade order, zero flicker. "Follow chrome" re-points followers on the chrome-theme `MutationObserver`. The probe doubles as the **DS-supports-both gate**: it tests a *nested* element, so `supported ⟺ a per-artboard override will actually work` (a DS that only themes `:root[data-theme]` correctly reports unsupported → Light/Dark disabled with a hint).

**4. Re-emitted token values are filtered for resource-fetch functions** (`url(` / `image(` / `@import` / `/*` / `expression(`). Per CSS grammar a custom-property value can't break out of its `{}` block, but a `url()` in a token shipped by a **DDR-054 untrusted synced canvas** would become a same-origin CSS exfil beacon when the artboard renders. The canvas-origin CSP (DDR-063) already gates this; the filter is defense-in-depth (ethical-hacker F2, accepted at LOW after the fix). For a trusted same-origin DS the filter is inert (plain `oklch()`/`rgba()` tokens pass).

## Consequences

- **Positive:** the dev-server reads as one coherent product across dark/light; the chrome can never inherit a branded DS palette; artboards stay authoritative for their own theme; reviewers can flip one artboard at will when the DS ships both blocks. The `data-dc-screen`-keyed stylesheet mechanism is the reusable pattern for any future "re-theme a React-owned canvas subtree from the shell."
- **Trade-offs / residuals:** per-artboard overrides are session-ephemeral (in-memory map, cleared on iframe reload) — acceptable, consistent with selection state. `collectThemeDeclarations` caches per-theme for the iframe lifetime; the HMR hard-reload of the iframe on stylesheet change clears it, so a fixed source can't leave a poisoned runtime `<style>` (ethical-hacker creativity finding — mitigated by the existing reload, not a separate invalidation hook).
- **Generation contract:** `canvas.tsx.template` + `/design:new` now document the two-layer model — generation must not hardcode a non-default `data-theme` on artboards unless the canvas is intentionally single-theme.

## Alternatives considered

- **Propagate the iframe's `data-theme`** — rejected: the DS light values need the DS wrapper class, and the default theme varies per DS (the kanban `:root`-is-light case). Would not decouple chrome from DS.
- **Stamp class+`data-theme` on `.dc-artboard`** (first implementation) — rejected after verification: React reverts it, and the content's own wrapper overrides it. The injected-stylesheet-keyed-by-`data-dc-screen` approach is the robust replacement.
- **A flat "Theme:" item group instead of a flyout submenu** — the flyout (additive to `context-menu.tsx`, existing flat menus untouched) was chosen for the design-tool UX; existing registries with no `submenu` take the unchanged code path.
