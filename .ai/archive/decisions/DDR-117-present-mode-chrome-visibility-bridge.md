# DDR-117 — Presentation Mode + the shell↔canvas chrome-visibility bridge

**Status:** accepted
**Date:** 2026-06-19
**Phase:** (standalone — closed via /flow:done on `native-app`, no phase plan)
**Related:** DDR-054 (untrusted canvas iframe), DDR-046 (floating chrome), the
`dgn:'view-annotations'` / `dgn:'theme'` / `dgn:'zoom'` postMessage bridges (prior art),
`open-inspector` (the canvas→shell shell-UI-mutation precedent).

## Context

Two gaps in the studio chrome:

1. The mini-map (`DCMiniMap`) and zoom pill (`DCZoomToolbar`) render **inside** the
   canvas iframe, gated only by a static `controls` prop on `DesignCanvas` — the shell
   menubar had no way to hide them.
2. "Presentation Mode" was a Phase-6 stub (`{ id:'present', disabled:true }`) that, even
   as documented (⇧P), only hid **annotations**. The ask was a real present mode: hide
   the WHOLE UI (shell menubar/sidebar/panels + in-canvas minimap/zoom/tool-palette/
   annotations/comment pins), leave only artboards, with a way back to the chrome.

The chrome to hide spans **two documents**: shell-rendered chrome (menubar, sidebar,
panels — the parent window) and canvas-rendered chrome (minimap, zoom, tool palette,
annotations, comments — the cross-origin iframe, DDR-054). No single React tree owns both.

## Decision

**A shared canvas-side visibility store + a `dgn:'view-chrome'` bridge, with present mode
modelled as a non-destructive overlay; shell chrome hidden by a single CSS class.**

- `use-chrome-visibility.tsx` — a tiny `{ minimap, zoom, present }` React context (mirrors
  `use-annotations-visibility.tsx`), mounted by `CanvasShell` so the user canvas (minimap/
  zoom), tool-palette, and annotations-layer all read one value. Null outside a provider
  (bare DS specimen) → treated as "all visible" (fail-open; the feature is view-only).
- `dgn:'view-chrome' { minimap?, zoom?, present? }` (shell→canvas, merge-patch) is the
  single message; it joins the existing `theme`/`zoom`/`view-annotations` family and is
  **correctly ungated on `e.source`** (view-only; only DOM-mutating `apply-style` needs
  that gate). The shell broadcasts to every open iframe and re-seeds on `dgn:'loaded'`.
- **`present` is a master overlay-hide that supersedes `minimap`/`zoom`** and, crucially,
  does **not** mutate the user's individual toggles — exiting restores prior state.
  Annotations fold `present` into their render gate without touching the stored visibility;
  comment pins are suppressed by posting an empty `comments-set` while presenting (re-posted
  on exit). No persisted side effect.
- **Shell chrome** is hidden by a `.maude.is-present` class + two structural rules
  (`.st-shell > :not(.st-body)`, `.st-body > :not(.main)`) — viewport-only, state preserved.
- **Escape hatch:** Esc (highest-priority, fires even with canvas focus) **and** a floating
  exit pill (a trusted top-level `.maude` child the clipped canvas cannot cover).
- The canvas tool-palette button enters present mode by requesting it from the shell via
  `dgn:'present-enter'` (canvas can't hide shell chrome locally) — inside the DDR-054
  origin gate, within the `open-inspector` precedent.

## Consequences / guardrails

- **Canvas-initiated `present-enter` is hardened** (phase-28-style audit, both findings LOW/
  below floor): honored only from the **active** canvas and **never while a modal is open**,
  so an untrusted canvas can't blank an in-flight confirmation. Fail-closed sync/divergence
  banners (`.st-banner`, DDR-102) are **deliberately kept visible** in present mode — a
  canvas must not be able to silence a security notice.
- **Residual (deferred):** Sidebar-descendant modals (OAuth device-code, Share/invite) are
  hidden by the `:not(.main)` rule because `display:none` on the ancestor defeats their
  `position:fixed`. The structural fix — portal them to the top-level `.maude` tier like
  `DiffView`/`ExportDialog` (which correctly survive) — is a phase-28+ item (those components
  are under concurrent edit). The active-tab + modal guard covers the untrusted-canvas vector
  meanwhile. See `.ai/logs/security-reviews/present-mode-chrome-toggles.md`.
- New `_*` runtime paths were **not** introduced, so the DDR-115 three-list taxonomy is
  unaffected.

## Alternatives considered

- **Toggle the static `controls` prop** — rejected: it's per-canvas authored JSX, not
  shell-controllable at runtime.
- **Shell posts `view-annotations:false` on present, restores on exit** — rejected: mutates
  the user's annotation toggle + risks desync; the non-destructive `present` flag is cleaner.
- **Portal all modals now** — deferred (concurrent phase-28 edits); see residual above.
