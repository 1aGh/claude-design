---
"@1agh/maude": minor
---

Canvas-shell chrome now follows the Maude dev-server theme, decoupled from the design system.

- The canvas workspace plane, floating tool palette, minimap, zoom HUD, selection halos, contextual toolbar, context menu, undo HUD, AI banner, and presence chrome now flip dark↔light **with** the chrome theme toggle, in every open canvas — via a self-contained `--maude-chrome-*` token family keyed by a `data-maude-theme` attribute and propagated over the existing `dgn:*` postMessage bridge. The brand accent stays theme-agnostic; no design-system palette leaks into the chrome (closes system-review D9).
- **Artboards keep their design system's theme by default.** A new right-click **Theme ▸ DS default / Light / Dark / Follow chrome** submenu flips an individual artboard at will; Light/Dark are enabled only when the DS ships both light + dark token blocks (detected by a runtime probe). The override is applied via an injected stylesheet keyed by the artboard's stable id, so it survives canvas re-renders.
- `/design:new` + the canvas template now document the two-layer theme model so generated canvases don't hardcode a non-default artboard theme.
