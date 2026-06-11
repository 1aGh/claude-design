# Phase 12.2: In-canvas CSS panel — proper UX

> **Created 2026-06-11; reinforced 2026-06-11 with real competitive + heuristic UX research** (Webflow / Framer / Webstudio / Plasmic / Builder.io + Gutenberg / Elementor / Wix / Squarespace / Shopify / Notion / Canva / Carrd + NN/g · Smashing · W3C-APG · MDN — sources at the foot). Carved out of Phase 12 after the Task-2 CSS knobs shipped functional-but-unusable (commit `eb8705f`). The write path (engine `editAttribute` inline-style merge + `POST /_api/edit-css`) is **done and live-verified** — this plan is **only the panel UX**, done thoroughly. Sibling of `phase-12.1-layers-reorder.md`. DDR-101 governs the write model; a new DDR records the value-source + token-source + vocabulary decisions (Task 0).

---

## Reconciliation — what the panel ACTUALLY is right now (2026-06-11)

Re-mapped against `apps/studio/client/app.jsx` (not the eb8705f snapshot the original "Problem" section described). The panel is **already past v1** on several axes — this changes which tasks are real:

| Aspect | Original "Problem" claim | Actual current state (`app.jsx`) | Implication |
| --- | --- | --- | --- |
| Value source | "Raw computed values pre-filled" | `CssKnobs` (≈`app.jsx:2878`) reads `el.authored[cssProp]`; computed shown only as `cssHint()` **placeholder** | **Task 0/2 mostly DONE.** The authored-vs-computed principle already holds client-side. |
| Authored origin | n/a | `el.authored` is captured from the **live DOM inside the iframe** (`element.style.getPropertyValue`), preserved across WS echoes by `mergeSelClientFields()` — NOT parsed from source AST | One open edge case (below), not a rewrite. |
| Field CSS | "reuses cramped `.st-field`" | Dedicated scoped `.st-css-*` rules (`styles/3-shell-maude.css:467+`); `.st-css-input` is `flex:1` full-width | **Task 1 partly DONE.** Sizing already separated from Inspect's 58px `.st-field`. |
| Color | "no swatch" | `.st-css-swatch` (22px, checkerboard) already present | **Task 3 partly DONE.** Needs picker + token wiring, not from-scratch. |
| Escape hatch | "none" | `RawKnob` (`app.jsx:3003`) already writes arbitrary `property+value` pairs | **Task escape-hatch EXISTS.** Needs the two-hatch split + forgiving-add + provenance, not invention. |
| Grouping | flat | `CSS_KNOB_GROUPS` (`app.jsx:2805`): Layout/Spacing/Size/Typography/Appearance/Custom | Aligns with the decided hybrid model — evolve, don't rebuild. |

**Net:** the remaining gap is **vocabulary/section framing, token-first controls, the box-model widget, the two-hatch escape, per-field feedback, and a11y** — NOT the value-source rewrite. The "design-it-as-canvas-first" methodology still stands because the *composition* (token dropdowns, box-model, provenance, section rhythm) has never been laid out as a spec.

### One open edge case (authored origin)
`el.authored` reads the rendered element's **inline** style via the DOM, which equals the source `style={{}}` literal for the cases DDR-101 supports (literal inline object). It is correctly **blank** when a value comes from a class/token (→ field shows placeholder, not a fake default — the desired behaviour). The original Task-0 option (a) — a `GET /_api/canvas-style` AST endpoint reusing `canvas-edit.ts findOpening` — is therefore **demoted to optional**: only build it if live round-trip shows DOM-inline ≠ source-literal mismatches (e.g. post-HMR staleness). Default v2 = keep DOM-authored. Record this in the Task-0 DDR.

---

## Decided model (2026-06-11 — user)

Two AskUserQuestion decisions fix the panel's character; everything below is built to them:

