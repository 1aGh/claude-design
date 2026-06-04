# Feature: Annotation tooling polish — text unification, theme-aware ink, dashed shapes, highlighter

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This is a **dev-server** change to the FigJam-style annotation system — the standing rule applies: **inventory + per-feature plan first, verify every feature via agent-browser, 100 % no regressions** (memory `feedback_no_break_exhaustive_verify`).

## Description

A batch of 8 user-reported polish items + 2 net-new features for the canvas annotation tooling (`plugins/design/dev-server/`). The work spans default-value behaviour (theme-aware ink, shape fill), a per-shape control gap (dashed stroke), a sticky-corner visual, a genuine **bug** (multi-line text renders broken), a **feature** (italic / underline / ordered + unordered lists, unifying the text-formatting surface across text / sticky / shape-anchored text), and a **new tool** (FigJam-style highlighter next to the pen).

## User Story

As someone annotating a canvas, I want text to behave consistently and render correctly across sticky notes, shapes, and the text tool — with the formatting controls I expect (size, bold, italic, underline, strike, align, lists) — and I want tool defaults (ink colour, shape fill, dashed strokes, a highlighter) to match FigJam, so that marking up a mock feels finished, not janky.

## Problem

- **Newline bug (item 4, root cause found):** text strokes render `stroke.text` inside a single SVG `<text>` (`annotations-layer.tsx:3423` anchored, `:3443` standalone; serialized at `:506` / `:519`). SVG `<text>` **ignores `\n`** — multi-line text collapses / overlaps (the screenshot). The standalone editor (`:3164`) commits on plain Enter, so multi-line standalone text can't even be authored; the anchored editor (`:2983`) uses `display:flex; align-items:center`, which lays multi-line content out as row flex-items → the mangled look.
- **Missing formatting (item 4):** italic, underline, ordered/unordered lists do not exist in the model or the context toolbar (only bold / strike / align — `annotations-context-toolbar.tsx:549-582`).
- **Default ink is a constant (items 3/5/6):** `DEFAULT_COLOR = STROKE_PALETTE[8] = '#1f1f1f'` (`annotations-layer.tsx:285`) for every ink tool (pen / shape / arrow / text). It never tracks the canvas theme, so the default reads as near-invisible black on a dark canvas.
- **Shapes default to no fill (item 2):** `const [fill, setFill] = useState<string|null>(null)` (`annotations-layer.tsx:1553`) → new shapes are outline-only.
- **Shapes can't be dashed (item 7):** `dashed` exists on arrow + polygon, but **not** rect/ellipse, and the context-toolbar dash control (`:1075`) is gated `caps.dash = allArrow`.
- **Sticky corners are uniform (item 1):** sticky renders `<rect rx ry>` with one radius on all four corners (`annotations-layer.tsx:3457`).
- **No highlighter (item 8):** there is no highlighter tool.

## Solution

Nine implementation tasks in dependency order (foundational/low-risk first, the two big features last), each with its own agent-browser verification. **The load-bearing invariant throughout: the byte-identical round-trip canary** (`test/annotations-roundtrip.test.ts:41`) must stay green — every new serialized field/attribute is emitted **only for non-default values** (the existing "Phase 24 — serialize ONLY for non-default values" pattern, `annotations-layer.tsx:498`), and single-line text must serialize byte-identically (no `<tspan>` wrapping unless `\n` is present).

## Metadata

- **Type**: Enhancement + Bug Fix + New Capability (mixed batch)
- **Complexity**: High (multi-file, new tool, new text-model fields, a render bug, back-compat-sensitive serialization)
- **App/Package**: `plugins/design/dev-server` (single package)
- **Affected Systems**: canvas annotation layer, context toolbar, tool palette, tool-mode store, icon set, cursor set, input-router Tool union, SVG round-trip serializer + sanitizer + tests
- **Dependencies**: none new (zero-dep dev-server invariant holds)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel (one message, multiple Read calls).

