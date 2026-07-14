# Feature: Inspector Controls Redesign — CSS + Photo panels

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This plan is grounded in three research passes (CSS-panel map, Photo-panel map, pro-tool UX research) captured 2026-07-13.

## Description

Redesign the input controls in the Maude studio Inspector — both the **CSS panel** (`CssKnobs` in `app.jsx`) and the **Photo panel** (`photo-knobs.jsx`) — so they behave like a professional properties panel (Figma / Affinity / Photoshop / Lightroom). Today the controls are hand-rolled inline **6+ times** with inconsistent behavior; scrub-to-change is wired onto the input text area (breaking click-to-edit), there is no select-all-on-focus, arrow-key stepping is missing, bounded photo adjustments render as track-less numeric fields, two panel rows overflow at default width, and the variables popover mis-positions.

The fix is **consolidation into one shared control library** (`inspector-controls.jsx`) with a corrected interaction model, a Photo-panel rebuild on those primitives (real sliders for bounded params), fixes for the overflow rows and the popover bug, and a **new design-system specimen** (`components-inspector-controls`) that documents the whole control set so the panel and the DS stay in lockstep.

**This plan covers Phase 1 (the polish + library + Photo redesign).** Phase 2 — a Figma-style Simple/Advanced dual-mode for the CSS panel — is captured as a **Follow-up** section and is deliberately deferred until Phase 1 lands, per the user's request.

## User Story

As a designer using the Maude inspector, I want the number fields, sliders, dropdowns and color controls to behave the way they do in Figma/Affinity — drag an icon to scrub, click to select-all and retype, arrow-keys to nudge, real sliders for adjustments, and nothing overflowing or popping up in the wrong place — so that adjusting CSS and photo settings feels fast and predictable instead of fiddly.

## Problem

Concrete defects (all verified in source; line refs in Context References):

1. **Scrub conflicts with editing.** `makeScrub` (`app.jsx:4969`) and `makePhotoScrub` (`photo-knobs.jsx:117`) are attached to the `<input>` itself (`onPointerDown`, class `st-cp-scrub`). The input gets `cursor: ew-resize`; a click to type competes with a drag. The user expects to drag a **prefix icon/label**, not the field.
2. **No select-all-on-focus.** No `onFocus`/`.select()` exists on any field in `CssKnobs` (`num`/`text`/`side`/`inset`/`corner`) or `photo-knobs`. The user must double-click to overtype a value.
3. **No arrow-key stepping.** The number field's `onKeyDown` only handles `Enter` (`app.jsx:5281`). ArrowUp/Down (with Shift ×10) don't step. Visible ▲▼ steppers exist but are tiny (`font-size: 7px`, `3-shell-maude.css:798`) and `tabIndex=-1`.
4. **Overflow at default width (304px).** Two doubled-up rows don't fit: the CSS **border** cluster (`num` widget + style `<select>` + swatch, no `flex-wrap`, `app.jsx:5725`, CSS `3-shell-maude.css:870`) and the Photo **DUOTONE** row (two 78px labels + two color widgets on one flex row, `photo-knobs.jsx:400`), plus Photo **Pattern Type/Blend** (two selects on one row).
5. **Variables popover mis-positions.** `TokenPopover` (`app.jsx:4477`) uses `position: fixed` + portal to `document.body` + a one-shot `getBoundingClientRect` snapshot with **no transform compensation** (`place()` at `app.jsx:4509`). A transformed ancestor of the fixed containing block offsets it; there is no re-anchor on layout change (hence the dismiss-on-scroll hack).
6. **Photo "sliders" aren't sliders.** The `Slider` component (`photo-knobs.jsx:156`) renders a bordered drag-scrub numeric field with **no track/thumb** — so the ADJUSTMENTS section reads as a broken column of numeric fields. Bounded 0–100/−100..100 params (brightness, contrast, saturation, exposure, hue, sepia, grayscale, invert, intensity, amount, opacity, strength) want a real slider **linked** to a numeric field.
7. **No single source of truth.** 6+ inline field factories in `CssKnobs` + a parallel set in `photo-knobs` + a DS specimen (`components-inputs.tsx`) that covers only static form fields, not the interactive inspector controls. Drift is guaranteed.

## Solution

