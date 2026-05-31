# Feature: Annotations FigJam-parity polish v2 (Phase 24)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **This phase touches the most load-bearing dev-server file (`annotations-layer.tsx`, 2755 lines) — read the Regression Inventory and the hard invariants below BEFORE writing a single line.**

## Description

Phase 21 (`096f0bf`) shipped the FigJam-style annotation vocabulary — sticky notes, standalone text, rect corner-radius, arrow heads + dash, dark icon toolbars, custom cursors. This follow-up closes the remaining gaps between our chrome and FigJam's, per the user's 7-point brief (numbered 1–5 + 7; there is no 6):

1. **Ghost placeholder** — a translucent cursor-following preview for shape + sticky (+ text caret) while a draw tool is armed, exactly like FigJam.
2. **Sticky notes** — always 1:1 ratio; redesigned toolbar; text aligned **left/top**; **remove** the corner-radius switch and any stroke option; **dim/muted** colour palette (Image #2).
3. **One Shape tool** — collapse the two separate `rect` (R) + `ellipse` (O) palette buttons into a single **Shape** tool with a small shape-type switcher (Image #3/#4): square, rounded square, circle, diamond, triangle, triangle-down + dashed/solid stroke.
4. **Arrows** — full FigJam arrowhead set (none / line / triangle / triangle-outline / circle / diamond) selectable per-end, plus line-type (straight / curved / elbow) (Image #5).
5. **Text** — richer options (Image #6): named size presets (Small → Huge) + numeric field + Bold + Strikethrough + alignment, applied to standalone text, anchored text (inside shapes), AND sticky bodies.
7. **Cursors** — adopt a cohesive open-source CC0/MIT cursor pack and re-author `canvas-cursors.ts` so pen / hand / select / shape / erase / sticky / text / comment share one visual identity.

## User Story

As a designer marking up a canvas, I want the annotation tools to behave and look like FigJam — a single shape tool, square stickies with muted colours and left-aligned text, expressive arrows, rich text controls, ghost previews, and beautiful cursors — so the in-canvas markup experience feels professional and predictable instead of "takové divné".

## Problem

The Phase 21 vocabulary is functionally present but visually + behaviourally off from FigJam:

- Shapes are two competing palette buttons (rect/ellipse) instead of one switchable tool; only 2 primitives exist (no diamond/triangle).
- Stickies are 200×160 (not square), have a corner-radius switch, centre-aligned text, and a saturated 6-colour palette; the **per-selection context toolbar even paints a sticky with stroke-ink colours** (`STROKE_PALETTE`) instead of the paper-tint `STICKY_PALETTE` — a latent bug (`annotations-context-toolbar.tsx:476-480`).
- Arrowheads are limited to `none | triangle`; no circle/diamond/outline; no curved/elbow routing.
- Text size is three fixed chips (12/14/20); no bold/strike/alignment; no numeric entry.
- No ghost preview — a shape/sticky only appears once a drag begins, so placement is guesswork.
- Cursors are hand-authored one-offs without a unified design language.

## Solution

Extend the annotation **schema** (new polygon shape kind, richer arrowhead enum, text/sticky `bold`/`strike`/`align`, sticky 1:1) **strictly back-compatibly** — every new attribute serializes only for non-default values so legacy `.annotations.svg` files round-trip byte-identical (the Phase 21 canary `test/fixtures/phase-20-annotations.svg` must stay green). Redesign the **palette** (single Shape tool + popover), the **draw-time tray**, and the **per-selection context toolbar** (sticky branch, shape-kind switcher, arrowhead/line-type dropdowns, text presets). Add a **ghost-preview layer**. Adopt a **CC0 cursor pack** (license-gated). Verify against an exhaustive **per-feature agent-browser regression inventory** — this is a risky dev-server refactor and the bar is **100% no regressions** (see the user's standing rule).

## Metadata

- **Ticket**: n/a (internal phase plan)
- **Type**: Enhancement (FigJam-parity polish on Phase 21)
- **Complexity**: **High** — single 2755-line file, new data model, byte-identical back-compat invariant, large UI surface, license gate.
- **App/Package**: `plugins/design/dev-server` (canvas client chrome; ships via npm `files` + plugin marketplace)
- **Affected Systems**: annotation schema + serialize/parse, draw flow, rendering, selection/resize, palette, context toolbar, draw-time chrome, cursors, icons, input-router, undo (verify only).
- **Dependencies**: chosen CC0 cursor pack (Task 0). No new npm runtime deps (cursors embed as inline SVG data-URIs; `happy-dom` already a devDep from Phase 21).

---

## Hard invariants (DO NOT BREAK)

1. **Byte-identical legacy round-trip.** `strokeToSvgEl`/`svgToStrokes` must emit the pre-Phase-24 form for any stroke whose new fields are at their defaults. New attributes (`data-shape`, expanded `data-start-head`/`data-end-head`, `data-line-type`, `data-bold`, `data-strike`, `data-align`) appear **only** for non-default values. Canary: `test/annotations-roundtrip.test.ts` + `test/fixtures/phase-20-annotations.svg`. Add a NEW fixture for a Phase-21-era sticky/rect/arrow and assert it too.
2. **Sticky body persists in an allowlisted `<text>` child, NOT a `<foreignObject>`** (DDR-060 F1 — `sanitizeAnnotationSvg` strips `foreignObject`). The live canvas renders a `foreignObject` for word-wrap; the persisted form is the inert `<text>`. Preserve this split (`annotations-layer.tsx:265-282`).
3. **tsc DDR-026 baseline** — only `api.ts` ×2 + `runtime-bundle.ts` may error. Zero NEW tsc errors.
4. **Runtime bundles** (`dist/runtime/*.js`) are unrelated to this change — do NOT regenerate or touch them. The **client bundle** (`dist/client.bundle.js`) + `dist/comment-mount.js` ARE produced from this source and MUST be rebuilt + committed (`bun run build.ts`).
5. **License gate (Task 0).** Any embedded cursor asset must be redistributable inside an MIT npm package + marketplace clone. **CC0 = safe (no attribution). GPL/AGPL = BLOCKER** (Bibata is GPL-3.0 — copyleft would relicense the package). Verify the chosen pack's license file before lifting a single path.
6. **License/Czech-comment parity** — match the file's existing comment density + the `@file/@scope/@purpose` header style. UI strings stay English (chrome is product-level, not bilingual).

---

## Context References

### Must-Read Files

> When consuming this section during `/flow:execute`, read every file listed here in parallel in a single assistant message (multiple Read tool calls) — they're independent context loads.

- `plugins/design/dev-server/annotations-layer.tsx` (whole file, 2755 lines) — Why: schema (types `54-203`), serialize `247-336`, parse `357-485`, hit-test `504-571`, bbox `605-665`, draw flow `beginStroke 1222-1327` / `moveStroke 1329-1363` / `endStroke 1365-1405`, render `StrokeNode 2461-2632`, draw-time tray `AnnotationsChrome 2638-2755`, sticky CSS `.dc-sticky-body 837-855`, editors `2103-2346`. THE core file.
- `plugins/design/dev-server/annotations-context-toolbar.tsx` (716 lines) — Why: per-selection toolbar; `caps` intersection `250-283`, swatch mode `476-480` (sticky-color bug), the corner/arrow/dash/fontSize control rows.
- `plugins/design/dev-server/canvas-icons.tsx` (261 lines) — Why: inline-SVG icon set + `TOOL_ICONS` map `250-261`. Add shape-kind + arrowhead + text-style icons here.
- `plugins/design/dev-server/canvas-cursors.ts` (125 lines) — Why: current cursor authoring pattern (`svgCursor` data-URI + hotspot + fallback) + `TOOL_CURSORS` map.
- `plugins/design/dev-server/use-tool-mode.tsx` (158 lines) — Why: tool store + `DEFAULT_TOOLS 43-54` + `sticky` lock mechanism. Add `shapeKind` + arrow/text draw-defaults here.
- `plugins/design/dev-server/tool-palette.tsx` (354 lines) — Why: palette render + `NAV_TOOLS`/`DRAW_TOOLS 191-194` + zoom popover pattern (reuse for the Shape picker popover).
- `plugins/design/dev-server/input-router.tsx` (lines 58-90, 159-175) — Why: `Tool` union + `ANNOTATION_TOOLS` set + `classify` key→tool table.
- `plugins/design/dev-server/use-annotation-resize.tsx` (306 lines) — Why: `isResizable 63-73`, `resizeStroke 81-152`, `handlePositions 159-174`. Add polygon + sticky-1:1 constraint here.
- `.ai/plans/phase-21-annotation-vocabulary-figjam.md` — Why: the predecessor plan + its acceptance log; mirror its task discipline + back-compat technique.
- `plugins/design/dev-server/test/annotations-roundtrip.test.ts` + `test/annotations-layer.test.ts` + `test/input-router.test.ts` + `test/canvas-cursors.test.ts` — Why: the test shapes to extend; the byte-identical canary lives here.

### Files to Create

- `plugins/design/dev-server/test/fixtures/phase-21-annotations.svg` — a Phase-21-era canvas (sticky + rounded rect + arrow-both-dash) frozen as a byte-identical round-trip canary.
- `.ai/decisions/DDR-067-*.md` (number TBD at write time — check the highest existing DDR) — shape-tool data model + arrowhead vocabulary expansion + cursor-pack licence decision. (May be split into 2–3 DDRs; see Task 12.)
- (Optional) `plugins/design/dev-server/canvas-arrowheads.ts` — if the arrowhead geometry helpers grow large enough to warrant extraction from `annotations-layer.tsx`.

### Design canvases

> Read-only scan of `.design/**/*.meta.json` surfaced no canvas tagged/slugged for "annotations / figjam / cursor". This feature targets the **dev-server chrome itself** (the tool that renders canvases), not a `.design/` mockup — so there is no canvas to ground against. The 6 reference images in the brief (FigJam screenshots) are the spec; they live only in the chat, so transcribe the relevant details into the task notes during execution.

### Documentation / Reference

- Kenney Cursor Pack — **CC0** (public domain, 110+ cursors, PNG + SVG). https://kenney.nl/assets/cursor-pack — Why: safest licence for embedding/redistribution; strongest Task-0 candidate.
- Bibata_Cursor — material-designed, SVG sources. https://github.com/ful1e5/Bibata_Cursor — Why: visually excellent BUT verify licence — **GPL-3.0 is a BLOCKER** for our MIT package. Candidate only if a permissive sub-licence applies to the SVG art.
- Apple Cursor / Fuchsia Cursor (ful1e5) — Why: **avoid** — macOS/Fuchsia likeness carries trademark/IP risk regardless of repo licence.
- MDN `cursor` (data-URI, hotspot, 32×32 ceiling) https://developer.mozilla.org/en-US/docs/Web/CSS/cursor — Why: confirms the `url(...) hx hy, fallback` contract already used.

### Patterns to Follow

- **Non-default-only serialization** (the back-compat technique), `annotations-layer.tsx:305-328`:
  ```ts
  const endHead = s.endHead ?? 'triangle';
  const startHead = s.startHead ?? 'none';
  const dataAttrs =
    (startHead !== 'none' ? ` data-start-head="${startHead}"` : '') +
    (endHead !== 'triangle' ? ` data-end-head="${endHead}"` : '') +
    (dashed ? ' data-dash="1"' : '');
  ```
  Every new field MUST follow this "emit only when ≠ default" rule.
- **Popover pattern** (lazy-mount + outside-pointerdown close), `tool-palette.tsx:209-216` (zoom popover) — reuse verbatim for the Shape-kind picker.
- **Draw-time tray vs per-selection toolbar** share one palette source (`STROKE_PALETTE`/`FILL_PALETTE` exported from `annotations-layer.tsx`) — keep that single-source discipline when adding the sticky dim palette + arrowhead/line-type controls.
- **Cursor authoring**, `canvas-cursors.ts:21-40` (`svgCursor` + `HALO`/`INK` constants + per-tool hotspot).

---

## Design Decisions

> UI feature — design tokens come from the dev-server chrome token family (`--maude-chrome-*`, `--maude-hud-accent`), NOT a project DS (this is internal chrome — `design-system-guard` is N/A, confirmed by Phase 21).

### Data-model decisions (DDR-worthy)

| Decision | Choice | Back-compat |
| -------- | ------ | ----------- |
| Shape tool | One active `shape` tool + `shapeKind` selector. `rect`/`ellipse`/`polygon` remain **stroke** discriminants. square/rounded → `rect` stroke; circle → `ellipse`; diamond/triangle/triangle-down → new `polygon` stroke. | rect/ellipse unchanged on disk. polygon is brand-new → `<polygon data-tool="polygon" data-shape="diamond" ...>`. |
| Arrowhead vocabulary | `'none' \| 'line' \| 'triangle' \| 'triangle-outline' \| 'circle' \| 'diamond'` per end. | default start=`none`, end=`triangle` → emit nothing (byte-identical). |
| Arrow line-type | `'straight' \| 'curved' \| 'elbow'`; default `straight`. | default → no `data-line-type`. **Elbow (orthogonal routing) is the highest-risk sub-item — time-box it; ship straight+curved first, elbow as a stretch within this phase or a clean follow-up.** |
| Text style | `bold?`, `strike?`, `align?: 'left'\|'center'\|'right'` on `TextStroke` + `StickyStroke`. | default false/false/(centre for anchored, left for sticky/standalone) → emit nothing. |
| Sticky geometry | Always square (1:1). Default 200×200. Drag-create + resize constrain to a square. | width/height already persisted; squareness is enforced at create/resize, not a schema change. |
| Sticky palette | Replace 6-colour saturated set with ~10 **muted** FigJam tints (Image #2). | `STICKY_PALETTE` is a code constant; existing stickies keep their stored hex. Keep yellow (`#ffe27a`-ish) as slot 0 default OR re-tune — if the default hex changes, existing default stickies keep the OLD hex (fine; only NEW stickies get the new default). |

### Shape primitives (minimal set — user: "staci jen par zakladnich")

| Kind | Stroke | Geometry |
| ---- | ------ | -------- |
| Square | `rect` (cornerRadius 0) | x/y/w/h |
| Rounded | `rect` (cornerRadius 8) | x/y/w/h + rx |
| Circle/Ellipse | `ellipse` | cx/cy/rx/ry |
| Diamond | `polygon` shape=`diamond` | 4 pts from bbox |
| Triangle | `polygon` shape=`triangle` | 3 pts (apex up) |
| Triangle-down | `polygon` shape=`triangle-down` | 3 pts (apex down) |

### Icons (canvas-icons.tsx — inline Lucide-style, currentColor, 1.75 stroke)

| Icon | Purpose |
| ---- | ------- |
| `IconShape` | Shape tool button (a square+circle composite or a generic shape) |
| `IconDiamond`, `IconTriangle`, `IconTriangleDown`, `IconSquare`, `IconRoundedSquare`, `IconCircle` | Shape-kind switcher |
| `IconArrowheadLine`, `IconArrowheadCircle`, `IconArrowheadDiamond`, `IconArrowheadTriangleOutline` (+ reuse existing triangle/none) | Arrowhead picker |
| `IconLineStraight`, `IconLineCurved`, `IconLineElbow` | Line-type picker |
| `IconBold`, `IconStrike`, `IconAlignLeft`, `IconAlignCenter`, `IconAlignRight` | Text-style controls |

### Tokens

| Purpose | Token |
| ------- | ----- |
| Floating chrome surface (dark bar) | hardcoded `#26262b` (matches Phase 21 `CTX_SURFACE`) |
| Active/selection accent | `var(--maude-hud-accent, #d63b1f)` |
| Chrome bg / fg / shadow | `--maude-chrome-bg-0`, `--maude-chrome-fg-0`, `--maude-chrome-shadow` |

---

## Regression Inventory (per the user's "no-break exhaustive verify" rule)

> This is a risky dev-server refactor. Bar = **100% no regressions**. Every row below MUST be re-verified live via agent-browser after the change (Validation §5). List it BEFORE editing so nothing is silently dropped.

| # | Existing feature | How to verify |
|---|------------------|---------------|
| R1 | Pen draw + colour + thickness | draw, recolor, thin/thick |
| R2 | Rect draw + fill + thickness + corner-radius | (now via Shape tool) draw square/rounded, fill, thin/thick |
| R3 | Ellipse draw + fill | (now via Shape tool) draw circle, fill |
| R4 | Arrow draw + heads + dash | draw, flip heads, dash |
| R5 | Sticky create (tap → default; drag → sized) + edit + colour | tap, drag, type, recolor |
| R6 | Standalone text create + re-edit + delete-on-empty | T, click, type, Enter; re-edit |
| R7 | Anchored text (double-click rect/ellipse) | dbl-click shape, type |
| R8 | Eraser | erase each stroke kind incl. polygon |
| R9 | Move-tool select (click / shift-add / marquee) | all three |
| R10 | Drag-translate group (one undo record) | drag, Cmd+Z once |
| R11 | Resize handles (rect/ellipse/arrow/pen/sticky) | each corner/endpoint |
| R12 | Arrow keys nudge + Backspace/Delete | nudge, delete |
| R13 | Undo/redo across all mutations | Cmd+Z / Cmd+Shift+Z |
| R14 | Context toolbar positioning (follows pan/zoom) | pan + zoom with selection up |
| R15 | Persistence (PUT + reload) | reload page, strokes survive |
| R16 | **Legacy `.annotations.svg` byte-identical round-trip** | load a `_history/*/annotations*.svg`, save, diff |
| R17 | Collab live update (Y.Map observe) | two tabs |
| R18 | Presentation toggle (Shift+P) + visibility | toggle hide/show |
| R19 | Sticky-tool lock (double-click palette) | double-click, draw many |
| R20 | Cursor swap per tool | hover each tool, confirm cursor |

---

## Tasks

Execute in order. Each task is atomic and ends with a verify step. **Run `bun test` after every schema/geometry task** — the byte-identical canary is the early-warning system.

> **Execution progress (Phase 24, in-flight):**
> - ✅ **Task 0** — Kenney CC0 pack chosen (user-confirmed; Bibata GPL blocked). Pack at `~/Downloads/kenney_cursor-pack`. Adopt in Task 9.
> - ✅ **Task 1** — schema extended: `PolygonStroke` + `ArrowHead`/`ArrowLineType` (owned by `canvas-arrowheads.ts` to avoid a JSX-breaking module cycle) + text/sticky `bold`/`strike`/`align`. tsc = 3 baseline.
> - ✅ **Task 2** — serialize/parse for all new fields, non-default-only. Phase-20 + new **frozen `phase-21-annotations.svg`** canaries both byte-identical. `polygon`+`circle` added to the DDR-060 sanitizer allowlist.
> - ✅ **Task 3** — polygon hit-test/bbox/translate/meaningful/resize + arrow shaft/head geometry (`canvas-arrowheads.ts`, straight/curved/elbow + 6 heads). 806/806 tests green.
> - ✅ **Task 4** — single Shape tool (palette button + 6-kind popover); `r`/`o` → `shape`; beginStroke maps shapeKind → rect/ellipse/polygon; tap → default-size shape. input-router/use-tool-mode tests updated.
> - ✅ **Task 5** — sticky 1:1 (drag + resize), 10 muted dim tints, top-left text, corner switch dropped, **sticky-colour bug fixed** (context toolbar shows STICKY_PALETTE).
> - ✅ **Task 6** — full 6-head set + line-type per-end **dropdowns** in the context toolbar + shared-primitive render (straight/curved/elbow). _Deferred: draw-time "inherit last choice" quick-pick (DDR-067 — secondary; new arrows use the FigJam default)._
> - ✅ **Task 7** — font-size dropdown (Small→Huge presets + numeric 8–200) + Bold/Strike + align dropdown, applied to standalone/anchored text + sticky bodies + all 3 editors.
> - ✅ **Task 8** — ghost placeholder (shape/sticky/text follow cursor; pure chrome, pointer-events:none, never persisted; reduced-motion-safe static).
> - ✅ **Task 9** — cursors re-authored from the **Kenney CC0 pack** (pen/hand/shape/eraser/text); comment+sticky stay hand-authored.
> - ✅ **Task 11** — tests: polygon serialize/parse/bbox/hit-test/vertices, 6×6 arrowhead combos + 3 line-types round-trip, text/sticky bold/strike/align round-trip, cursor `shape` exhaustiveness, both byte-identical canaries. **809 full-suite + 209 targeted green; tsc 3-baseline.**
> - ✅ **Task 12** — `client.bundle.js` + `comment-mount.js` rebuilt (runtime untouched, check-runtime-bundles OK); **DDR-067** written; roadmap regenerated.
> - ✅ **Task 10 (a11y)** — `flow:a11y-auditor` + `frontend-critic` both **0 blockers**; 2 cheap fixes applied (font-size input `key`, move-effect dep). Warnings (role=menu arrow-nav, pre-existing radiogroup+aria-pressed) documented for follow-up.
> - ⏳ **Live R1–R20 interactive sweep** — render-smoke (DDR-021) automatable; the in-canvas interactive click-through is the user's gate (OOPIF: agent-browser can't drive the cross-origin canvas iframe — established repo practice, see STATE A1-S3).

### Task 0: RESEARCH + DECIDE the cursor pack (license gate)

- **Do**: Evaluate Kenney Cursor Pack (CC0) vs Bibata (verify its actual licence) vs others. Confirm the pack covers: select/arrow, hand/grab, pen, crosshair (shape/draw), text I-beam, eraser, comment, sticky, (move). Confirm licence permits redistribution inside an MIT npm package + marketplace clone. Download the SVG sources for the chosen tool set into a scratch dir for re-authoring.
- **Gotcha**: CC0 needs no attribution; MIT needs a NOTICE; **GPL/AGPL is a hard BLOCKER**. If the visually-best pack is GPL, fall back to CC0 (Kenney) or author originals in that pack's style.
- **Output**: a one-paragraph decision (pack + licence + which glyphs map to which tool) captured for the DDR (Task 12).
- **Validate**: licence file read + recorded; glyph coverage table complete.

### Task 1: EXTEND the schema types (no behaviour yet)

- **Do**: In `annotations-layer.tsx` types block (`54-203`): add `PolygonStroke { id; tool:'polygon'; shape:'diamond'|'triangle'|'triangle-down'; color; width; x; y; w; h; fill?; dashed? }`; add to the `Stroke` union. Widen `ArrowStroke.startHead/endHead` to the 6-value enum + add `lineType?: 'straight'|'curved'|'elbow'`. Add `bold?`, `strike?`, `align?` to `TextStroke` + `StickyStroke`. Add a `Thickness`-independent note that shapes carry width.
- **Pattern**: mirror the existing optional-field + JSDoc-default comments (`71-99`).
- **Gotcha**: keep every new field **optional** so existing constructors compile.
- **Validate**: `bun run tsc --noEmit` — zero new errors (DDR-026 baseline only).

### Task 2: SERIALIZE + PARSE the new fields (byte-identical back-compat)

- **Do**: Extend `strokeToSvgEl` (`247-329`) + `svgToStrokes` (`357-485`):
  - polygon → `<polygon data-id data-tool="polygon" data-shape="..." stroke width fill points="...">` (compute points from x/y/w/h). Parse back into x/y/w/h via the points' bbox + `data-shape`.
  - arrow heads: write `data-start-head`/`data-end-head` only when ≠ default; extend the parser to read all 6 values; `data-line-type` only when ≠ `straight`.
  - text/sticky: `data-bold="1"` / `data-strike="1"` / `data-align="left|right"` only when ≠ default (anchored default centre; standalone/sticky default left).
- **Pattern**: the non-default-only block at `305-328` + `442-446`.
- **Gotcha**: anchored-text default align stays centre (current behaviour); standalone/sticky default left. Pick the default that makes the legacy form emit byte-identical (anchored currently emits `text-anchor="middle"` → keep).
- **Validate**: `bun test test/annotations-roundtrip.test.ts` green; the Phase-20 canary unchanged; ADD `test/fixtures/phase-21-annotations.svg` + assert it round-trips identically with all-default new fields.

### Task 3: GEOMETRY plumbing for polygon + new arrows

- **Do**: Add `polygon` cases to: `strokeHitTest` (`504-571` — point-in-polygon or bbox+edge), `strokeBBox` (`605-665` — x/y/w/h), `translateOne` (`885-898`), `normalizeBox` usage in draw (polygon flips like rect), `isStrokeMeaningful` (`594-603` — w≥4 && h≥4). In `use-annotation-resize.tsx`: add polygon to `isResizable` (`63-73`) + `resizeStroke` (reuse the rect bbox math `87-101`) + `handlePositions` (rect-style 4 corners). For curved/elbow arrows, add a `arrowShaftPath(stroke)` helper returning the `d`/points for the shaft + a `tangentAtEnd()` so heads orient correctly.
- **Gotcha**: curved arrow = quadratic bézier with a perpendicular-offset midpoint control; elbow = orthogonal segments (H-then-V or V-then-H by dominant axis). Head orientation uses the tangent at the endpoint, not the straight `(x1,y1)->(x2,y2)` angle.
- **Validate**: `bun test test/annotations-layer.test.ts` (add polygon bbox/hit-test + arrow-tangent cases) green.

### Task 4: SHAPE tool — palette consolidation + draw dispatch

- **Do**:
  - `input-router.tsx`: add `'shape'` to the `Tool` union + `ANNOTATION_TOOLS`; map key `r` → `shape` (drop `o`→ellipse, or repoint `o` to shape too); keep `rect`/`ellipse` in the union as valid stroke-tool values (they're still produced as strokes).
  - `use-tool-mode.tsx`: add `shapeKind: 'square'|'rounded'|'circle'|'diamond'|'triangle'|'triangle-down'` state + `setShapeKind`; default `square`. Replace `rect`+`ellipse` rows in `DEFAULT_TOOLS` with one `shape` row (label "Shape", shortcut "R").
  - `tool-palette.tsx`: render ONE Shape button; clicking selects the tool, a small caret/long-press opens a popover (reuse zoom-popover pattern) with the 6 shape-kind icons. `DRAW_TOOLS` becomes `['pen','shape','sticky','arrow','text','eraser']`.
  - `annotations-layer.tsx` `beginStroke` (`1222-1327`): when `tool==='shape'`, branch on `shapeKind` → create `rect` (square/rounded w/ cornerRadius), `ellipse` (circle), or `polygon` (diamond/triangle/triangle-down). `moveStroke`/`endStroke` handle the produced stroke type (rect/ellipse already covered; add polygon = rect-like w/h update + normalize). `supportsThickness`/`supportsFill`/`isDraw` include `shape`.
- **Pattern**: existing rect branch `1248-1259`; the `sticky.locked` flip logic `1399-1403`.
- **Gotcha**: `O` key + the standalone ellipse button disappear — update `input-router.test.ts` + `use-tool-mode.test.tsx` accordingly. The active-tool→stroke-tool indirection is the crux: don't conflate `tool==='shape'` with `stroke.tool`.
- **Validate**: `bun test` green; live: pick Shape, switch kinds, draw each of the 6.

### Task 5: STICKY polish — 1:1, dim palette, left/top text, drop corner+stroke

- **Do**:
  - 1:1: default 200×200 (`STICKY_DEFAULT_W=STICKY_DEFAULT_H=200`); in `moveStroke` sticky branch (`1356-1358`) constrain to a square (`const side = Math.max(Math.abs(w),Math.abs(h))` preserving drag direction); in `use-annotation-resize.tsx` add a sticky-only square constraint (corner drag sets w=h). Default-tap path stays square.
  - Dim palette: replace `STICKY_PALETTE` (`196-203`) with ~10 muted FigJam tints (white, light grey, salmon, peach, light yellow, mint, aqua, light blue, lavender, light pink); slot 0 = the default.
  - Text align left/top: change `.dc-sticky-body` CSS (`837-855`) to `align-items:flex-start; justify-content:flex-start; text-align:left` and the `StickyEditor` contentEditable to match (`2236-2256`).
  - Drop corner switch: remove sticky from `caps.cornerRadius` (`annotations-context-toolbar.tsx:272` — `allRectOrSticky` → rect only). Sticky keeps fixed soft radius.
  - **Fix the sticky-colour bug**: the context toolbar must show `STICKY_PALETTE` (dim tints) for sticky selections, not `STROKE_PALETTE` ink (`annotations-context-toolbar.tsx:476-480`). Add a sticky branch.
- **Gotcha**: sticky has no stroke/fill mode toggle — its colour IS the paper tint. Don't show the Stroke|Fill segmented control for sticky.
- **Validate**: `bun test`; live: drag a sticky → stays square; resize → stays square; recolor from dim palette; text sits top-left; no corner chips.

### Task 6: ARROWS — full head set + line-type, picker UI

- **Do**:
  - Render: in `StrokeNode` arrow branch (`2605-2631`) replace the two triangle polylines with a `renderArrowhead(kind, tip, tangent, color, width)` switch covering line/triangle/triangle-outline/circle/diamond/none; use `arrowShaftPath` (Task 3) for the line element so curved/elbow render.
  - Context toolbar: replace the 4 fixed direction buttons (`632-676`) with two small **per-end dropdowns** (start head / end head, 6 options each) + a **line-type** dropdown (straight/curved/elbow). Keep the dash toggle.
  - Draw-time tray: add an arrowhead + line-type quick-pick to `AnnotationsChrome` when `tool==='arrow'` so new arrows inherit the last choice (store defaults in `use-tool-mode.tsx` or local layer state alongside `color`/`thickness`).
- **Pattern**: dropdown = the zoom-popover pattern; head-orientation = tangent-based.
- **Gotcha**: **elbow routing is the riskiest** — if it threatens the timebox, ship straight+curved, gate elbow behind a follow-up and note it in the DDR (do NOT half-ship a broken elbow). Heads must stay px-constant under zoom (`vector-effect`-equivalent: heads are filled polylines in world coords scaled by width, already the pattern).
- **Validate**: `bun test` (head serialize/parse + tangent); live: every head combo + curved; elbow if shipped.

### Task 7: TEXT — size presets + numeric + bold/strike/align (standalone, anchored, sticky)

- **Do**:
  - Define presets `Small=12, Medium=16, Large=24, Extra large=36, Huge=64` (tune to taste; keep 14 working for legacy). Replace the S/M/L chips (`annotations-context-toolbar.tsx:562-596`) with a **font-size dropdown** (named presets + a numeric `<input>` for arbitrary px) — reuse the FigJam Image #6 layout.
  - Add **Bold** + **Strikethrough** toggle buttons + an **alignment** control (left/center/right) to the text capability block; `caps.fontSize` already gates text+sticky — extend it to also gate bold/strike/align.
  - Apply across: standalone text, anchored text, sticky body (the controls already operate per-selected-stroke).
  - Render: `bold` → `fontWeight:700`; `strike` → `textDecoration:'line-through'`; `align` → `textAnchor` + x for SVG text, `text-align` for sticky/foreignObject. Update `StrokeNode` text branch (`2478-2523`), the sticky `.dc-sticky-body`, and all three editors (`TextEditor`/`StickyEditor`/`StandaloneTextEditor`) to reflect bold/strike/align while editing.
- **Gotcha**: anchored-text default align = centre (keep byte-identical); standalone/sticky default = left. Numeric input must clamp to a sane range (e.g. 8–200) and debounce into the store.
- **Validate**: `bun test` (text attr round-trip); live: set Huge + bold + strike + right-align on a standalone text, an anchored text, and a sticky; reload persists.

### Task 8: GHOST placeholder preview

- **Do**: When a draw tool is armed (`shape`/`sticky`/`text`) and nothing is being drawn, track the cursor over the input overlay (`AnnotationsInput` `onPointerMove` when `!drawing`) and render a low-opacity preview in the SVG layer: shape/sticky → a default-sized ghost outline at the cursor; text → a faint I-beam/caret. Clear on pointer-leave, tool change, or draw start. Respect `prefers-reduced-motion` (no animation; static ghost is fine).
- **Pattern**: the existing `drawing` preview already renders via `renderStrokes` (`1423-1426`); add a parallel `ghost` state that renders with reduced opacity and `pointer-events:none`.
- **Gotcha**: ghost must NOT be selectable, hit-testable, persisted, or part of `commitStrokes`. It's pure chrome. Don't let it leak into the marquee/erase hit-test loops.
- **Validate**: live: arm Shape → translucent square follows cursor; arm Sticky → ghost note; click → ghost becomes the real stroke; switch to Move → ghost gone.

### Task 9: CURSORS — re-author canvas-cursors.ts with the chosen pack

- **Do**: Replace the hand-authored cursor SVGs in `canvas-cursors.ts` with the Task-0 pack's glyphs, normalized to the existing contract: ≤32×32, white-outline halo for light/dark legibility, correct per-tool hotspot, native fallback. Map: move/select, hand, pen, shape (crosshair-or-shape), eraser, sticky, text, comment. Add the `shape` key to `TOOL_CURSORS` (it's a new tool). Add a licence/attribution comment block (CC0 → note "public domain, no attribution required"; MIT → embed NOTICE).
- **Gotcha**: `Tool` now includes `shape` and no longer needs a separate ellipse cursor — keep `rect`/`ellipse` keys only if they remain in the union; `TOOL_CURSORS: Record<Tool, string>` must stay exhaustive or tsc breaks.
- **Validate**: `bun test test/canvas-cursors.test.ts` (data-URI validity + every Tool has a cursor); live: hover each tool, confirm the unified look.

### Task 10: CHROME consolidation pass + a11y

- **Do**: Reconcile the draw-time tray (`AnnotationsChrome`) and the per-selection context toolbar so the new controls (shape-kind, arrowhead/line-type dropdowns, text size dropdown + bold/strike/align, sticky dim palette) read as ONE visual system (dark `#26262b` bar, 20px circular swatches, 26px icon buttons, 1px separators). Ensure every new control has `aria-label` + `aria-pressed`/`aria-expanded`, keyboard reach, and `:focus-visible`. Dropdowns get `role="menu"`/`role="listbox"` + Escape-to-close + outside-click-close.
- **Validate**: spawn `a11y-auditor`; manual keyboard pass over both toolbars.

### Task 11: TESTS — round-trip, classify, geometry, cursor, back-compat canary

- **Do**: Extend the four test files: polygon serialize/parse + bbox + hit-test; arrowhead 6-value + line-type round-trip; text/sticky bold/strike/align round-trip; sticky 1:1 constraint; `classify` `r→shape` (+ removed `o→ellipse`); cursor exhaustiveness incl. `shape`; **the two byte-identical canaries** (phase-20 + new phase-21 fixture). Target: net-positive test count, zero new failures.
- **Validate**: `bun test --bail` full suite green (modulo any pre-existing unrelated fail — record it).

### Task 12: BUILD + bundle commit + DDR + doc sweep

- **Do**:
  - `cd plugins/design/dev-server && bun run build.ts` → rebuild + commit `dist/client.bundle.js` + `dist/comment-mount.js` (NOT `dist/runtime/*`).
  - Write the DDR(s): shape-tool data model + arrowhead vocabulary + cursor-pack licence (and elbow-deferral if applicable). Check the highest existing DDR number first.
  - Add a "Phase 24 follow-up" cross-link to the archived Phase 21 plan.
  - Run `pnpm --filter @maude/site gen:roadmap` after STATE/plan moves and include the `site/lib/roadmap.json` diff (CLAUDE.md rule).
- **Validate**: `check-runtime-bundles.sh` passes (runtime untouched); `runtime-health` green.

---

## Validation

Run these to confirm zero regressions:

1. **Types**: `cd plugins/design/dev-server && bun run tsc --noEmit` — zero new errors (DDR-026 baseline only).
2. **Tests**: `cd plugins/design/dev-server && bun test --bail` — full suite green; both byte-identical canaries pass.
3. **Build**: `bun run build.ts` — `dist/client.bundle.js` + `comment-mount.js` produced + committed; `check-runtime-bundles.sh` green.
4. **`/design:smoke`** (DDR-021 gate) — batch-screenshot every UI canvas + specimen; 0 blank/error overlays.
5. **Per-feature agent-browser regression sweep** — boot the LOCAL `server.ts` against a scratch `.design/` and verify **every R1–R20 row** in the Regression Inventory PLUS each new behaviour (ghost, shape switcher, square sticky, dim palette, left/top text, full arrowheads, curved arrow, text presets/bold/strike/align, cursors). This is the load-bearing gate — the bar is 100% no regressions.
6. **A11y**: spawn `a11y-auditor` — focus on the new dropdowns, the shape popover, sticky/ text editors, and keyboard reach across both toolbars.
7. **Manual back-compat**: load a real pre-Phase-24 `.design/_history/*/annotations*.svg`, save without mutating, `diff` — must be byte-identical; then load → mutate one stroke → confirm only that stroke's element changes.
8. **`design:critic` (graphic + a11y)** on a canvas exercising the new chrome — graphic blockers fixed, a11y 0 blockers (mirrors Phase 21's close-out).

`design-system-guard` is **N/A** — dev-server internal chrome, no project DS applies (confirmed Phase 21). Cross-platform scenario (`scenario-runner`) — **web-desktop only**; ios/ipad/android skip is justified (annotation tooling is mouse + keyboard).

---

## Scenario Coverage (UI — required)

**Existing scenario:** `canvas-figjam-feel` — extend (or add `canvas-annotations-v2`) with:

- Pick Shape (R) → open switcher → draw diamond, triangle, triangle-down, square, rounded, circle → each persists with the right `data-shape`/cornerRadius.
- Pick Sticky → drag → note stays **square**; type → text sits **top-left**; recolor from the **dim** palette; resize → stays square; **no corner chips** appear.
- Pick Arrow → set end head = circle, start head = diamond, line-type = curved → renders; toggle dash; reload persists.
- Pick Text → set size = Huge, Bold on, Strikethrough on, align right → renders + persists; repeat inside a shape (anchored) and a sticky.
- Arm Shape/Sticky → **ghost** preview follows the cursor; click commits; switch to Move → ghost gone.
- Hover each tool → unified **cursor** from the new pack.
- Load a legacy `.annotations.svg` → byte-identical round-trip.

`/done` runs `scenario-runner` (web-desktop required; native skip justified).

---

## Acceptance Criteria

- [ ] All tasks 0–12 completed
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `bun test` green — both byte-identical canaries (phase-20 + new phase-21) pass; net-positive test count
- [ ] `bun run tsc --noEmit` clean (DDR-026 baseline only; zero new)
- [ ] `dist/client.bundle.js` + `comment-mount.js` rebuilt + committed; runtime bundles untouched; `check-runtime-bundles.sh` green
- [ ] **Every R1–R20 regression row re-verified live via agent-browser — 0 regressions**
- [ ] All 6 new behaviours verified live (ghost, shape switcher, square+dim+left/top sticky, full arrowheads + curved, text presets/bold/strike/align, unified cursors)
- [ ] Legacy `.annotations.svg` round-trips byte-identical (manual diff + canary)
- [ ] `a11y-auditor`: 0 blockers on the new chrome
- [ ] `design:critic` (graphic + a11y): graphic blockers fixed, a11y 0 blockers
- [ ] Cursor pack licence verified redistributable (CC0/MIT); GPL avoided; licence/attribution recorded
- [ ] DDR(s) written (shape model + arrowheads + cursor licence; elbow-deferral if applicable); Phase 21 plan cross-linked; `site/lib/roadmap.json` regenerated
- [ ] No DDR-worthy decision left unrecorded; code follows the file's existing conventions