1. **Vocabulary = Hybrid.** Friendly **section headers** (`TYPOGRAPHY` / `SPACING` / `SIZE` / `APPEARANCE`) with **CSS-named rows** inside (`color`, `font-size`, `padding`, `border-radius`). Honest + explicit for a designer tool, but legibly grouped for a non-technical user. We do **not** rename properties to "Fill/Corner/Size" — the section header carries the friendliness, the row keeps the real property name.
2. **Curated tier = broader (~12–14 controls).** The empirical "everyday 8" floor **plus** width/height, gap, opacity, shadow, line-height. Everything beyond that (display, position, transform, filter, letter-spacing, max-width, overflow, …) → the **custom attributes** escape hatch.
3. **Token-first, per-field.** Every token-able row defaults to picking a **DS token** (read from `system/<ds>/colors_and_type.css`) via a per-field dropdown affordance; a raw value is the deliberate exception behind a toggle.

---

## Principle (unchanged, now research-backed)

**Edit the AUTHORED value, not the computed value** — and **prefer a named token over a raw value**. The panel reflects what's actually authored on the element (inline `style`), shows the computed value only as a faint reference, and steers every editable value toward a DS token. Pre-filling editable fields with resolved `getComputedStyle` output is the root UX error; typing raw hex/px where a token exists is the secondary one. Grounded in NN/g progressive disclosure + the design-token mental-model literature (sources below).

---

## UX research foundation (grounding for every task)

Distilled from the three research sweeps. Each rule is the *reason* a task exists; cite these in the canvas-first critique.

### A. The curated set is convergent — don't reinvent it
Across **every** tool surveyed, the default-visible control set is the same short list ("everyday 8"): **text color · fill/background · font (family+size) · text style (B/I/U) · alignment · spacing (4-side box model) · corner radius · border**. Builder.io ships exactly 8 visual panels then 3 explicitly developer-only ones — the cleanest "curated + fenced" split in the set. Our broader tier = that floor + {width, height, gap, opacity, shadow, line-height}. [Builder.io; Webflow; cross-tool synthesis]