- `plugins/design/dev-server/annotations-layer.tsx` — the core. Key regions:
  - `:85-247` — Stroke type union (PenStroke / RectStroke / EllipseStroke / PolygonStroke / ArrowStroke / TextStroke / StickyStroke). New optional fields land here.
  - `:268-326` — `STROKE_PALETTE`, `DEFAULT_COLOR`, `FILL_PALETTE`, `STICKY_PALETTE`, `DEFAULT_STICKY_COLOR`.
  - `:493-552` — `strokeToSvgEl` (serialize). Text + sticky branches; "serialize-only-non-default" pattern.
  - `:729-940` — `svgToStrokes` (parse). Per-tool reconstruction.
  - `:1541-1610` — `AnnotationsLayer` state: `color` / `fill` / `thickness` / `stickyColor`; `supportsThickness` / `supportsFill` / `ghostCapable` / `isDraw`.
  - `:1955-2010` — draw-start: where `setDrawing({...})` creates the new stroke from `color` / `activeFill` / `width` / `shapeKind`.
  - `:2955-3174` — the three editors: anchored text (`:2972` flex-center bug), `StickyEditor` (`:3022`), `StandaloneTextEditor` (`:3081`, Enter-commits-bug at `:3164`).
  - `:3294` `stickyBodyStyle`, `:3369` `StrokeNode` (live render; text `:3386`, sticky `:3447`).
  - `:3671-3788` — `AnnotationsChrome` (draw-time marker tray; sticky-palette branch `:3698`, ink branch `:3718`, fill `:3734`, thickness `:3761`).
- `plugins/design/dev-server/annotations-context-toolbar.tsx` — per-selection toolbar. `caps` intersection `:421-458`; setters `:507-635`; render `:889-1100`. Bold/strike/align live here — italic/underline/list buttons + dash-for-shapes go here.
- `plugins/design/dev-server/canvas-icons.tsx` — icon set (`Svg` wrapper `:15`; `TOOL_ICONS` `:419`; `SHAPE_KIND_ICONS` `:435`). Add IconHighlighter, IconItalic, IconUnderline, IconListBullet, IconListOrdered.
- `plugins/design/dev-server/canvas-cursors.ts` — `TOOL_CURSORS` `:138` (frozen). Add a highlighter cursor; `resolveToolCursor` `:169` auto-covers it via the allowlist.
- `plugins/design/dev-server/use-tool-mode.tsx` — `DEFAULT_TOOLS` `:50`, `ToolDescriptor`, `isDraw` semantics. Register highlighter.
- `plugins/design/dev-server/tool-palette.tsx` — `DRAW_TOOLS` `:232`; add highlighter next to `pen`.
- `plugins/design/dev-server/input-router.tsx` — the `Tool` union (imported across the above). **Add `'highlighter'`.** Confirm the draw-mode gate(s) include it.
- `plugins/design/dev-server/api.ts` — `sanitizeAnnotationSvg`. Confirm new attributes/elements survive (pen already serializes as a path/polyline, so `<path>`/`<tspan>` are likely already allowlisted — verify).
- `plugins/design/dev-server/canvas-lib.tsx` — `useResolvedTheme()` (`:2308`, re-resolves on `data-theme` mutation) + `useTheme()` (`:2336`). The theme signal for items 3/5/6. **Verify the export name** before importing.

### Patterns to Follow

- **Serialize-only-non-default** (protects the canary), `annotations-layer.tsx:498-501`:
  ```ts
  const weight = s.bold ? ' font-weight="700"' : '';
  const deco = s.strike ? ' text-decoration="line-through"' : '';
  ```
- **Capability intersection across selection**, `annotations-context-toolbar.tsx:434-457` (`allArrow`, `allFillable`, `fontSizeApplicable`).
- **Setter fan-out over selection**, `annotations-context-toolbar.tsx:550-560` (`setBold` → mirror for `setItalic` / `setUnderline` / `setListType`).
- **Draw-time palette branch by tool**, `annotations-layer.tsx:3698` (sticky shows `STICKY_PALETTE`) — mirror for highlighter showing a `HIGHLIGHTER_PALETTE`.
- **Test patterns**: `test/annotations-layer.test.ts` (write side, DOM-free), `test/annotations-roundtrip.test.ts` (parse side, registers happy-dom; **the byte-identical canary lives here** `:41`).

### Files to Create

- `plugins/design/dev-server/test/annotations-text-format.test.ts` — round-trip + render-contract tests for newline tspans, italic/underline/list serialization (each only-when-set), and the back-compat canary for new fields.
- (Optional) a frozen fixture under `test/fixtures/` if a new serialized shape is introduced (only if Item 1 / highlighter change the persisted form — see decisions).

---

## Design Decisions

> Record these as DDRs during `/flow:done` (or `/flow:record-ddr` mid-flight). Each is a real fork.

### DDR-worthy

