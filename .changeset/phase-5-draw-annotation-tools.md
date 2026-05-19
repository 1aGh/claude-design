---
"@1agh/md-claude": minor
---

**Design plugin — Phase 5: draw / annotation tools.**

Annotate any canvas without leaving the dev-server. Pen, rectangle, arrow, and eraser tools mount as a transparent SVG overlay per canvas, persist to `<designRoot>/<slug>.annotations.svg`, and respect the Phase 4.1 tool grammar (V/H/C still rule; B/R/A/E switch into draw modes).

- **Four shapes.** Pen freehand (multi-point path), rectangle (drag-to-size, negative areas auto-normalize), arrow (line + tri head), eraser (click or drag — hit-tests every stroke shape, removes the topmost match).
- **Per-stroke color** via a 6-swatch floating chrome (accent · amber · green · blue · purple · ink). Default to the DS accent. Swatch only visible while an annotation tool is active.
- **World-coord storage.** Strokes are stamped in world coordinates and rendered via the live viewport published by `useViewportControllerContext`; `vector-effect="non-scaling-stroke"` keeps stroke widths pixel-thick across zoom.
- **Persistence.** Debounced 200 ms PUT to new `/_api/annotations` endpoint (`GET ?file=<canvas>` → SVG body; `PUT { file, svg }` → 204). Server writes `<designRoot>/<slug>.annotations.svg` (1 MB cap, SVG content gate). Reload restores every stroke; each canvas owns its own file (cross-canvas isolation).
- **Shortcuts.** `B` = pen, `R` = rect, `A` = arrow, `E` = eraser, `V` = back to move, `Esc` = also back to move + clears in-flight. `Shift+P` toggles presentation (hides the layer without writing). `Cmd+/` opens a native `<dialog>` shortcut sheet.
- **Coexistence with Phase 4.1.** Cmd+click in any draw mode still routes through the input-router's element selection (escape hatch). Pointer events on annotation tools return `no-op` from the router so the SVG layer claims them natively; on non-draw tools the SVG is `pointer-events: none` and the full Phase 4 / 4.1 grammar passes through.
- **Help dialog uses native `<dialog>`.** Auto-opened with `.showModal()`, dismissed by Esc or backdrop click. Backdrop styled via `::backdrop` so the scrim follows the modal's stacking context cleanly.

**New modules.** `annotations-layer.tsx` (~640 LOC — overlay + chrome + state machine + persistence client). New helpers exported for unit tests: `penPathD`, `arrowHeadPoints`, `strokesToSvg`, `svgToStrokes`, `strokeHitTest`, `rid`.

**Server surface.** `api.ts` adds `loadAnnotations` / `saveAnnotations`. `http.ts` adds the `/_api/annotations` route (`GET` / `PUT` / `POST`, returns 400 on non-SVG bodies, 405 on other methods, 1 MB body cap).

**Tool grammar.** `Tool` union extends to `pen | rect | arrow | eraser` with the `isAnnotationTool()` helper. `DEFAULT_TOOLS` grows to 7 (V/H/C/B/R/A/E). `canvas-shell.tsx` extends the cursor projection (`crosshair` for pen/rect/arrow, `cell` for eraser).

**Tests.** 30 new tests across `test/annotations-layer.test.ts` (pure helpers: path / head / hit-test / round-trip / escape) and `test/annotations-api.test.ts` (endpoint round-trip + validation gates). `bun test` 269/269 pass (+30). Existing input-router and use-tool-mode tests extend for the new tool set.

**Scenario.** `canvas-annotations` authored at `.ai/scenarios/canvas-format-tsx/canvas-annotations/spec.md`; smoke piloted against `localhost:4399` via agent-browser (PUT/GET round-trip + reload-restore + cross-canvas isolation verified end-to-end; eraser + Shift+P / Cmd+/ noted as harness limitations covered by unit tests).

**Known limitations (entry point for Phase 5.1).** Pan/zoom is blocked in draw mode (the SVG claims pointer events). Strokes can't be selected, moved, or restyled after commit. No ellipse tool, no inline text inside shapes, no background fill, single thickness. The Phase 5.1 plan at `.ai/plans/phase-5.1-annotations-figjam.md` covers all of these plus a canvas-chrome redesign (centered icon toolbar replacing the current bottom-left palette).
