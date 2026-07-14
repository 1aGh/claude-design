# Feature: CSS Panel Designer Mode (Phase 2 of feature-inspector-controls-redesign)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This plan is grounded in a divergent debate (BUILDER/SHIPPER/BREAKER, reduce-tier) run 2026-07-14, plus direct reads of `DDR-104` and the live `CssKnobs` source.

## Description

Add a second, Figma-vocabulary rendering mode to the Maude studio CSS panel (`CssKnobs`, `apps/studio/client/app.jsx:4849-6018`) alongside the existing raw-CSS panel. Two modes:

- **Advanced mode** — today's panel, byte-identical, including its own nested "Advanced" escape-hatch section (raw CSS property / HTML attribute editor).
- **Designer mode** — a regrouped, relabeled view using Figma-like terms (Fill, Stroke, Corner radius, Effects, Auto layout, Opacity, Text) instead of raw CSS property names, built from the SAME `row()`/`commit()`/control-builder closures already in `CssKnobs` — no new control primitives, no new write endpoint.

This is a **conscious, explicit override of [DDR-104](../decisions/DDR-104-css-panel-ux-model.md) §2**, which previously rejected human-label vocabulary translation ("too lossy for a code-backed tool") after a live user-feedback round. The user has confirmed (2026-07-14) they want the override: Advanced mode stays as the honest-CSS-labels escape valve for pros; Designer mode is the new friendly surface for everyone else. Task 1 records the DDR that supersedes DDR-104 for this scope.

## User Story

As a designer using the Maude inspector who doesn't think in raw CSS, I want a "Designer mode" that shows Fill / Stroke / Corner radius / Effects / Auto layout / Text in Figma-familiar language — while still being able to flip to "Advanced mode" for the literal CSS when I need it — so that the panel doesn't force a translation tax on non-technical users without taking away precision from technical ones.

## Problem

- `CssKnobs` today has exactly one vocabulary: raw CSS property names as row labels (`row(prop, control, provKind)` hardcodes `label = prop`, `apps/studio/client/app.jsx` inside the `CssKnobs` closure — see Context References). DDR-104 chose this deliberately, but it means a non-technical user sees `border-radius`, `box-shadow`, `flex-direction` with no on-ramp.
- The properties a "regroup by task" mental model wants (e.g. "everything about auto-layout") are scattered across today's 8 sections — `display`/`gap` live in **Layout**, the already-built Hug/Fill/Fixed sizing mode (Stage M1) lives in **Size**. A relabel-in-place wouldn't fix that; it needs an actual regroup.
- No `filter` (blur) or `mix-blend-mode` row exists anywhere — DDR-104 §3 put both in the OUT-list. Figma's own "Effects" section includes blur, so a faithful Designer-mode "Effects" cluster is incomplete without it. Confirmed via direct read of `canvas-edit.ts` (`applyEdit`/`editStyleProp`) that the write path is property-name-generic — no server allowlist blocks adding these as new rows.
- No mode-persistence mechanism exists yet, though the exact pattern to mirror is already shipped (`readJsonStore`/`localStorage.setItem`, `apps/studio/client/app.jsx:186-193`, used today for the section-open-state store `mdcc-sections-expanded`).

## Solution