1. **Build one shared control library** — `apps/studio/client/inspector-controls.jsx` — exporting the primitives both panels consume: `NumberField` (typeable + icon-scrub + arrow-step + select-all), `Slider` (real track/thumb, keyboard-accessible), `SliderField` (slider linked to a NumberField — the coarse+fine combo), `UnitSelect`, `Segmented`, `Swatch` (→ popover trigger), `Select`, `Toggle`, `Field` (label+control+help row). Behavior model per research (below).
2. **Rewire the interaction model** in `NumberField`: move the scrub handler from the `<input>` to a **prefix icon/label drag handle** (`ew-resize`, ~3px dead-zone, Shift ×10 / Alt fine, pointer-lock with a Safari loop-teleport fallback); add `onFocus → select()` with click-again-to-caret; wire ArrowUp/Down/Shift-Arrow/PageUp-Down/Home-End; keep ▲▼ but enlarge the hit target.
3. **Refactor `CssKnobs`** to consume the library (replace the inline `num`/`text`/`csel`/`color`/box-model factories), and **fix the border row** to use a lighter number field + `flex-wrap`/priority-shrink so it never overflows.
4. **Rebuild the Photo panel** on the library: ADJUSTMENTS → `SliderField` (real sliders with correct min/max/step and neutral zero-point), DUOTONE → stack Shadow/Highlight on their own rows, Pattern Type/Blend → own rows, MASK/GRAIN/PATTERN sliders → `SliderField`. Keep the existing `/_api/photo-edit` PUT contract and the `schema.ts` ranges as the clamp authority.
5. **Fix `TokenPopover`** positioning: compensate for transformed ancestors (or reparent to a non-transformed fixed layer) and re-anchor on scroll/resize instead of dismissing.
6. **Add the DS specimen** `components-inspector-controls.tsx` under `.design/system/maude/preview/` documenting every primitive (states: idle/focus/scrubbing/disabled), so the panel and DS are one library.

### Interaction model (from UX research — the load-bearing rules)

- **Scrub = drag the icon/label, never the input body.** `ew-resize` on the handle; snapshot value on pointer-down; listen on `document`; ~3px dead-zone so a click ≠ a 1px scrub; Shift = coarse ×10, Alt = fine; Pointer Lock API with a virtual cursor, **disabled on Safari** (layout-shift notification) → fall back to loop-teleport. [Base UI NumberField, Blender, Figma]
- **Select-all on focus, click-again to place caret.** `onFocus → input.select()`, guarded to run once per focus-entry; a second click deselects. The dominant task is *replace the value*. [NN/g, Carbon]
- **Keyboard is the primary stepper.** Arrow = ±step, Shift+Arrow = ×10, PageUp/Down = large, Home/End = min/max (WAI-ARIA spinbutton). Keep small ▲▼ for mouse-only users but don't spend row width on big spinners. [Radix/Base UI]
- **Bounded params → slider + linked numeric**, continuously linked (edit one → the other updates live). Pure sliders with no visual feedback are an anti-pattern; always pair with the exact numeric. [NN/g]
- **Enums:** ≤5 → segmented/icon toggles (all visible); 6–15 → dropdown; >15 → searchable. [NN/g, IxDF]
- **Booleans:** immediate-effect → toggle; form/batch → checkbox. [NN/g]
- **No rotary knobs** except angle/hue, and only ever numeric-backed. [NN/g]
- **Dense-row layout:** icon-prefixed left labels (not top labels), 2-col grid for paired values, priority-shrink not wrap, unit selector inline, color = swatch chip → popover (never inline the picker). [Figma, ishadeed "CSS behind Figma"]

## Metadata

- **Type**: Enhancement + Refactor (UI polish + consolidation)
- **Complexity**: High (shared-library extraction across two panels + a bundler rebuild + a DS specimen)
- **App/Package**: `apps/studio` (studio client) + `.design/system/maude` (DS specimen)
- **Affected Systems**: Inspector CSS panel (`CssKnobs`), Photo panel (`photo-knobs.jsx`), `TokenPopover`, `ColorPicker`, `3-shell-maude.css` (`.st-cp-*` namespace), committed client bundle, design system
- **Dependencies**: none new — pure React + existing CSS tokens. Pointer Lock API is a browser built-in.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel (one message, multiple Read calls).