1. **Item 1 — sticky sharp bottom-right: live-render-only.** Change `StrokeNode`'s sticky body from `<rect rx ry>` to a `<path>` with TL/TR/BL rounded at `cornerRadius` and **BR sharp**. **Keep the persisted form (`strokeToSvgEl`) as `<rect>`** → zero canary/sanitizer/parse impact. Rationale: every interactive view (incl. after reload) re-renders through `StrokeNode`, so the sharp corner shows everywhere a user sees it. The only uniform-corner case is a raw persisted-SVG opened without the React renderer (sanitizer fallback) and possibly `.svg` export-via-`strokesToSvg`. **Recommendation: ship live-only; flag SVG-export fidelity as a known minor gap + optional follow-up** (full parity would require `<path>` body + `data-x/y/w/h` on the `<g>` + parse rework + a new frozen fixture — not worth the canary risk now).
2. **Item 8 — highlighter as a `PenStroke` flag, not a new stroke type.** Add `highlighter?: boolean` to `PenStroke` and reuse all pen draw/erase/hit-test/translate logic. The `'highlighter'` *tool* maps to a `pen` stroke with `highlighter:true`, a wide width, a translucent colour, and `mix-blend-mode:multiply` at render. Cheaper + lower-regression than a parallel stroke type. Serialize via `data-highlighter="1"` (only when true).
3. **Item 4c — lists render as per-line prefixes, raw text stored.** `listType?: 'bullet' | 'number'`. The stored `text` has **no** markers; `StrokeNode` + `strokeToSvgEl` + the editors' display prepend `• ` / `N. ` per line at render time. Avoids polluting the stored string and keeps contentEditable editing sane.
4. **Items 3/5/6 — theme-aware *live default* ink only.** `DEFAULT_COLOR` stays `#1f1f1f` as the **parse fallback** (`:740`) — parsing must not depend on live theme (determinism + back-compat). Only the live draw default (`color` state) follows `useResolvedTheme()` **while untouched**; once the user clicks a swatch, it sticks. Stored strokes keep their literal hex (FigJam parity — no retroactive recolour).

### Icons (canvas-icons.tsx, single-stroke 24-viewBox `currentColor`)

| Icon | Glyph hint | Used by |
| --- | --- | --- |
| `IconHighlighter` | marker/highlighter pen (chisel tip) | tool palette + `TOOL_ICONS.highlighter` |
| `IconItalic` | slanted "I" / serif italic bar | context toolbar |
| `IconUnderline` | "U" + underline rule | context toolbar |
| `IconListBullet` | 3 dots + 3 lines | context toolbar |
| `IconListOrdered` | "1. 2. 3." + 3 lines | context toolbar |

### Tokens / palettes

| Purpose | Value |
| --- | --- |
| Default ink (light) | `STROKE_PALETTE[8]` = `#1f1f1f` |
| Default ink (dark) | new light-ink constant, e.g. `#ededed` (the ink swatch renders white-ish in dark mode so the active default reads true) |
| Default shape fill | `defaultFillFor(color, theme)` — index-paired `FILL_PALETTE` entry for coloured ink; neutral (`#e7e7e7` light / dark-grey `#2a2a2a` dark) for the ink slot. "No fill" remains one click away. |
| Highlighter palette | small translucent marker set (yellow default, green, pink, blue) — `HIGHLIGHTER_PALETTE` |

---

## Tasks

Execute in order. After **each** task: `pnpm format && pnpm lint`, `cd plugins/design/dev-server && bun test`, then the task's agent-browser smoke. Do not batch the verification — the standing rule is per-feature proof.

### Task 1: ADD theme-aware default ink (items 3, 5, 6)