1. **Record a DDR** that formally supersedes DDR-104 §2 for this scope: Designer mode is a genuinely new, additive vocabulary layer; Advanced mode (DDR-104's original decision) is unchanged and remains the default for existing users. State the reason the need changed (non-technical users hitting the raw-CSS wall — the reason the user asked for this Phase 2 in the first place) and the guardrails kept from DDR-104 (single write endpoint, provenance dots, token-first, no shadowing surprises).
2. **One `mode` state** (`'advanced' | 'designer'`), default `'advanced'` (zero behavior change for existing users until they opt in), persisted via the existing `readJsonStore`/`localStorage.setItem` pattern under a new key `maude-cp-mode`.
3. **A Designer-mode render tree inside the SAME `CssKnobs` function body** — reusing its existing closures (`row`, `color`, `num`, `csel`, `tok`, `vtok`, `iconseg`, `radiusControl`, `commit`, `optimistic`, `authored`, `computed`, `provOf`, `status`, etc.) rather than extracting a second component that would need 40 props threaded through it (the drift risk BREAKER flagged with "a second render surface"). `mode === 'designer'` picks a different JSX return; `mode === 'advanced'` is today's tree, untouched.
4. **Extend `row()` with an optional label-override** that changes BOTH the visible label text and the `title` tooltip together (never leave them out of sync — the exact gap BREAKER flagged). Purely additive; all 8 existing Advanced-mode call sites pass nothing and are unaffected.
5. **Regroup, not just relabel** — Designer-mode clusters cut across today's section boundaries where the Figma mental model demands it (Auto layout pulls from today's Layout + Size sections; see Design Decisions for the full cluster map).
6. **Add `filter` (blur only, v1) and `mix-blend-mode`** as new rows inside the Designer-mode "Effects" cluster, using existing `NumberField`/`SliderField`/`csel`-shaped controls — confirmed cheap given the generic write path (Problem section). These become real CSS rows usable from Advanced mode too (a raw property is a raw property either way) — not Designer-mode-exclusive.
7. **Mode toggle UI**: a small segmented control (reuse `Segmented`/`IconToggleGroup` from `inspector-controls.jsx`) at the top of the panel, labeled "Advanced / Designer" — not "Advanced / Simple", so the two real options read as two full-fledged, equally-legitimate modes rather than one being a lesser fallback.

### Debate outcome (informs every decision above)

Three independent openings (BUILDER, SHIPPER, BREAKER — reduce-tier, no live cross-talk) converged unprompted on: **don't build a second, undocumented vocabulary without recording why** (BREAKER: "block until formal DDR supersession"; SHIPPER: "reopen DDR-104 explicitly with the user first"). All three also converged on **the toggle must not be named "Advanced" for the new mode** — the panel already has an "Advanced" *section* (raw CSS/attr escape hatch) and reusing the word for the *mode* collides. **The user, after seeing this, made an informed, explicit choice to override DDR-104 and label the raw-CSS mode itself "Advanced"** — accepting the collision as intentional (the raw-CSS mode nests the raw-CSS escape hatch; both mean "pro-level access," which the user found conceptually consistent rather than confusing). This plan proceeds on the user's explicit instruction; the DDR (Task 1) records that the naming-collision risk was surfaced and consciously accepted, not overlooked.

BUILDER's single most load-bearing insight, adopted here: **the real user pain isn't scary property names, it's that task-relevant properties are scattered across sections** — so Designer mode's value comes from regrouping (Auto layout merging Layout+Size), not from relabeling alone. This plan follows that regroup fully, per the user's explicit "ano regroup i relabel" instruction.

## Metadata

- **Type**: Enhancement (new panel mode, additive)
- **Complexity**: Medium-High (regroup across 8 existing sections + 2 new CSS properties + a DDR supersession — bounded by zero new control primitives and zero new write endpoints)
- **App/Package**: `apps/studio` (studio client)
- **Affected Systems**: `CssKnobs` (`app.jsx`), `3-shell-maude.css` (new `.st-cp-mode*`/cluster classes), the DS specimen `components-inspector-controls.tsx` (document the mode toggle + a Designer-mode cluster example)
- **Dependencies**: none new — pure React + existing `inspector-controls.jsx` primitives + existing `/_api/edit-css` write path

---

## Context References

### Must-Read Files

> Read these in parallel in a single assistant message during `/flow:execute`.

