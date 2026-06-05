# canvas-figjam-feel

**Persona:** Single developer iterating on TSX canvases. Expects FigJam-class direct-manipulation feel — Cmd-click selects, marquee for multi-select, floating toolbars expose primary actions, distribute/align lay artboards out, comment composer drops near the cursor.

**Canvases under test:** `.design/ui/Canvas Viewport.tsx` (10 artboards — exercises multi-select / distribute / align gestures across a meaningful set; rich `[data-cd-id]` content for ContextualToolbar + comment-compose).

**Hypothesis:** After Wave 3 + Wave 3.5 + Wave 3.6 land, the canvas viewport behaves as a coherent direct-manipulation surface:

- Cmd+Click on artboard chrome selects one artboard. Cmd+Shift+Click accumulates. ≥ 2 selected → `MultiArtboardToolbar` floats above the union bbox with align (6 modes, enabled at ≥ 2) + distribute (2 modes, enabled at ≥ 3) buttons.
- Cmd+Click on a stamped `[data-cd-id]` element opens `ContextualToolbar` (Copy CSS / Copy ID / Comment).
- Comment button in either toolbar dispatches `cm:open-composer` and the composer renders near the cursor click point (not flush in the element's bottom-left).
- Click on empty world clears selection. Click on a floating toolbar button does NOT clear selection (G3/G7 root-cause fix).
- Single click on artboard label no longer auto-zooms (G2v2 fix). Cmd+1 / zoom HUD remain.
- Annotation toolbar shows the FigJam 11-color palette in both Stroke and Fill modes; thickness chooser appears only in Stroke mode.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |

Native iOS / Android intentionally **SKIPPED** — canvas is desktop-only per `.design/ui/Canvas Viewport.meta.json#platform: "desktop"`. Touch input has no parity story for Cmd-modifier gestures, marquee lasso, hover-only pink dots. Web-mobile likewise skipped — the dev-server is desktop-development tooling, not a mobile product surface. Document in run report as `SKIPPED reason="canvas viewport is desktop-only dev tool; no touch / mobile parity story"`.

## Preconditions

- Dev server running (`bun apps/studio/server.ts --root . --port 4555`).
- `.design/ui/Canvas Viewport.tsx` accessible at the dev-server root (10 artboards present).
- Browser viewport at 1440×900.

## Steps

1. **Open Canvas Viewport.tsx; assert load.**
   - Navigate to dev-server root, click "Canvas Viewport" in the file tree.
   - Capture full-page screenshot of the canvas iframe.
   - Assert `[data-dc-screen]` × 10 inside the iframe.
   - Assert active tool = `move` (`.dc-canvas[data-active-tool="move"]`).

2. **Single click on empty world — selection survives initial state.**
   - Click empty canvas at (200, 200). No selection yet, so nothing to clear; confirm no halo painted.

3. **Cmd+Shift+Click 3 artboards via dispatch chain.**
   - For each of `idle`, `zoomed`, `draw`: dispatch `pointerdown`/`mousedown`/`pointerup`/`mouseup`/`click` with `metaKey: true, shiftKey: true` on the article element.
   - Assert `.dc-cv-halo` × 3 painted, `.dc-cv-group-bbox` visible.
   - Assert `.dc-multi-artboard-tb` displayed with 8 buttons (6 align + 2 distribute), all `disabled=false`.

4. **Click Distribute Horizontally — middle artboard moves.**
   - Capture artboard x positions before click.
   - Dispatch full pointer chain (`pointerdown` → `click`) on `button[aria-label="Distribute horizontally"]`.
   - Assert `.dc-cv-halo` × 3 STILL painted (selection survives — G7v2 chrome-filter fix).
   - Assert middle artboard's `style.left` changed to an evenly-distributed midpoint.

5. **Click Align Top — all y positions converge to minimum.**
   - First reset positions via PATCH `/_api/canvas-meta` (set varied y values).
   - Re-select the 3 artboards.
   - Dispatch pointer chain on `button[aria-label="Align top"]`.
   - Assert all 3 artboards share the same `style.top` (the minimum y of the selected set).

6. **Cmd+Click on a [data-cd-id] element — ContextualToolbar appears.**
   - Find the first `.dc-artboard-body [data-cd-id]` element.
   - Dispatch pointer chain with `metaKey: true` (no Shift).
   - Assert `.dc-elem-ctx-tb[data-on="true"]` appears with 3 buttons (Copy CSS / Copy ID / Comment).

7. **Click Comment in ContextualToolbar — composer renders near cursor.**
   - Capture ContextualToolbar selection from prior step.
   - Dispatch pointer chain on `button[title="Add comment on this element"]`.
   - Wait 300 ms for state update.
   - Assert `.cm-composer` exists in DOM with `style.left` and `style.top` set to non-zero values matching the element's right/center (per `openComposerForSelection` math: `r.right - 8`, `r.top + r.height / 2`, then +8 for composer drop).

8. **Single click on artboard label — viewport unchanged (G2v2 verification).**
   - Capture `.dc-world` `style.zoom` and `style.transform` before click.
   - Real click on `[data-dc-screen="idle"] button.dc-artboard-label`.
   - Wait 400 ms.
   - Assert zoom + transform are byte-identical (no `jumpTo` fired).

9. **Click on empty world after multi-select — selection clears (G1 regression check).**
   - Multi-select 2 artboards (Cmd+Shift+Click).
   - Click on `.dc-canvas` at coords outside any artboard and outside any toolbar (e.g. clientX: 10, clientY: 200).
   - Assert `.dc-cv-halo` × 0 (selection cleared per G1 fix).

## Success criteria

- All 9 steps PASS.
- Zero JS console errors in the canvas iframe over the full run.
- Selection-survives-toolbar-click verified in steps 4 + 5 + 7 (this was the G3/G7 root-cause regression).
- Cross-platform parity: N/A (web-desktop only by design; native + mobile documented as SKIP).

## Counter-delta

Single platform — no counter-delta. The scenario IS the verification; if all steps PASS on web-desktop, that's the gate.

## Follow-ups (not blocking)

- Add a separate `canvas-figjam-feel-keyboard` scenario covering Arrow nudge + Cmd+A (T29).
- Add a `canvas-figjam-feel-lod` scenario zooming out past 0.35 and asserting ticks/pills disappear (T31).
- Element-level marquee (T26): scenario for drag from artboard body padding lassoing user content.