- **Do**:
  - Add `resolveDefaultInk(theme: 'light' | 'dark'): string` near `DEFAULT_COLOR` (`annotations-layer.tsx:285`) → `light: '#1f1f1f'`, `dark: '#ededed'`.
  - In `AnnotationsLayer`, read `const theme = useResolvedTheme()` (import from `canvas-lib.tsx` — verify export name). Track `colorTouchedRef` (set true in the chrome's `setColor` onClick path). In a `useEffect([theme])`, if `!colorTouchedRef.current`, `setColor(resolveDefaultInk(theme))`. Initialize `color` state from `resolveDefaultInk(theme)`.
  - In `AnnotationsChrome` (`:3718`), render the **ink swatch (slot 8)** background as `resolveDefaultInk(theme)` so the active default reads true on dark canvases (pass `theme` down or compute the displayed swatch list with the themed ink). Other swatches unchanged.
  - Ghost preview (`:2216`) + text editors already read `color` → inherit automatically (verify the standalone/anchored editor `color` prop traces back to the `color` state for *new* text).
- **Pattern**: theme hook `canvas-lib.tsx:2308`; sticky-vs-ink palette branch `:3698`.
- **Gotcha**: do NOT change `DEFAULT_COLOR` usage at the parse fallback (`:740`) or the round-trip canary breaks. Stored strokes keep literal hex — no retroactive recolour.
- **Validate**: `bun test`; agent-browser — light canvas: pen/arrow/text default reads dark; toggle `data-theme=dark`: a freshly-armed pen/arrow/text default reads light; after manually picking blue, theme toggle must NOT override it.

### Task 2: UPDATE shape default to include fill (item 2)

- **Do**: add `defaultFillFor(color: string, theme): string | null`. Change the `fill` state default (`:1553`) so a freshly-armed Shape tool has a fill (not `null`). Simplest: when the Shape tool becomes active and fill is untouched, set `fill` to `defaultFillFor(color, theme)`. Keep the "No fill" swatch (`:3738`) working. Existing shapes parse unchanged (`null` stays `null`).
- **Pattern**: `supportsFill`/`activeFill` at `:1606`/`:1964`.
- **Gotcha**: fill must still be **omitted from serialization when `null`** (back-compat). Only NEW shapes get a default fill; don't retro-fill parsed shapes.
- **Validate**: agent-browser — draw a square/circle/diamond: each lands with a visible fill; "No fill" still produces outline-only; existing canvas reload shows no fill drift on old shapes.

### Task 3: ADD dashed stroke to shapes (item 7)

- **Do**:
  - Add `dashed?: boolean` to `RectStroke` (`:92`) and `EllipseStroke` (`:105`). `PolygonStroke` already has it (`:134`).
  - Serialize `dashed` for rect/ellipse (and confirm polygon) — emit a `data-dashed="1"` attr / `stroke-dasharray` **only when true** (mirror the arrow dashed serialization — find it near the arrow branch in `strokeToSvgEl`/parse).
  - Parse it back for rect/ellipse (`svgToStrokes`).
  - Render dashed in `StrokeNode` for rect/ellipse/polygon (mirror arrow's `stroke-dasharray`).
  - Context toolbar: extend `caps.dash` (`:456`) to `allArrow || allShapes` where `allShapes = every rect|ellipse|polygon`; extend `setDashed` (`:625`) + `uniqDashed` (`:863`) to cover rect/ellipse/polygon. `IconDash` + the toggle already exist (`:1075`).
- **Pattern**: arrow `dashed` end-to-end (type `:151` → serialize → parse → render → toolbar).
- **Gotcha**: byte-identical canary — non-dashed shapes must serialize exactly as today.
- **Validate**: agent-browser — select a rect/circle/diamond → Dash toggle appears → toggling renders a dashed outline → reload preserves it; arrow dash still works.

### Task 4: REFACTOR sticky bottom-right corner sharp (item 1)

- **Do**: add `stickyCornerPath(x, y, w, h, r): string` returning a `d` with TL/TR/BL rounded at `r`, **BR a square corner**. In `StrokeNode`'s sticky branch (`:3457`), replace the `<rect rx ry>` with `<path d={stickyCornerPath(...)} fill stroke filter />` (keep the shadow filter + hairline stroke). Selection halo / resize / hit-test stay bbox-based (unchanged).
- **Pattern**: existing rounded-rect math; `StrokeNode` sticky render `:3447`.
- **Gotcha**: per DDR-1, **do NOT change `strokeToSvgEl`** (persisted stays `<rect>`) → no canary/sanitizer/parse impact. Note the `.svg`-export fidelity gap in the PR.
- **Validate**: agent-browser — drop a sticky: TL/TR/BL rounded, BR sharp; reload keeps the look; resize keeps proportions; shadow/edge intact.

### Task 5: FIX multi-line text rendering + editor UX (item 4a — the bug)

- **Do**:
  - Add `splitTextLines(text)` and render **one `<tspan x={tx} dy=…>` per line** in `StrokeNode` text branches (`:3409` anchored, `:3429` standalone) and in `strokeToSvgEl` (`:506`/`:519`). First line `dy=0`/baseline, subsequent `dy = fontSize * lineHeight` (≈1.25). **If `text` has no `\n`, emit exactly the legacy single-line form** (no tspan) — protects the canary.
  - Vertical placement: anchored text is vertically centred in its host → offset the block start by `-(lineCount-1)/2 * lineHeight` so multi-line stays centred; standalone is `dominant-baseline="hanging"` top-anchored → lines flow downward.
  - **StandaloneTextEditor** (`:3158`): Enter should insert a newline, not commit. Commit on blur / outside-click (already wired `:3122`) / Cmd-Enter; cancel on Esc. Change `whiteSpace:'pre'` → `pre-wrap` and drop the single-line assumption; widen/auto-grow height.
  - **Anchored text editor** (`:2980`): replace `display:flex; align-items:center` with a layout that supports multi-line vertical centring (`flexDirection:column; justifyContent:center` + per-line `textAlign`), so typed lines stack correctly.
- **Pattern**: sticky already multi-lines correctly via `foreignObject` + `white-space:pre-wrap` (`:1446`/`:3471`) — match its behaviour for text.
- **Gotcha**: the canary (`test/annotations-roundtrip.test.ts:41`) + single-line byte-identity. Newlines must survive `esc()` + parse round-trip (XML text content preserves `\n`; verify `svgToStrokes` reads tspans back into a `\n`-joined string).
- **Validate**: agent-browser — text tool, type 3 lines with Enter: renders 3 stacked lines (matches the editor); reload preserves it; anchored text in a shape multi-lines + stays centred; single-line text unchanged. Add the new test file's newline round-trip case.

### Task 6: ADD italic + underline (item 4b)

- **Do**: add `italic?` + `underline?` to `TextStroke` (`:155`) + `StickyStroke` (`:181`). Serialize only-when-true (`font-style="italic"`; combine decorations: `text-decoration` = join of `line-through` (strike) + `underline`). Parse back. Render in `StrokeNode` (text + sticky), `stickyBodyStyle` (`:3294`), and all three editors (mirror the existing `bold`/`strike` style props).
- **Pattern**: bold/strike end-to-end (`:170-173`, serialize `:500`, render `:3392`, editor `:2993`).
- **Gotcha**: decoration is now multi-valued — don't clobber strike when adding underline.
- **Validate**: agent-browser — toggle italic + underline on text and sticky (independently and combined with bold/strike); reload preserves; single-line legacy text unchanged.

### Task 7: ADD ordered + unordered lists (item 4c)

- **Do**: add `listType?: 'bullet' | 'number'` to `TextStroke` + `StickyStroke`. Per DDR-3, store raw text; at render (StrokeNode tspans + sticky body + serialize + editor display) prepend `• ` (bullet) or `${i+1}. ` (number) per line. Serialize `data-list="bullet|number"` only-when-set; parse back. Depends on Task 5 (per-line rendering).
- **Pattern**: per-line tspan loop from Task 5; sticky body `white-space:pre-wrap`.
- **Gotcha**: markers are presentation-only — never persisted into `text`. Canary: no `data-list` attr when unset.
- **Validate**: agent-browser — toggle bullet then numbered list on a multi-line text + sticky; markers render per line; reload preserves; switching list type re-numbers.

### Task 8: ADD italic/underline/list controls to the context toolbar (item 4d — unify)

- **Do**: in `annotations-context-toolbar.tsx`, under the existing `caps.fontSize` block (`:969`), add: Italic button, Underline button, and a list control (two toggle buttons: bullet / numbered, mutually exclusive, click-again clears). Add `setItalic` / `setUnderline` / `setListType` (mirror `setBold` `:550`) and `uniqItalic` / `uniqUnderline` / `uniqListType` (mirror `uniqBold` `:811`). Import the new icons. Confirm the controls show for **text + sticky + shape-anchored text** (anchored text is a `'text'` stroke → already covered by `fontSizeApplicable`).
- **Pattern**: `setBold`/`uniqBold`/the Bold button trio.
- **Gotcha**: keep the toolbar from overflowing — group the 3 text-style toggles; consider a single list dropdown (reuse `IconDropdown` `:1111`) if width is tight.
- **Validate**: agent-browser — select text, sticky, and a shape-with-text: the SAME formatting row (size/bold/italic/underline/strike/align/list) appears and mutates the selection; mixed multi-select shows neutral states.

### Task 9: ADD highlighter tool (item 8)

- **Do**:
  - `input-router.tsx`: add `'highlighter'` to the `Tool` union; ensure draw-mode gates include it.
  - `use-tool-mode.tsx`: add a `ToolDescriptor` in `DEFAULT_TOOLS` (`:50`) — `{ id:'highlighter', label:'Highlighter', shortcut:<free key, e.g. 'I'>, cursor: TOOL_CURSORS.highlighter }`.
  - `canvas-cursors.ts`: add a `HIGHLIGHTER` cursor (marker glyph, same dark-ink + white-halo treatment) and register in `TOOL_CURSORS` (`:138`). `resolveToolCursor` auto-allows it.
  - `canvas-icons.tsx`: add `IconHighlighter` + register in `TOOL_ICONS` (`:419`).
  - `tool-palette.tsx`: add `'highlighter'` to `DRAW_TOOLS` (`:232`) right after `'pen'`.
  - `annotations-layer.tsx`: add `highlighter?: boolean` to `PenStroke` (`:85`). When `tool === 'highlighter'`, draw-start (`:1965`) creates a `pen` stroke with `highlighter:true`, a wide default width (e.g. 16), and a translucent marker colour. Define `HIGHLIGHTER_PALETTE` + a `highlighterColor` state; `AnnotationsChrome` shows it when `tool==='highlighter'` (mirror the sticky branch `:3698`). Add `'highlighter'` to `isDraw` (`:1598`) and to `ghostCapable`/`supports*` as appropriate. Render: highlighter pen uses `strokeOpacity ~0.4`, `mixBlendMode:'multiply'`, round caps, wide width (in `StrokeNode` pen branch). Serialize `data-highlighter="1"` + width/colour only-when-true; parse back.
- **Pattern**: pen end-to-end + sticky-palette chrome branch + the existing tool registration trail (use-tool-mode → tool-palette → icons → cursors).
- **Gotcha**: the canary — a normal pen must serialize byte-identically (no `data-highlighter` when false). The `Tool` union is referenced in several files — grep for exhaustiveness (switch statements) after adding the member.
- **Validate**: agent-browser — highlighter appears next to pen; drawing yields a translucent wide stroke; overlapping strokes darken (multiply); colour palette switches marker hue; reload preserves; pen still draws solid; cursor shows the marker glyph.

### Task 10: TESTS + full regression sweep

- **Do**: write `test/annotations-text-format.test.ts` — newline tspan round-trip, italic/underline/list/dashed/highlighter each serialize-only-when-set, and **byte-identical canary holds** for a single-line / unstyled / non-dashed / non-highlighter fixture. Re-run the existing `annotations-roundtrip` + `annotations-layer` + `tool-palette` + `use-tool-mode` tests.
- **Validate**: full `bun test` green (≥ the current count; CLAUDE.md cites 1163 dev-server tests) + the gates below.

---

## Validation

Run from repo root unless noted. Confirm zero regressions:

1. **Format**: `pnpm format`
2. **Lint**: `pnpm lint` (`biome check .`)
3. **Tests**: `cd plugins/design/dev-server && bun test` (the annotation suite + the round-trip canary). Root `pnpm test` (CLI) is unaffected.
4. **Typecheck**: `cd plugins/design/dev-server && bun tsc --noEmit` (modulo the DDR-026 `api.ts`/`runtime-bundle.ts` baseline — don't regress beyond it).
5. **Build the canvas runtime**: `cd plugins/design/dev-server && bun run build.ts` then `bash bin/check-runtime-bundles.sh` — the annotation layer ships in a runtime bundle; the bundle must rebuild clean and pass the per-slug size floor (`.min-sizes.json`).
6. **Live per-feature smoke (the standing rule)**: boot the dev-server against a scratch `.design/`, open a canvas, and drive **each** of the 8 items via `agent-browser` (web-desktop + web-mobile), capturing a screenshot per item. Toggle `data-theme` light↔dark for items 3/5/6. 0 regressions required.
7. **A11y**: the new toolbar buttons + highlighter need `aria-label` / `aria-pressed` parity with the existing ones; run `a11y-auditor` over the canvas chrome (axe-core via agent-browser).
8. **Manual edge cases**: empty text node abandoned (no orphan stroke); multi-select mixed types (controls intersect correctly); a pre-existing canvas from before this change loads with **no visual drift** (load→save→diff should be empty for untouched strokes).

---

## Scenario Coverage

> The dev-server uses `bun:test`, not the flow `.ai/scenarios/` harness. The cross-platform backbone here is the **agent-browser per-feature smoke** in Validation step 6 (the project's own `feedback_no_break_exhaustive_verify` rule), plus `/design:smoke` (batch-screenshots every UI canvas + preview specimen, flags blanks/errors/unstyled).

- Run `/design:smoke` after Task 10 — catches "build green ≠ user-visible green" regressions across the whole canvas surface.
- Capture a before/after screenshot set for the 8 items and link in the PR.

---

## Acceptance Criteria

- [ ] All 9 implementation tasks complete; Task 10 tests added + green.
- [ ] `pnpm format` + `pnpm lint` clean.
- [ ] `bun test` (dev-server) green, **incl. the byte-identical round-trip canary** (`annotations-roundtrip.test.ts:41`).
- [ ] `bun tsc --noEmit` no worse than the DDR-026 baseline.
- [ ] `bun run build.ts` + `check-runtime-bundles.sh` pass.
- [ ] agent-browser per-feature smoke: each of the 8 items demonstrably works, light + dark, web-desktop + web-mobile, **0 regressions** (pen still solid, single-line text byte-identical, old canvases load with no drift).
- [ ] `a11y-auditor`: 0 blockers on the new chrome.
- [ ] `/design:smoke`: no blank/errored/unstyled canvas.
- [ ] DDRs recorded for the 4 forks above.
- [ ] Before/after screenshots linked in the PR.

---

## Risks

- **Back-compat canary** is the dominant risk: 6 of 9 tasks touch serialization. Mitigation — every new field/attr emits only-when-non-default; single-line text stays byte-identical; add explicit canary cases in Task 10.
- **Newline fix (Task 5)** is the trickiest correctness work (tspan dy math + editor UX + parse round-trip of `\n`). Verify the parse side reconstructs `\n`-joined text.
- **Tool union exhaustiveness (Task 9)**: adding `'highlighter'` may surface non-exhaustive switches across files — grep + tsc after.
- **Runtime bundle**: whatever is committed in `dist/runtime/*.js` is what ships — rebuild + size-floor check before declaring done.
- **Toolbar overflow (Task 8)**: 3 new text toggles may crowd the context bar — fall back to a list dropdown if width is tight.

## Confidence

**7.5 / 10** for one-pass implementation. Tasks 1–4, 6, 7 are well-bounded and mirror existing end-to-end patterns. Tasks 5 (newline + editor UX) and 9 (new tool + Tool-union ripple) carry the residual uncertainty; the per-feature agent-browser gate is what converts that into confidence rather than hope.

---

## Retro

- **Worked well:** The 10-task plan structure + per-task agent-browser gate held. Root-cause-first approach before each task (reading key code regions in the first message) paid off — the theme-aware ink bug was caught because we traced `data-maude-theme` vs `data-theme` explicitly. Folding Tasks 5/6/7 (tspan + italic + lists) into one code pass avoided 3× re-editing the same serialize/parse sites.

- **Missed on first pass (user caught):** Three issues after initial smoke: (a) theme-ink read the wrong attribute (`useTheme`→`data-theme` vs `data-maude-theme`), (b) highlighter used the same Kenney cursor as pen, (c) list markers disappeared during editing (editor showed raw text while editing, markers re-appeared on unfocus). All three were legitimate regressions from gaps in the per-feature interactive smoke — the automated tests can't catch "wrong attribute" or "visual flicker during editing."

- **Cursor iteration:** Two extra rounds of user feedback on cursor glyphs (pointer_b_shaded → pointer_b; rot180 → flipV/TR→BL). The initial cursor design wasn't validated against the user's expectation before implementation. Better approach: show a contact-sheet of proposed glyphs with hotspot dots *before* implementing, get sign-off, then code.

- **What to improve in /plan:** The plan's `useResolvedTheme()` reference was wrong (the hook doesn't exist). Plans should be validated against the actual export names in the codebase before finalizing. Add a "verify hook/API names" step to the plan template.

- **Testing gap covered:** Added `annotations-text-format.test.ts` (26 cases) + the editor-marker helpers (`listPrefixedBody`/`stripEditorMarkers`) are exported and tested. Future: consider an integration test that mounts an editor component and simulates Cmd+B to catch the "shortcuts do nothing" regression class.