### B. Canonical section order
Layout → **Spacing → Size → Typography → Background → Border → Effects**. Users arriving from any builder expect it. (Our hybrid preview led Typography-first because a selected element is usually text/button; either order is defensible — let the critic decide. Lead with the user's most-edited group.) [Webflow / Framer / Webstudio / Plasmic / Builder.io all converge]

### C. Named scales beat raw px for non-technical users
Squarespace (Height S=25% / M=50% / L=100%) and Gutenberg (7-step S→3XL spacing slider) both prove non-technical users prefer **picking a named step** over typing pixels; raw numeric is a deliberate opt-out behind a "Custom" toggle. **Our named scale = the DS tokens themselves** (`--space-*`, `--radius-*`, `--type-*`, color tokens) — strictly better than abstract S/M/L because it round-trips to the design system. [Squarespace; Gutenberg]

### D. Token picking: per-field dropdown > autocomplete (for this audience)
Two industry patterns: Webflow's per-field token affordance (the purple dot toggles a field raw↔token) and Builder.io's inline token dropdown vs Webstudio's type-`--`-autocomplete. **Autocomplete assumes the user knows variables exist** — for non-technical users the **visible per-field dropdown** (Webflow/Builder) is more discoverable. Show the token's *name* in the field when bound. [Webflow; Builder.io; Webstudio]

### E. Provenance must be legible (and shadowing must be flagged)
Webstudio colour-codes value source — **blue = set here, orange = inherited, gray = browser default, red = overwritten**. Plasmic documents the exact failure mode we must avoid: a custom-CSS property that *also* has a visual control makes the visual control lie. **Rule:** mark each row as *token-bound / raw-override / inherited-default*, and **flag when a custom-attributes entry shadows a curated control**. [Webstudio; Plasmic]

### F. Color control anatomy
Swatch (checkerboard for alpha) → spectrum + hue → alpha slider (only for alpha formats) → editable HEX/RGB/HSL with format toggle → eyedropper with live preview → **token swatches first**, then document colors, then recents. Never eyedropper-only (blocks paste/exact entry). [Mobbin; color-picker literature]

### G. Numeric input = type + scrub + step
Every number field: **type** an exact value, **scrub** (drag the field/label, whole field is the hot-zone), **steppers** (±). Keyboard ↑/↓ = ±1, **Shift+↑/↓ = ±10**. Unit selector adjacent (px/rem/em/%/auto); accept unit-suffixed typing (`1.5rem`) — never force a retype to switch units. [Figma convention; LogRocket]

### H. Box-model widget
Nested **margin-outside / padding-inside** diagram, four editable sides, margin vs padding visually distinct. Drag-a-side to set; **Shift = all four, Alt = opposite pair**; an explicit **chain/link toggle** for typed entry. Each side writes only its longhand (`style.paddingTop`, …). Show the single-field collapse when all sides are equal; expand to four when they diverge. [Webflow]

### I. Inline save/validation
Validate **on blur, not per-keystroke**. Apply **optimistically** to the canvas, with a per-field **saving → saved** signal. On reject: keep the typed value visible + editable, show a **persistent** message next to the field with **icon + colour** (never colour alone — WCAG 1.4.1), surface the endpoint's reason ("`max-width` must be a length or %"). [NN/g forms guidelines; LogRocket]

### J. Escape hatch = last, collapsed, fenced, labeled, forgiving
Universal pattern: the raw tier sits **last, collapsed, visually demoted, explicitly labeled "CSS"** — never mixed into the friendly controls. Best mechanics seen: Webstudio's **"+" → type-or-paste CSS → auto-route into fields**; Builder.io's clean separation of **custom CSS properties** vs **custom HTML attributes** vs **custom classes**. We adopt **two fenced hatches** (CSS property · HTML attribute), forgiving add, soft-warn (don't hard-block) on unknown property. [Builder.io; Webstudio; Webflow]

### K. Accessibility of dense panels
**Roving tabindex** — one tab stop per control group, arrows within. `role="toolbar"` for ≥3 related controls, each with an `aria-label`. Keep ↑/↓ numeric fields **out** of arrow-roving groups (or last). Always-visible focus ring, distinct from selected state. `aria-label` on every icon-only control (link/unlink, eyedropper, swatch). ARIA ≠ behaviour — hand-wire the keys. [W3C WAI-ARIA APG; MDN toolbar role]

---

## Control inventory — the curated tier (~14)

Section header (friendly) → row (CSS-named) → control → token source. Everything not in this table → **custom attributes**.

| Section | Row (property) | Control | DS-token source | Notes |
| --- | --- | --- | --- | --- |
| **TYPOGRAPHY** | `color` | swatch + picker + token dropdown | `--accent*`, `--fg-0..3`, `--bg-*` | token-first (rule D/F) |
| | `font-size` | number + unit-select + stepper + token | `--type-*` | scrub (rule G) |
| | `font-weight` | select (300/400/500/600/700) | — | named steps, not 100–900 raw |
| | `line-height` | number (unitless) + token | `--lh-*` | |
| | `text-align` | segmented icon group | — | `role=toolbar` + aria-labels (rule K) |
| **SPACING** | `padding` | **box-model widget** (4-side longhand) | `--space-*` | rule H; writes `style.paddingTop`… |
| | `margin` | **box-model widget** (4-side longhand) | `--space-*` | rule H |
| | `gap` | number + unit + token | `--space-*` | shown always; no-ops gracefully if not flex/grid |
| **SIZE** | `width` | number + unit/auto + token | `--layout-*` | |
| | `height` | number + unit/auto + token | `--layout-*` | |
| **APPEARANCE** | `background-color` | swatch + picker + token dropdown | `--bg-*`, `--accent*` | rule F |
| | `border-radius` | number + unit + token | `--radius-*` | |
| | `border` | width(num) + style(select) + color(swatch+token) | `--border-*` | "Border type" select: none/solid/dashed/dotted (Elementor pattern) |
| | `box-shadow` | token dropdown + custom | `--shadow-*` | token-first; raw shorthand behind "Custom" |
| | `opacity` | slider 0–100 | — | |

**Explicitly OUT → custom attributes** (record this list in the DDR so it's a decision, not an omission): `display`, `position`, `top/right/bottom/left`, `transform`, `filter`, `backdrop-filter`, `letter-spacing`, `text-transform`, `max-width/min-*`, `overflow`, `z-index`, `transition`, `cursor`, blend modes, and any arbitrary property. `display` is the borderline one — kept OUT for v2 (block/flex/grid is confusing for non-technical, and `gap` already degrades gracefully); reconsider as a friendly "Layout: Stack / Row / Grid" select in a later phase.

---

## Methodology — design it before porting it (dogfood)

This is a maude-DS surface. Per the project's own loop, **design the panel as a canvas spec first**, critique it, then port to `app.jsx`. Do NOT free-hand the JSX into the 3000-line shell again.

1. Build the full panel spec in **`.design/ui/Studio.tsx` artboard E (`inspector`)** — today it only shows a static read-only CSS code block (`InspectorPanel` `tab="css"`, ≈`Studio.tsx:367`). Replace it with the real interactive composition across **all states**: empty (no element) · single-prop authored · all-sections populated · color-picker-open · token-dropdown-open · box-model-four-sides · custom-attributes-open · error/refusal · token-shadowed warning.
2. Run the critic panel (`/design:critic` — graphic + a11y + typography + signature-moment, and copy for the section/label vocabulary) until **≥ 4.0**. The research rules A–K are the rubric.
3. Port the approved spec to `app.jsx` `CssKnobs`, wired to the live `POST /_api/edit-css`.
4. Live-verify via agent-browser on a worktree-rooted server; `/design:smoke` clean; release-rebuild + commit bundles.

---

## Tasks

### Task 0 — Decisions (DDR)
- **Do:** Record one DDR capturing: (1) value source = **DOM-authored inline** (computed only as faint reference); AST `GET /_api/canvas-style` deferred-optional with its trigger condition. (2) vocabulary = **Hybrid** (friendly section header + CSS-named row). (3) curated set = the ~14 above + the explicit OUT-list. (4) token source = `system/<ds>/colors_and_type.css`, grouped by prefix (`--space-*`/`--radius-*`/`--type-*`/color families/`--shadow-*`/`--border-*`/`--lh-*`/`--layout-*`). (5) token-pick affordance = **per-field dropdown** (not autocomplete). (6) provenance model = token-bound / raw-override / inherited-default + shadow-flag.
- **Validate:** DDR exists and is referenced by the canvas-first spec.

### Task 1 — Panel layout, section rhythm, vocabulary  *(rule A/B + Hybrid)*
- **Do:** Lay out the curated tier under friendly section headers with CSS-named rows. Confirm/raise panel min-width so `label + token-dropdown + value` fit without truncation. Per-section collapse (accordion, **one disclosure level max** — rule §1). Kill the catastrophic helper-callout wrap (move to a `?` tooltip or single non-wrapping line). New scoped CSS only (extend `.st-css-*`, never `.st-field`).
- **Validate:** every value/token renders without truncation at the real panel width; no catastrophic wrap; matches the critic-approved spec; ≤ 1 disclosure level.

### Task 2 — Authored values + token-first defaults  *(rule C/D)*
- **Do:** Keep DOM-authored sourcing (round dimensions, drop sub-pixel noise; blank/placeholder when unauthored). **Add token-first behaviour:** when an authored value equals a DS token, display the **token name** (not the raw value); the per-field dropdown lists the DS tokens for that property family + a "Custom…" raw option. Computed stays a faint reference only.
- **Validate:** a `style={{ padding: 8 }}` element shows `8px` (or `--space-2` if it matches) in padding and BLANK in width/color; no `656.003` / bare `oklch(…)` / `rgba(0,0,0,0)` noise; picking a token writes `var(--…)`.

### Task 3 — Color control  *(rule F)*
- **Do:** `color` + `background-color` + `border` color get: swatch (checkerboard for alpha) → native/custom picker → editable HEX(+alpha) → **token swatches first** dropdown. Writes hex or `var(--token)`.
- **Validate:** pick a colour → swatch updates → source gets hex/token; alpha handled; token swatches precede free hex.

### Task 4 — Numeric + units + steppers + token dropdowns  *(rule G/D)*
- **Do:** Dimension/spacing/size/radius/gap/font-size rows: number field + unit `<select>` (px/rem/em/%/auto) + ↑/↓ steppers + scrub (whole field hot-zone, visible scrub cursor) + Shift = ±10. Per-field DS-token dropdown writing `var(--token)`; accept unit-suffixed typing without retype.
- **Validate:** stepper increments; Shift+↑ = ±10; scrub works; unit switch rewrites; token pick writes `var(--…)`; on-system values round-trip to their token name.

### Task 5 — Box-model widget  *(rule H)*
- **Do:** Webflow/Figma-style nested margin(outer)+padding(inner) 4-side widget. Per-side longhand writes (`style.paddingTop` …). Drag-a-side; **Shift = all four, Alt = opposite pair**; explicit chain/link toggle for typed entry; collapse to one field when sides equal. Margin vs padding visually distinct.
- **Validate:** editing one side writes only that longhand; Shift writes all four; link toggle round-trips; widget reflects current values; margin/padding visually separable.

### Task 6 — Escape hatch: two fenced hatches  *(rule J/E)*
- **Do:** Evolve `RawKnob` into a **collapsed, last, demoted "Advanced"** section with **two** affordances: (a) **Custom CSS property** — "+ Add property" with property-name autocomplete + value field, soft-warn (not hard-block) on unknown property, labeled "applied as-is, not token-bound", fully editable/removable; optionally accept a **pasted CSS block** that auto-routes recognised declarations back into curated fields (Webstudio pattern — stretch). (b) **Custom HTML attribute** — name/value pairs (`data-*`, `aria-*`, `id`) writing a real JSX attribute via `editAttribute` (non-`style.` path). **Flag** any custom CSS property that shadows a curated control (Plasmic failure mode).
- **Validate:** add an arbitrary CSS prop → writes to inline style; add `data-x` → writes a real attribute; unknown prop soft-warns not blocks; a custom `padding` shows a "shadows the Spacing control" flag; both hatches collapsed by default.

### Task 7 — Feedback + a11y + perf  *(rule I/K)*
- **Do:** Per-field save state (saving / saved / error with endpoint message + revert-this-field-only). Roving tabindex, `role="toolbar"` + `aria-label` per control cluster, numeric ↑/↓ fields kept out of arrow-roving (or last), always-visible focus ring distinct from selected, `aria-label` on every icon-only control; respect reduced-motion. Sub-50ms perceived (pairs with phase-12 Task 5 optimistic preview if landed).
- **Validate:** `a11y-auditor` keyboard-only pass; error state shows the endpoint refusal legibly with icon+colour; reject keeps the typed value editable.

### Task 8 — Port + live verify + rebuild
- **Do:** Port the critic-approved spec to `app.jsx` `CssKnobs`; release rebuild (`MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) + commit `dist/client.bundle.js` + `styles.css`.
- **Validate:** agent-browser on a worktree-rooted server — Cmd+click element → CSS tab → change padding (box-model) / color (token) / radius / a custom attribute → source `.tsx` updated → HMR reload shows it. `/design:smoke` clean.

---

## Acceptance criteria
- [ ] Hybrid vocabulary: friendly section headers + CSS-named rows; curated ~14 set; rest reachable via the custom-attributes hatch.
- [ ] Edits the AUTHORED value; computed shown only as faint reference; no raw `getComputedStyle` noise in editable fields.
- [ ] Token-first: on-system values display their token name; per-field DS-token dropdown writes `var(--token)`; provenance (token-bound / raw / inherited) legible; custom-CSS shadowing a curated control is flagged.
- [ ] Color swatch + picker + token swatches; numeric type+scrub+step with Shift=±10 + unit select; box-model widget with Shift/Alt/link; opacity slider.
- [ ] Two fenced escape hatches (custom CSS property + custom HTML attribute), collapsed/last/labeled, forgiving add (soft-warn).
- [ ] Per-field save/error feedback (icon+colour, keeps typed value); keyboard-operable (roving tabindex, role=toolbar, visible focus); a11y-auditor pass.
- [ ] No truncation / no catastrophic wrap at real panel width; ≤ 1 disclosure level; helper text fixed.
- [ ] Designed-as-canvas-first in `Studio.tsx` artboard E, critic ≥ 4.0, then ported (not free-handed into the shell).
- [ ] Live agent-browser verified + `/design:smoke` clean; release bundle rebuilt + committed.

---

## Notes
- The current `CssKnobs` (`app.jsx:2878`) stays as the functional fallback until this lands; a quick stopgap (full-width inputs + fix callout) is already largely in place per the reconciliation table.
- Write path is DONE: `editAttribute` `style.<prop>` merge + `POST /_api/edit-css` (live-verified, DDR-101). `editAttribute`'s non-`style.` path already supports the custom-HTML-attribute hatch. This plan touches only the client panel (+ the optional, deferred `GET /_api/canvas-style` AST read if DOM-authored proves stale).
- Token source is per-DS: read `system/<ds>/colors_and_type.css`, group `var(--…)` names by prefix; honor the active canvas's declared DS (the same `canvasDesignSystems` map that DDR-093 added).

---

## Sources (UX research foundation)

**Pro-code builders** — Webflow [Style panel](https://help.webflow.com/hc/en-us/articles/33961362040723-Style-panel-overview) · [Spacing](https://help.webflow.com/hc/en-us/articles/33961243177875-Spacing-margin-and-padding) · [Units](https://help.webflow.com/hc/en-us/articles/33961290465043-Input-values-and-units) · [Custom CSS properties](https://help.webflow.com/hc/en-us/articles/33961265610259-Custom-CSS-properties-and-values) · [Custom attributes](https://help.webflow.com/hc/en-us/articles/33961389460115-Custom-attributes) · [Variables](https://help.webflow.com/hc/en-us/articles/33961268146323-Variables); Webstudio [builder anatomy](https://docs.webstudio.is/university/foundations/anatomy-of-the-webstudio-builder) · [CSS variables](https://docs.webstudio.is/university/foundations/css-variables) · [advanced panel #4816](https://github.com/webstudio-is/webstudio/issues/4816); Plasmic [styling](https://docs.plasmic.app/learn/styling-and-layout/) · [custom CSS](https://docs.plasmic.app/learn/custom-css/) · [tokens](https://docs.plasmic.app/learn/tokens/); Builder.io [Style tab](https://www.builder.io/c/docs/visual-editor-style-tab) · [custom code](https://www.builder.io/c/docs/custom-code) · [design tokens](https://www.builder.io/c/docs/design-tokens); Framer [custom code](https://www.framer.com/help/articles/how-to-add-custom-code/) · [overrides](https://www.framer.com/developers/overrides-introduction).

**No-code / non-technical** — Gutenberg [spacing presets](https://developer.wordpress.org/news/2023/03/everything-you-need-to-know-about-spacing-in-block-themes/) · [Additional CSS class](https://www.boldgrid.com/support/wordpress-tutorials/how-to-add-additional-css-classes-to-a-block-using-the-gutenberg-editor/); Elementor [Spacing](https://elementor.com/help/style-tab-spacing/) · [Border](https://elementor.com/help/style-tab-border/) · [Custom CSS](https://elementor.com/help/custom-css-in-elementor/); Wix Studio [docking/margins/padding](https://support.wix.com/en/article/studio-editor-working-with-docking-margins-and-padding) · [CSS editing](https://support.wix.com/en/article/studio-editor-about-css-editing); Squarespace [style changes](https://support.squarespace.com/hc/en-us/articles/205815788-Making-style-changes) · [Fluid Engine S/M/L](https://support.squarespace.com/hc/en-us/articles/6421525446541-Edit-your-site-with-Fluid-Engine); Shopify [theme settings](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/theme-settings); Notion [styling](https://www.notion.com/help/customize-and-style-your-content); Canva [format text](https://www.canva.com/help/format-text/); Carrd [element styles](https://carrd.co/docs/building/using-element-styles).

**Heuristics** — NN/g [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) · [Form error guidelines](https://www.nngroup.com/articles/errors-forms-design-guidelines/); Smashing [Naming Design Tokens](https://smart-interface-design-patterns.com/articles/naming-design-tokens/); UXPin [Design Tokens](https://www.uxpin.com/studio/blog/what-are-design-tokens/); Mobbin [Color Picker](https://mobbin.com/glossary/color-picker); LogRocket [input steppers](https://blog.logrocket.com/ux-design/design-input-steppers-figma/) · [form validation UX](https://blog.logrocket.com/ux-design/ux-form-validation-inline-after-submission/); W3C [WAI-ARIA APG keyboard](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/); MDN [toolbar role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/toolbar_role).