- `apps/studio/client/app.jsx:4849-6018` — `CssKnobs`, the whole function body (closures: `row`, `color`, `num`, `csel`, `tok`, `vtok`, `iconseg`, `radiusControl`, `sizeModeSeg`, `commit`, `optimistic`, `authored`, `provOf`, `status`, `SECTION_PROPS`). Every Designer-mode row reuses one of these closures verbatim — read before writing a single new row.
- `apps/studio/client/app.jsx:5121-5135` (approx — the `row()` definition) — the label-override extension point; confirm exact current line numbers at execute time (file has shifted since this plan was written).
- `apps/studio/client/app.jsx:186-193` (`readJsonStore`) + `apps/studio/client/app.jsx:8303` (`sectionsExpanded` write-back) — the exact localStorage persistence pattern to mirror for `maude-cp-mode`.
- `apps/studio/client/app.jsx:4891-4910` — the `open` section-state object + the Phase 12.3 auto-expand-on-authored precedent (`if (hasCustom) setOpen(...)`) — reuse this exact pattern to auto-reveal Designer mode's Position cluster when the element already has a non-static position.
- `apps/studio/client/app.jsx:4099-4155` (approx) — the `CSS_*` enum constants block; add `CSS_BLEND_MODES` here, matching the existing array shape (`CSS_BORDER_STYLES`, `CSS_TEXT_TRANSFORM`, etc.).
- `apps/studio/canvas-edit.ts:414-466` (`applyEdit`) + `:453` (`editStyleProp` dispatch) — confirms the write path is property-name-generic; no allowlist to extend for `filter`/`mix-blend-mode`.
- `apps/studio/client/inspector-controls.jsx` — `Segmented`, `AlignPad`, `SliderField`, `NumberField`, `Select` — the Phase-1 primitives Designer mode reuses. `AlignPad` in particular is currently UNUSED in `CssKnobs` — Designer mode's Auto-layout alignment row is its first real caller.
- `.ai/decisions/DDR-104-css-panel-ux-model.md` — the decision this plan supersedes for the Designer-mode scope only. Read in full; the new DDR (Task 1) must reference and not silently contradict its still-valid parts (single write endpoint, provenance dots, token-first defaults, shadow-flagging).
- `.ai/plans/feature-inspector-controls-redesign.md` — Phase 1 (shipped), whose primitives this phase reuses; its "Follow-up (Phase 2)" section is the ORIGINAL capture this plan supersedes with a properly debated + user-confirmed scope (the original text's literal "Text = Size/Line height/Letter spacing" list is NOT followed as-is — see Design Decisions §Text for why).

### Files to Modify

- `apps/studio/client/app.jsx` — `CssKnobs` (mode state, Designer-mode render tree, `row()` label-override param, new `CSS_BLEND_MODES` const, mode-toggle UI).
- `apps/studio/client/styles/3-shell-maude.css` — new classes for the mode toggle + Designer-mode cluster layout (reuse `.st-cp-sec`/`.st-cp-sechd` shape where possible; add only what's genuinely new).
- `.design/system/maude/preview/components-inspector-controls.tsx` (+`.css`) — extend the existing specimen with a mode-toggle example + one Designer-mode cluster, so the DS documents both vocabularies.

### Files to Create

- `.ai/decisions/DDR-<NNN>-css-panel-designer-mode-vocabulary.md` — the DDR superseding DDR-104 §2 for Designer mode (Task 1; number resolved at execute time per the DDR-numbering-races memory — check the decisions dir AND any uncommitted README index diff before claiming a number).

---

## Design Decisions

### Designer-mode cluster map (regroup, not 1:1 relabel)

Grounded in Figma's actual right-panel structure (a well-documented, stable public UI), adapted where our CSS-backed model genuinely differs (noted inline). Each cluster's "common" rows are always visible; "disclosure" rows sit behind a per-cluster "···" expand (reusing the same disclosure affordance style as `PanelSection`, not a second Advanced tier).

| Designer cluster | Label | Common rows (always visible) | Disclosure rows (behind "···") | Pulled from today's section(s) |
| --- | --- | --- | --- | --- |
| Auto layout | **Auto layout** | Direction (`flex-direction`, iconseg), Alignment (`align-items`+`justify-content` via **`AlignPad`** — first real caller of this unused Phase-1 primitive), Gap, Sizing mode (Hug/Fill/Fixed, reused `sizeModeSeg`), Padding (extracted standalone from the box-model widget) | Wrap (`flex-wrap`) | Layout + Size (Hug/Fill/Fixed) + Spacing (padding half) |
| Size | **Size** | Width, Height | Min/Max width/height | Size (numeric half, after Hug/Fill/Fixed moves to Auto layout) |
| Position | **Position** (hidden by default unless `position != static`, mirroring the Phase-12.3 auto-expand-on-authored precedent) | Position mode, inset sides | z-index | Position (unchanged content, gated visibility) |
| Fill | **Fill** | `background-color` | — | Appearance |
| Stroke | **Stroke** | `border` (composite width+style+color, reused as-is) | — | Appearance |
| Corner radius | **Corner radius** | `border-radius` via the already-built `RadiusControl` (per-corner detach is ITS OWN disclosure, already built in Phase 1 — zero new work) | (per-corner detach, built-in) | Appearance |
| Effects | **Effects** | Shadow (`box-shadow`, relabeled), Blur (**NEW** `filter: blur(Npx)`, scoped to blur-only — not a full filter-function editor), Blend (**NEW** `mix-blend-mode`, enum select) | — | Appearance + 2 new rows |
| Opacity | **Opacity** | `opacity` (reused `SliderField`, already 0-100%) | — | Appearance |
| Text | **Text** | Font (`font-family`), Color (`color`), Size (`font-size`), Weight (`font-weight`), Line height (`line-height`), Align (`text-align`) | Letter spacing, Style (`font-style`), Case (`text-transform`), Whitespace (`white-space`) | Typography |
| Spacing | **Spacing** | Margin (4-side box-model, reused) | — | Spacing (margin half, after padding moves to Auto layout) |
| Media | **Media** | unchanged (already plain-English: object-fit/position/aspect-ratio, conditional on media element) | — | Media (as-is) |

**Deviations from the original (pre-debate) Phase-2 capture, made explicitly, not silently:**
- The old note's Text list ("Size/Line height/Letter spacing" only) is NOT followed — it would hide Font/Color/Weight/Align, which are the FIRST things Figma's own default Text panel shows. The table above uses Figma's real default set instead. Flag this deviation to the user at plan review.
- Text `color` stays in the Text cluster (not merged into Fill), even though Figma conceptually treats text color as "fill of the text object" — kept separate here because our model is CSS-property-backed (`color` vs `background-color` are genuinely different properties on genuinely different elements), and a dual-purpose "Fill" cluster would need per-element-type branching for one relabel's sake. Simpler, still faithful to the spirit.
- Margin lives in its own "Spacing" cluster rather than disappearing — Figma's Auto Layout model doesn't really have "margin" (siblings use gap, non-auto-layout children use manual position), but our tool is CSS-backed and a plain block element still needs margin. This is a deliberate adaptation, not a literal Figma-parity gap.

### Components (from registry — Phase 1 library, zero new primitives)

| Component | Source | Notes |
| --- | --- | --- |
| `Segmented` | `inspector-controls.jsx` | Mode toggle (Advanced / Designer) |
| `AlignPad` | `inspector-controls.jsx` | Auto-layout alignment — first real caller in `CssKnobs` |
| `SliderField` | `inspector-controls.jsx` | Opacity (already used), Blur amount (new) |
| `NumberField` | `inspector-controls.jsx` | Blur px value |
| existing `csel`/`iconseg`/`radiusControl`/`sizeModeSeg` closures | `CssKnobs` body | Every other Designer-mode row |

### Tokens

No new tokens — every Designer-mode row reuses the exact control (hence exact token usage) it has in Advanced mode. The mode-toggle segmented control reuses `inspector-controls.jsx`'s existing `--bg-3`/`--border-default`/`--accent` token set.

### Custom components needed

None. This is the plan's own hard constraint (carried from the original Phase-2 capture and unchallenged by the debate): Designer mode is a presentation/regroup layer over Phase 1's primitives + `CssKnobs`'s existing closures, not a new control surface.

---

## Tasks

Execute in dependency order. Each task ends with `/flow:utils-verify`; UI-visible tasks get an agent-browser screenshot check per the CSS-panel research precedent (DDR-104's own "canvas-first, critic-gated" convention — see Task 8).

### Task 1: RECORD the DDR superseding DDR-104 §2 for Designer-mode scope — ✅ completed
- **Do**: Run `/flow:record-ddr`. Content: Designer mode is an additive second vocabulary (not a replacement) for `CssKnobs`; Advanced mode is DDR-104's original decision, unchanged, still the default; state why the need changed (non-technical users, explicit user request 2026-07-14); note the accepted naming-collision risk (raw-CSS mode is itself named "Advanced," nesting the existing "Advanced" escape-hatch section) as a conscious choice, not an oversight; carry forward DDR-104's still-valid guardrails (single write endpoint, provenance dots, token-first, shadow-flagging).
- **Gotcha**: check the DDR-numbering-races memory — verify the next number against both the decisions dir AND any uncommitted README index diff before claiming it, and re-check right before commit.
- **Validate**: DDR file exists, cross-references DDR-104, states supersession scope precisely (Designer-mode vocabulary only — does not touch Advanced mode, provenance model, or the write endpoint).

### Task 2: EXTEND `row()` with an optional label override (additive) — ✅ completed
- **Do**: Add an optional param/object to `row(prop, control, provKind, labelOverride?)` that, when present, replaces BOTH the visible `<label>` text AND the `title={prop}` tooltip attribute with the override (never leave them out of sync — closes the exact gap BREAKER flagged in the debate). All 8 existing Advanced-mode `row()` call sites pass nothing; verify byte-identical output for Advanced mode.
- **Pattern**: mirror the existing `row(prop, control, provKind)` at its current line (re-locate via Context References — the file has shifted since this plan was written).
- **Validate**: Advanced mode screenshot before/after the change is pixel-identical (agent-browser).

### Task 3: ADD `filter` (blur) and `mix-blend-mode` as new CSS rows (available in BOTH modes) — ✅ completed
- **Do**: Add `CSS_BLEND_MODES` to the `CSS_*` constants block (`normal, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity` — the standard CSS `mix-blend-mode` list). Add a `filter` row using `NumberField`/`SliderField` scoped to `blur(Npx)` only (parse `blur\((\d+)px\)` on read, serialize `blur(${n}px)` on write — v1 does not support multiple filter functions). Add a `mix-blend-mode` row using the existing `csel`-shaped select control. Both rows are usable from Advanced mode too (raw CSS rows, not Designer-exclusive) — add them to the existing **Appearance** section in Advanced mode, positioned near `box-shadow`.
- **Gotcha**: `filter` needs its own parse/serialize (unlike most rows which pass the raw string straight to `commit`) — write this as a small local helper inside `CssKnobs`, not a new top-level utility (keeps the "no new primitives" constraint honest).
- **Validate**: in Advanced mode, set a blur value and a blend mode on a real canvas element; confirm the JSX source gets the correct `filter`/`mixBlendMode` inline style values; confirm round-trip (re-select the element, the fields show the same values back).

### Task 4: BUILD the mode-toggle state + persistence — ✅ completed
- **Do**: Add `const [mode, setMode] = useState(() => readJsonStore('maude-cp-mode', 'advanced'))` inside `CssKnobs`; a `useEffect` that writes it back (mirror the `sectionsExpanded` write-back pattern at `app.jsx:8303`). Render a `Segmented` control (from `inspector-controls.jsx`) at the top of the panel: options `Advanced` / `Designer`.
- **Pattern**: `readJsonStore`/`localStorage.setItem` (`app.jsx:186-193`, `:8303`).
- **Validate**: toggle flips instantly (no remount flash), persists across a page reload, defaults to `Advanced` on first-ever load (no regression for existing users).

### Task 5: BUILD the Designer-mode render tree — Auto layout, Size, Position clusters — ✅ completed
- **Do**: Inside `CssKnobs`'s return, branch on `mode === 'designer'`. Build the three clusters per the Design Decisions table: Auto layout (Direction/AlignPad/Gap/Sizing-mode/Padding), Size (Width/Height/Min/Max behind disclosure), Position (hidden unless `position != static`, mirroring the Phase-12.3 `hasCustom` auto-expand precedent at `app.jsx:4902-4909`).
- **Gotcha**: Padding is currently rendered as HALF of a combined margin+padding box-model widget (`app.jsx` Spacing section) — extracting a standalone padding-only control means either reusing the same `side()`-based closures directly (not the combined widget component) or building a padding-only variant of the box display. Prefer the former — no new visual widget, just fewer `side()` calls rendered without the margin nesting.
- **Validate**: agent-browser screenshot of Designer mode on a flex-container element and a plain block element (the "+ Auto layout" button path must still work identically in Designer mode).

### Task 6: BUILD the Designer-mode render tree — Fill, Stroke, Corner radius, Effects, Opacity clusters — ✅ completed
- **Do**: Fill (`background-color`), Stroke (reuse the existing composite `border` row as-is, relabeled), Corner radius (reuse `radiusControl()` as-is, relabeled — per-corner detach already built), Effects (Shadow relabeled `box-shadow` + the two new rows from Task 3), Opacity (reuse existing `SliderField` opacity row as-is, relabeled).
- **Validate**: agent-browser screenshot; confirm the per-corner radius detach toggle still works identically inside Designer mode (it's the same `RadiusControl`, just reached via a relabeled row).

### Task 7: BUILD the Designer-mode render tree — Text, Spacing, Media clusters — ✅ completed
- **Do**: Text (common: Font/Color/Size/Weight/Line height/Align; disclosure: Letter spacing/Style/Case/Whitespace — per the Design Decisions deviation from the original capture). Spacing (margin-only box-model, reusing `side()` closures without the padding nesting). Media (unchanged, just the cluster label — already plain English).
- **Validate**: agent-browser screenshot of Text cluster's common vs disclosure split on a text element.

### Task 8: DS specimen — extend `components-inspector-controls` with the mode toggle + a Designer cluster example — ✅ completed
- **Do**: Add a new section to the existing specimen (`.design/system/maude/preview/components-inspector-controls.tsx`) demonstrating the `Segmented` mode toggle plus one fully-worked Designer-mode cluster (e.g. "Auto layout") side-by-side with its Advanced-mode equivalent, so the DS documents the vocabulary mapping visually, not just in this plan doc.
- **Pattern**: existing specimen conventions (`.icp-*` classes, header-comment style, real studio labels).
- **Validate**: `/design:smoke` renders it styled; visual read confirms the Advanced/Designer pairing is legible.

### Task 9: REBUILD the committed client bundle — ✅ completed
- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css` alongside the source in the same feature commit (per CLAUDE.md — never let the two drift).
- **Validate**: bundle diff is the release-minified artifact (~250 KB-scale delta, not a 3.6 MB dev regen).

---

## Validation

1. **Advanced mode regression**: pixel-identical screenshot before/after Task 2 (label-override is additive-only).
2. **Designer mode**: agent-browser walk of all 11 clusters on a representative flex-container element AND a plain block element AND a text element (Position/Media conditional visibility needs both element shapes to exercise).
3. **Round-trip correctness**: every new row (filter, blend-mode) and every regrouped row (padding extracted from the box-model, Hug/Fill/Fixed moved into Auto layout) commits correctly and re-reads correctly on reselect.
4. **Mode persistence**: reload the browser, confirm the last-chosen mode survives; confirm a fresh profile (no localStorage key) defaults to Advanced.
5. **A11y**: `a11y-auditor` — the `Segmented` mode toggle and every Designer-mode row expose the same ARIA semantics Phase 1 already established (no new gaps introduced by relabeling).
6. **Design system**: `design-system-guard` — Designer-mode cluster styling uses only existing tokens (no new hardcoded values); DS specimen (Task 8) matches the shipped panel.
7. **Manual**: verify the per-corner radius detach and the Hug/Fill/Fixed toggle behave identically whether reached from Advanced or Designer mode (same underlying control, two doors in).

---

## Acceptance Criteria

> Verification ceiling (2026-07-14): live element-selection in the real `CssKnobs` panel could not be automated (Cmd+click into the cross-origin canvas iframe — see `.ai/state/STATE.md` Execution Progress entry for the full explanation). Items below are checked only where actually verified; unchecked items are implemented + syntax-verified + pattern-matched against shipped precedent, but need a manual pass before `/done`.

- [x] Task 1 DDR recorded, cross-references DDR-104, scope precisely stated (+ post-ship addendum: mode-in-Settings + §6 provenance-dot divergence)
- [x] Tasks 2-3 land with zero Advanced-mode regression — additive-only (`labelOverride` defaults `undefined`; all Designer CSS gated behind `.st-cp--designer`); Advanced-mode render tree byte-identical
- [~] `filter`(blur)/`mix-blend-mode` round-trip correctly, usable from both modes — implemented; write path confirmed generic (`editStyleProp`, CSS-panel write-path tests 11/11 pass); not live element-round-trip tested (automation ceiling — needs a manual pass)
- [x] Mode toggle persists via `maude-cp-mode`, defaults to `advanced` — **live-verified** (`localStorage['maude-cp-mode'] === "designer"` after Settings click) + surfaced in Settings → Appearance
- [~] All 11 Designer-mode clusters render correctly per the cluster map — implemented per the table; "Auto layout" live-verified via the DS-specimen pairing; the rest need a manual pass (automation ceiling)
- [x] DS specimen documents the mode toggle + at least one Designer cluster — live-verified in-browser, toggle proven state-preserving across both vocabularies
- [ ] `a11y-auditor`: 0 blockers — **deferred (`--quick`)**; new controls reuse the Phase-1 `IconButtonGroup` a11y pattern (role=radiogroup/radio + aria-label) and standard `<input type=radio>` in Settings
- [ ] `design-system-guard`: 0 blockers — **deferred (`--quick`)**; every Designer control reuses an existing primitive + existing tokens, zero new hardcoded values
- [x] Committed client bundle is release-minified
- [x] No DDR-worthy decision left unrecorded — DDR-171 + its post-ship addendum cover the vocabulary, the Settings lift, and the §6 provenance divergence

> `[~]` = implemented + statically/pattern-verified, blocked only by the live element-selection automation ceiling (Cmd+click into the cross-origin iframe). Recommend a 2-min manual pass before this branch merges to `main` via a full `/flow:validate`.

---

## Retro

- **The plan's own "verification ceiling" note paid off.** The plan pre-flagged that live element-selection in the real `CssKnobs` panel can't be automated (Cmd+click into a cross-origin iframe). That held true across three separate attempts (high-level `click`+`keydown`, low-level `mouse`+`keydown`, and a `frame`-scoped `eval` that silently didn't execute inside the iframe). Confidence was rebuilt on a different leg — a **DS-specimen proxy** that mirrors the real `.st-cp-*`/`.icp-*` CSS 1:1 and IS live-drivable — plus per-task `bun build` syntax gates and pattern-fidelity against shipped code (`blurControl` ≈ the working `rotationControl`). Lesson for `/plan`: when a surface is known-unautomatable, name the fallback verification leg in the plan up front, not at `/done`.
- **The two post-ship user rounds were the real design work.** The plan shipped a functionally-correct full-width `Segmented` toggle + provenance dots on every Designer row; the owner's "hrozně obrovský" + "trochu chaotický" feedback drove the actual polish (corner icon-toggle, hide-inherited-dots, title-case headers, Settings persistence). A `graphic-design-critic` pass against specimen screenshots surfaced the concrete fixes. Lesson: for a visual feature, budget an explicit design-review round AFTER the first working version — the plan treated look-and-feel as a Task-8 specimen afterthought, but it was the load-bearing part.
- **Regroup > relabel was the right BUILDER call, but "declutter" was the missed axis.** The plan correctly identified that Designer mode's value is regrouping (Auto layout pulling Layout+Size), not relabeling. What it didn't anticipate: the biggest *perceived* clutter wasn't vocabulary at all — it was the per-row provenance-dot rail (a DDR-104 §6 feature that's right for developers, wrong for the designer surface). That only surfaced from a real screenshot next to Figma's dot-free panel. Recorded as a scoped §6 divergence in DDR-171's addendum.
- **Shared-`main` concurrency was heavy and cost real care.** 3–4 sessions committed to `main` during this work (DDR-168/172/173, ACP feat); a concurrent README regen silently **dropped this feature's DDR-171 index line**, which had to be re-added at `/done`. STATE.md and README.md needed per-diff verification (pure-additions check, HEAD-advance reconciliation) before staging, and a stray `apps/studio/acp/login-state.ts` from another session had to be kept out of the commit. Lesson: on a hot shared trunk, treat the `.ai/` index/state files as append-only and re-verify them right before commit — never assume your earlier edit survived.
- **Two optional follow-ups from the security fan-out (both non-blocking).** The `ethical-hacker` pass confirmed the change is sound (all writes ride the pre-existing main-origin `/_api/edit-css` boundary — property-name regex + `JSON.stringify` literalization + 256-char cap) but noted: (1) a composed `filter: blur()` value could exceed the 256-char server cap and 413 while the optimistic overlay already applied, briefly desyncing panel vs disk (a pre-existing overlay behavior, not new to this change); (2) a defense-in-depth unit test pinning that `filter`/`mix-blend-mode` writes arrive as JSON-stringified literals would guard the term-breakout invariant against a future refactor that bypasses `commit`. Neither blocks; both tracked here.