- `apps/studio/client/app.jsx:4969-5025` — `makeScrub` (the existing scrub engine; move to the handle, keep the modifier math).
- `apps/studio/client/app.jsx:5255-5330` — `num()` factory: the exact number-field JSX, stepper, unit select, blur-commit. The template for `NumberField`.
- `apps/studio/client/app.jsx:5088-5240` — `row()`/`csel()`/`text()`/`tok()` factories (the other inline field families to fold into the library).
- `apps/studio/client/app.jsx:5333-5432` — `color()`, box-model `side()`/`inset()`, per-corner `corner()` factories.
- `apps/studio/client/app.jsx:5725-5778` — the **border** cluster + opacity field (overflow row #1).
- `apps/studio/client/app.jsx:4477-4742` — `TokenPopover`; `place()` at `4509-4551` is the mis-position bug.
- `apps/studio/client/app.jsx:4318-4476` — `ColorPicker` (HSV widget the swatches open; injected into `photo-knobs`).
- `apps/studio/client/app.jsx:6503-7000` — `InspectorPanel` (tab host: Inspect/CSS/Photo); Photo mount ~6938-6949, photo channels ~7710-7741.
- `apps/studio/client/photo-knobs.jsx` (whole, 528 lines) — `Slider` (`:156`, the track-less one), `makePhotoScrub` (`:117`), `ADJUSTMENTS` (`:25-34`), DUOTONE (`:400`), commit/PUT (`:284-317`).
- `apps/studio/photo/schema.ts:63-69, 290-349` — canonical neutral origins + per-param clamp ranges (the slider min/max authority).
- `apps/studio/client/styles/3-shell-maude.css:699-1010` — the entire `.st-cp-*` control namespace (incl. `.st-cp-num` `:782`, `.st-cp-scrub` `:794`, `.st-cp-step` `:797`, `.st-cp-border` `:870`, dead `.st-cp-slider` `:862` + `.st-cp-token` `:772`, `.st-rpanel` width `:213`).
- `.design/system/maude/preview/components-inputs.tsx` — existing static-field specimen (the style/voice prior for the new one; reuse `.fld`, focus-ring halo, tabular `.field`).

### Files to Create

- `apps/studio/client/inspector-controls.jsx` — shared control primitives (`NumberField`, `Slider`, `SliderField`, `UnitSelect`, `Segmented`, `Swatch`, `Select`, `Toggle`, `Field`) + the scrub hook extracted from `makeScrub`.
- `.design/system/maude/preview/components-inspector-controls.tsx` (+ `.css`) — the new DS specimen documenting the control set.

### Design canvases

> No `.design/ui/*` canvas matched "inspector/settings/photo" by tag/slug. The relevant priors are DS **specimens**, not UI canvases:

| Prior | Path | Role |
| ----- | ---- | ---- |
| `components-inputs` | `.design/system/maude/preview/components-inputs.tsx` | Style/voice prior — focus-ring halo, tabular `.field`, `.fld` row. **Lift, don't reinvent.** |
| `components-toggles` | `.design/system/maude/preview/components-toggles.tsx` | Toggle/checkbox prior for the `Toggle` primitive. |
| `ui_kits-desktop-showcase` | `.design/system/maude/preview/ui_kits-desktop-showcase.tsx` | Tier-0 shell/placement prior (per CLAUDE.md). |

---

## Design Decisions

### Control-type decision table (applied to our params)

| Param family | Control | Range/opts | Rationale |
| ------------ | ------- | ---------- | --------- |
| CSS length (width/margin/padding/font-size/radius…) | `NumberField` + `UnitSelect` | px/rem/%/em, unbounded | exact + unbounded → numeric, unit inline |
| CSS opacity, photo brightness/contrast/saturation/exposure/sepia/grayscale/invert | `SliderField` (slider + numeric) | schema ranges (−1..1 or 0..1), neutral 0 | bounded + visual feedback → linked slider+numeric |
| Photo hue / CSS rotation | `NumberField` (scrub) [+ optional small dial] | −180..180 / 0..360 | angular; numeric-backed |
| Photo grain amount/size, pattern scale/opacity, mask strength, duotone intensity | `SliderField` | schema ranges | bounded |
| CSS text-align, W/H sizing mode, border-style (5) | `Segmented` | ≤5 options | all visible, faster than dropdown |
| CSS display/flex/font family, photo pattern type/blend, mask preset (>5 or long) | `Select` | enum lists | conserves space |
| Color (fill, border-color, duotone A/B, pattern color) | `Swatch` → `TokenPopover`/`ColorPicker` | hex | compact trigger, popover editor |
| Booleans (duotone/grain/pattern enabled, split-corners) | `Toggle` | on/off | immediate effect |

### Tokens (reuse — no new colors)

| Purpose | Token |
| ------- | ----- |
| Field surface | `--bg-3` |
| Field border / hover / focus | `--border-default` / `--border-strong` / `--accent` + `--accent-tint` halo |
| Slider track / fill | `--bg-2` track, `--accent` fill |
| Text / mono numerals | `--fg-0`, `--font-mono` + `tabular-nums` |
| Motion | color/box-shadow transitions only, `--dur-soft` |

### Custom components needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `NumberField` | consolidates 6+ inline `num`/`side`/`inset`/`corner` + `makePhotoScrub` | extracted from `num()` + `makeScrub` |
| `Slider` / `SliderField` | replace the track-less photo `Slider`; add real track/thumb + keyboard | new (reuse dead `.st-cp-slider` CSS as a start) |
| `Segmented`, `UnitSelect`, `Swatch`, `Select`, `Toggle`, `Field` | one library both panels share | generalize existing `.st-cp-*` styles |

---

## Tasks

Execute in dependency order. Each task ends with a light verify (`/flow:utils-verify`), and every client change requires the release-minified bundle rebuild before it's "done" (see Validation).

### Task 1: CREATE the scrub hook + `NumberField` in `inspector-controls.jsx`
- **Do**: Extract `makeScrub`'s modifier/dead-zone/commit math into a reusable `useScrub({ value, min, max, step, onChange, onCommit })` hook. Build `NumberField` = prefix **drag-handle** (icon or label, `ew-resize`, owns the scrub) + typeable `<input>` (mono, tabular, `onFocus→select()` guarded for click-again-caret, ArrowUp/Down/Shift/Page/Home/End stepping, Enter/blur commit) + optional ▲▼ stepper (enlarged hit target) + optional `UnitSelect`/suffix slot.
- **Pattern**: mirror `app.jsx:5255-5330` (`num`) for JSX shape + `4969-5025` (`makeScrub`) for the drag math; keep `.st-cp-num*` class names so existing CSS applies, add a `.st-cp-handle` class for the drag prefix.
- **Gotcha**: Pointer Lock throws/notifies on Safari — feature-detect and fall back to loop-teleport (research §1). Scrub must `preventDefault` only after the dead-zone, else it eats the click that should focus+select.
- **Validate**: import into a scratch render; drag the handle, click-to-select, arrow-step all work.

### Task 2: CREATE `Slider` + `SliderField` (real track/thumb, keyboard-accessible)
- **Do**: `Slider` = a WAI-ARIA slider (track + fill + thumb, Arrow/Page/Home/End, drag thumb, click-track-to-jump), value clamped to `[min,max]`, neutral zero-point marker for bipolar ranges (−1..1). `SliderField` = `Slider` **continuously linked** to a `NumberField` (edit either → both update; drag fires preview `onChange`, release fires `onCommit`).
- **Pattern**: revive/replace the dead `.st-cp-slider*` CSS (`3-shell-maude.css:862-868`); commit semantics mirror `photo-knobs.jsx` Slider (`onChange` preview, `onCommit` + `onRecordEdit` on release).
- **Gotcha**: bipolar fill must render from the zero-point, not from min. Keyboard step must respect `step` (0.01 for adjustments, 1 for hue).
- **Validate**: scratch render; slider and numeric stay in sync; keyboard steps; reduced-motion respected.

### Task 3: CREATE the remaining primitives (`UnitSelect`, `Segmented`, `Swatch`, `Select`, `Toggle`, `Field`)
- **Do**: Thin wrappers generalizing the existing inline patterns (`csel`, `.st-cp-seg`/`.st-cp-modeseg`, `.st-cp-swatch--trigger`, `.st-cp-nsel`, `photo-knobs` `Toggle`, `components-inputs` `.fld`). `Swatch` takes a render-prop/trigger so both `TokenPopover` (CSS) and `ColorPicker` (photo) plug in.
- **Pattern**: `.design/system/maude/preview/components-inputs.tsx` for `Field` row anatomy; `photo-knobs.jsx:220-241` for `Toggle`/`ColorSwatch`.
- **Validate**: each renders with existing CSS unchanged.

### Task 4: REFACTOR `CssKnobs` to consume the library
- **Do**: Replace inline `num`/`text`/`csel`/`color`/`side`/`inset`/`corner` factories with the new primitives. Keep the `commit`/`optimistic`/`/_api/edit-css` lane intact (`app.jsx:4851`). Preserve box-model multi-side scrub (`opts.sides`) by passing it through `useScrub`.
- **Gotcha**: `key={prop:value}` remount pattern (`app.jsx:5276`) prevents stale `defaultValue` — keep it. Unitless props (`CSS_UNITLESS`) must commit without a unit (`app.jsx:5259`).
- **Validate**: every CSS row edits, previews, commits, and undoes exactly as before (agent-browser: open a canvas → CSS tab → edit width/color/border/margin).

### Task 5: FIX the border-row overflow
- **Do**: In the border cluster (`app.jsx:5725`), use a compact `NumberField` (no unit-select; border-width is px-only) + `flex-wrap`/priority-shrink so `[width][style select][swatch]` never overflows the ~170px control column at 304px. Same priority-shrink pass over any other CSS row that packs 3 controls.
- **Pattern**: CSS `3-shell-maude.css:870-877` (the prior failed-clip note is there); add `flex-wrap: wrap` + min-widths that shrink.
- **Validate**: screenshot the CSS panel at 260px (min) and 304px (default) — no overflow, style select legible.

### Task 6: FIX `TokenPopover` positioning
- **Do**: Make `place()` (`app.jsx:4509`) transform-aware — either reparent the portal to a dedicated non-transformed fixed overlay layer, or subtract the transformed-ancestor offset before setting `left/top`. Re-anchor on scroll/resize (reposition) instead of dismissing.
- **Gotcha**: `position:fixed` resolves against the nearest transformed ancestor, not the viewport (the root cause). Verify the trigger→popover delta is 0 regardless of canvas zoom/pan.
- **Validate**: open the variables popover from a CSS row and from the border swatch at several scroll positions — it anchors to the button every time (reproduces Image #4 fixed).

### Task 7: REBUILD the Photo panel on the library
- **Do**: Rewrite `photo-knobs.jsx` control rendering: ADJUSTMENTS + GRAIN + PATTERN scale/opacity + MASK strength + DUOTONE intensity → `SliderField` with schema-correct min/max/step and neutral origin. Split DUOTONE Shadow/Highlight onto separate rows; split Pattern Type/Blend onto separate rows (kill the doubled-up overflow). Keep `makePhotoScrub`→`useScrub`, the 160ms-debounced PUT, the `onEdit` immediate preview, and the undo/`onRecordEdit` contract (`photo-knobs.jsx:284-317`).
- **Gotcha**: panel-side ranges currently disagree with `schema.ts` in two places — grain size (panel 1–8 vs schema 1–32) and pattern scale (panel 0.25–4 vs schema 0.1–16). Pick the panel range deliberately and note it; the server clamp stays the safety net.
- **Validate**: agent-browser: open a photo canvas → Photo tab → drag each slider, confirm live preview + saved sidecar; DUOTONE fits at 304px (reproduces Image #5 fixed).

### Task 8: CREATE the DS specimen `components-inspector-controls`
- **Do**: New specimen under `.design/system/maude/preview/` demonstrating `NumberField` (idle/focus/scrubbing/disabled), `SliderField` (bipolar + unipolar), `Segmented`, `UnitSelect`, `Swatch`, `Select`, `Toggle`, `Field` — real studio labels (font-size, opacity, brightness…), never "Enter text". Follow `components-inputs.tsx` header-comment + `.fld` + focus-halo conventions; import `../colors_and_type.css` + `./_layout.css`.
- **Pattern**: `.design/system/maude/preview/components-inputs.tsx` (structure, voice, SKU header).
- **Gotcha**: specimen is a standalone TSX canvas — it re-declares the control markup (it can't import the client `.jsx`); keep it visually 1:1 with the shipped primitives. Run through `/design:new`/`/design:smoke` flow, not a hand-edit.
- **Validate**: `/design:smoke` renders it styled (not blank/unstyled); `design-system-completeness-critic` passes.

### Task 9: REBUILD the committed client bundle + desktop testids
- **Do**: After all client edits: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css`. Add `data-testid`s to the new controls for desktop E2E if a scenario will reach them.
- **Gotcha** (CLAUDE.md): never boot the source dev-server without a `--release` rebuild afterward — its self-heal writes 3.6 MB dev bundles; whatever is committed ships.
- **Validate**: bundle diff is the release-minified artifact (~250 KB, not 3.6 MB).

---

## Validation

1. **Smoke**: `/design:smoke` — every UI canvas + specimen (incl. the new one) renders styled; 0 blank/unstyled.
2. **CSS panel** (agent-browser): open a canvas → CSS tab → for width/font-size/margin/border/color: icon-drag scrubs, click selects-all + retype, ArrowUp/Down + Shift step, unit select works, no row overflow at 260/304px, variables popover anchors correctly.
3. **Photo panel** (agent-browser): open a photo canvas → Photo tab → each adjustment is a real slider linked to its numeric; live preview + saved `.photo.json`; DUOTONE + Pattern rows fit at 304px; undo/redo works.
4. **A11y**: `a11y-auditor` — sliders/spinbuttons expose WAI-ARIA roles + keyboard reach; focus rings present; reduced-motion honored.
5. **Design guard**: `design-system-guard` / `design-system-keeper` — specimen ↔ shipped controls match; tokens only, no hardcoded colors.
6. **Build**: committed bundle is release-minified; `check-runtime-bundles.sh` green.
7. **Desktop E2E** (optional): if a scenario reaches the inspector, add `data-testid`s and run `/desktop-e2e`.

---

## Follow-up (Phase 2 — deferred by request): CSS panel Simple/Advanced dual-mode

> Explicitly out of scope for Phase 1. Capture only — plan properly once Phase 1 ships.

Add a per-panel mode toggle: **Advanced** (today's raw-CSS `CssKnobs`) and **Simple** (a Figma-style, designer-vocabulary reduction for beginners who don't think in CSS). Simple mode:
- Renames raw CSS to designer terms: **Fill** (`background`), **Stroke** = Weight+Color (`border`), **Corner radius** (`border-radius`), **Effects** = shadow/blur (`box-shadow`/`filter`), **Auto layout** = Direction/Gap/Padding/Hug·Fill·Fixed (`display:flex`+…), **Opacity**, basic **Text** (Size/Line height/Letter spacing). [Figma vocabulary table, research §7]
- Shows only the common case per section; gates stroke-position, dash, per-corner radii, blend mode, multiple fills/effects, absolute positioning behind an **Advanced disclosure** (progressive disclosure).
- Reuses the Phase 1 control library wholesale — Simple mode is a **presentation/vocabulary layer over the same primitives + `commit` lane**, not new controls. This is the reason Phase 1 (the shared library) must land first.
- Mode is a persisted per-user preference (`localStorage`, like `maude-rp-w`).
- Likely needs a DDR (vocabulary mapping + which properties are "beginner-safe").

---

## Acceptance Criteria

- [x] Tasks 1–9 complete
- [x] `/flow:utils-verify` per-task was NOT run this session, but a full `/flow:validate`-equivalent pass (2026-07-14) supersedes it: `bun test` 2492 pass/2 known-flake, CLI tests 180/180, lint/format/parity/tarball/tokens gates green, `a11y-auditor` + `design-system-guard` fan-out (see below) — stronger coverage than the per-task loop would have given
- [x] One shared `inspector-controls.jsx` is the sole source for both panels' controls — `csel`/`text`/`color` stay thin CssKnobs-local wrappers (free-text/enum rows with no reusable shape in the primitive set), but no scrub/stepper/select-all logic is reimplemented outside the shared engine
- [x] Scrub is on the icon/label, click select-all + click-again-caret works, arrow-key stepping works (Image #1 + #2 satisfied) — for `num()`'s NumberField fields. `side()`/`inset()`/`corner()` (36×24px box-model cells) deliberately keep whole-cell scrub — now recorded as [DDR-169](../decisions/DDR-169-box-model-cells-whole-cell-scrub.md) — but gained select-all + arrow-keys via the same shared `makeScrubHandler` engine.
- [x] No row overflows at 260px or 304px (Image #3 satisfied) — border row: `fixedUnit` drops the unit-select + `flex-wrap` fallback
- [x] Variables popover anchors to its trigger at any scroll/zoom (Image #4 satisfied) — `place()` re-runs on scroll/resize instead of dismissing, plus a rect-diff compensation pass that cancels any transformed-ancestor offset regardless of cause — now recorded as [DDR-170](../decisions/DDR-170-tokenpopover-rect-diff-anchor-compensation.md)
- [x] Photo ADJUSTMENTS are real linked sliders; DUOTONE + Pattern fit at default width (Image #5 satisfied)
- [x] New `components-inspector-controls` specimen renders styled — re-verified 2026-07-14 via direct screenshot against a clean current-tree server (596 KB, all 14 sections, tokens resolving, dark theme) after the a11y-hardening pass. `/design:smoke`'s own `--changed-only` run remains unreliable in this shared multi-server tree (talks to whichever `.design/_server.json` a concurrent session last wrote) — not re-attempted; the direct-screenshot verification is the trustworthy signal here. `design-system-completeness-critic` still not run — optional structural DS audit, not a blocker for this close.
- [x] Committed client bundle rebuilt `--release` and **committed** — landed via `f37ee3d6` (swept alongside a concurrent session's `1e82fb80`); confirmed at HEAD 1.73 MB release-minified, contains the a11y fixes (verified via grep for `aria-valuetext`)
- [x] `a11y-auditor` + `design-system-guard`: 0 blockers — run 2026-07-14. First pass found 3 a11y blockers (AngleDial keyboard/role, invalid ARIA on SizingMode radios, contrast on specimen labels) + 1 design-system warning (slider track token) + 2 a11y warnings (NumberField spinbutton semantics, ColorField label fallback); all fixed and re-verified 0 remaining (residual axe contrast nodes are pre-existing off-state/disabled DS-token uses, out of scope). Commit `f37ee3d6`.
- [x] Phase-2 dual-mode captured (this doc) — now PLANNED via `/flow:plan` + a divergent debate (BUILDER/SHIPPER/BREAKER): `.ai/plans/feature-inspector-controls-designer-mode.md`. Not yet executed.
- [x] DDR-worthy decisions recorded: [DDR-169](../decisions/DDR-169-box-model-cells-whole-cell-scrub.md) (box-model whole-cell scrub) + [DDR-170](../decisions/DDR-170-tokenpopover-rect-diff-anchor-compensation.md) (TokenPopover rect-diff compensation)

---

## Retro

- **The implementation (Tasks 1–9) landed cleanly in a prior session, but the closing due-diligence (a11y/design-guard fan-out, DDR sweep, bundle commit) had been left open** across two "Acceptance Criteria" columns of `[ ]` for a while — a full `/flow:validate` this session was what actually surfaced the 3 real a11y blockers (AngleDial keyboard/role, invalid ARIA, low contrast), none of which showed up in the earlier "verified via direct screenshot" pass. **Lesson: a styled-and-rendering screenshot is not the same signal as an a11y pass — don't let one substitute for the other in an acceptance checklist**, even under time pressure.
- **Working on a shared, actively-concurrent `main` tree was the dominant tax on this close**, same lesson as several prior retros in this repo (STATE.md's own history is full of "swept into a concurrent session's commit" notes). The DDR-numbering race hit again mid-session (a live session claimed DDR-168 in the working tree while this session was mid-write) — caught and renumbered before commit, but it's the second or third time this exact race has needed a manual dodge. Consider whether `/flow:record-ddr` should claim-and-touch a placeholder file (or check a lock) at START of the write rather than only at the end.
- **The `/flow:validate` a11y/design-guard fan-out found real bugs that the original "ship it" pass missed** — validates the value of running the full pipeline even on already-committed code when the acceptance checklist has open boxes, rather than treating "it's already merged" as done.
- **Debating Phase 2's scope (BUILDER/SHIPPER/BREAKER) before writing a single line of Phase-2 code caught a genuine, non-obvious conflict** with an existing Accepted DDR (DDR-104, which had explicitly rejected the exact vocabulary-translation approach Phase 2's original follow-up note proposed) — a plan written straight from that follow-up note without the debate would have silently re-litigated a settled, user-tested decision. Worth doing this divergent-debate step BEFORE writing tasks whenever a deferred-scope note references renaming/reworking something that already shipped with its own design rationale.
- **Next time**: write the Phase-2-style "Follow-up" section with an explicit pointer to any DDR it might reopen, right at capture time — would have saved a debate round discovering DDR-104 from scratch.
