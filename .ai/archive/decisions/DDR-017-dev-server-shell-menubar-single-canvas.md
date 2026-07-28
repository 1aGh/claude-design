# DDR-017: Dev-server shell = shadcn-style menubar + single-canvas viewport (tabs row killed)

- **Date:** 2026-05-17
- **Status:** Accepted
- **Tags:** design, dev-server, shell, chrome, menubar, ux, phase-3.5
- **Related:** [`.ai/plans/phase-3.5-dev-server-ui-ux-refresh.md`](../plans/phase-3.5-dev-server-ui-ux-refresh.md), [DDR-014](./DDR-014-css-layer-architecture.md), [`.design/ui/Canvas Viewport.html`](../../.design/ui/Canvas%20Viewport.html) (CV-01, CV-08), `plugins/design/dev-server/client/app.jsx` (Menubar / ViewDropdown / HelpModal components), `plugins/design/dev-server/client/styles/3-shell.css` (`.mb*` rules)

## Context

Phase 3.5 originally accepted *"surrounding chrome — header + tabs row + status bar wrap — is **not separately mocked**; rebuild it from project DS specimens"*. Mid-execution the user pushed back against that exemption: every CV-NN artboard in `.design/ui/Canvas Viewport.html` shares the same top `Menubar` component (`<header className="mb">`), so the chrome **is** mocked — it's the artboard's spine, not a wrapper. The action-button toolbar (`tree · active · comments · open`) the dev-server had landed in T6 didn't match.

Two coupled questions opened up:

1. **What is the topbar?** The mock's menubar has six menus (File · Edit · View · Selection · Tools · Help) on the left and a state stamp (`CV-NN | file | counter`) on the right. shadcn / radix pattern. Stark contrast to our action-button header.
2. **What about tabs?** CV-08's sidebar drives canvas selection from the tree; there is no tabs row in any of the 10 mocked artboards. The original dev-server allowed multiple iframes open simultaneously with a tabs strip.

## Decision

Adopt the menubar as the canonical topbar **and** drop the multi-tab UI entirely; the dev-server is single-canvas.

### Components

- **`<Menubar>`** — fixed 30 px height, `--u-bg-2` fill with 1 px ink rule below. Left: `■ mdcc` brand + 6 menus (File / Edit / View / Selection / Tools / Help). Right: `.mb-status` slot with `cv-stamp` (IDLE / CANVAS / SYSTEM), file path, `● N ARTBOARDS`, `ZOOM 100%`, project SKU.
- **`<ViewDropdown>`** — opens below `View`. Functional toggles: Project Tree (T), Comments Sidebar (⌘⇧M), Design system view (S). Inert items carry a `phase-tag` (Layers / Inspector → Phase 12, Annotations → Phase 5, Presentation Mode → Phase 6, Zoom controls → Phase 4).
- **Help menu** is the only other interactive top-level menu in Phase 3.5. Clicking it opens `<HelpModal>` (modal-mode, not a dropdown).
- **Single-canvas viewport.** `tabs` state is preserved internally as a 0-or-1 array so `iframesRef` / WebSocket `tabs` payload / comments push pipeline don't have to be re-modeled; opening a new file replaces the previous one (`openTab` drops the prior iframe from `iframesRef`).

### Surface mapping shift

Status-bar slots `ARTBOARDS` and `ZOOM` (added in T13) **moved up into `.mb-status`** to match the mock's pattern (canvas state on the menubar's right). The bottom statusbar keeps only chrome state: ACTIVE / SELECTED / COMMENTS / LIVE / spacer / THEME.

## Consequences

### Good

- Visual parity with every CV-NN mock — the menubar pattern is shared infrastructure designers see in their work; the dev-server reads as "same product".
- Keyboard surface gets a clean home: T toggles tree, S toggles system view, ⌘⇧M toggles comments, ? / F1 opens Help. Each shortcut surfaces in the View dropdown.
- Phase 4 inherits a cleaner mental model: one canvas at a time, no tab strip to reconcile with the multi-artboard plane it will introduce (artboards become first-class peers under one umbrella, not "tabs vs artboards").
- The `.mb-status` cv-stamp pattern (`IDLE / CANVAS / SYSTEM`) generalizes: Phase 4 adds zoom + world coords there; Phase 5 adds draw-tool stamp; etc.

### Trade-offs / costs

- Lost multi-tab workflow (open several canvases, hop between them via a tab strip). The user explicitly opted for this — opening a new file in the tree replaces the active one. For multi-canvas comparison the user opens two browser windows / panes.
- `Cheatsheet` left the sidebar and became `<HelpModal>` triggered from Help. Discoverability dipped slightly (one extra click) but the sidebar got back ~280 px of vertical space for the tree.
- Inert menus (File / Edit / Selection / Tools) render with `aria-disabled="true"` + `title="Coming in a later phase"`. They reserve real estate — when those phases land, the dropdowns slot in without re-layout.

### Subtle issue uncovered during validate

Initial implementation set `.mb { overflow: hidden }` to clip status-section content when `.main` narrows (rsidebar open). That **also clipped the View dropdown**, which is `position: absolute; top: 30px` and renders *below* the menubar bounds. Bug invisible until the user clicked View and saw nothing. Fix: drop `overflow: hidden` from `.mb`; right-side clamp stays on `.mb-status` (already had `overflow: hidden; min-width: 0`). See `client/styles/3-shell.css` `.mb` rule comment.

## Alternatives considered

- **Keep action-button header.** Rejected — diverges from every CV mock; couldn't be "rebuilt from DS specimens" because the DS specimens don't have an action-toolbar pattern, they have menubar.
- **Tabs row below menubar.** Considered as a compromise (preserve multi-canvas workflow + add menubar). Rejected by the user as "two-strip chrome" — the mock's premise is single-canvas focus and tabs would dilute that.
- **Move all canvas-state slots into the menubar; kill the bottom statusbar entirely.** Tempting symmetry — but the bottom statusbar carries chrome state (selected element, theme, live socket) that doesn't change per-canvas. Two strips for two distinct rhythms.

## Migration notes (for Phase 4)

- `tabs[]` state can stay or be flattened to `activePath: string | null` — both are compatible with the menubar.
- Multi-artboard plane (Phase 4's headline feature) lives **inside** the single canvas — the cv-stamp becomes `CANVAS · 6 ARTBOARDS` instead of `1 ARTBOARDS`. No change to the menubar grammar.
- Pan/zoom controller wires into the existing ZOOM slot (currently static `100%` placeholder).
- If a multi-canvas workflow is ever re-introduced, prefer a window/pane split (browser-level) over a tab strip — the mock's spine pattern is the contract.
