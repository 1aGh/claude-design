# Phase 12.2: In-canvas CSS panel — proper UX

> **Created 2026-06-11.** Carved out of Phase 12 after the Task-2 CSS knobs shipped functional-but-unusable (commit `eb8705f`). The write path (engine `editAttribute` inline-style merge + `POST /_api/edit-css`) is **done and live-verified** — this plan is **only the panel UX**, done thoroughly. Sibling of `phase-12.1-layers-reorder.md`. DDR-101 governs the write model; a new DDR may record the value-source decision (Task 0).

## Problem (what shipped in `eb8705f` and why it's unusable)

The v1 CSS tab writes correctly to source but the UI is not shippable (user verdict 2026-06-11: "tragédie / nepoužitelný"). Concretely, from the live panel:

1. **Cramped inputs.** The knobs reuse `.st-field` / `.st-insp-row`, sized for the read-only Inspect tab's 2-char X/Y/W/H fields. Real CSS values overflow and truncate: `656.003`, `oklch(0`, `rgba(0,`, `propert`.
2. **Raw computed values pre-filled.** `getComputedStyle` returns resolved, noisy strings that are meaningless to hand-edit: `width: 656.003px` (sub-pixel from flex), `color: oklch(0.x…)`, `background-color: rgba(0,0,0,0)`, `display: block`, `line-height: normal`. Editing these is nonsense — they're derived, not authored.
3. **Helper callout wraps catastrophically.** The `<code>` runs inside a narrow panel force one-word-per-line. Reads as broken.
4. **No real editing affordances.** No color swatch, no unit stepper/select, no DS-token dropdown, no 4-side box-model widget — none of the Webflow-grade intent.
5. **Width/layout.** The right panel is too narrow for label + a usable value field side-by-side.

## Principle

**Edit the AUTHORED value, not the computed value.** The panel should reflect/edit what's actually in the element's source `style={{}}` (and offer to add a property when absent), with the computed value only as a faint reference. Pre-filling editable fields with resolved `getComputedStyle` output is the root UX error.

## Methodology — design it before porting it (dogfood)

This is a maude-DS surface. Per the project's own loop, **design the panel as a canvas spec first**, critique it, then port to `app.jsx`. Do NOT free-hand the JSX into the 3000-line shell again.

1. Mock the panel in `.design/ui/Studio.tsx` (the existing InspectorPanel mock) or a dedicated `.design/ui/CSS Panel.tsx` — full states: empty, single-prop, all-groups, color-open, token-dropdown, error.
2. Run the critic panel (`/design:critic` — graphic + a11y + typography + signature-moment) until ≥ 4.0.
3. Port the approved spec to `app.jsx` `CssKnobs`, wired to the live endpoint.
4. Live-verify via agent-browser on a worktree-rooted server.

## Tasks

### Task 0 — Value-source decision (DDR)
- **Do:** Decide + record: panel reads/edits the **authored** inline-style value (from source), not computed. Options for sourcing the authored value: (a) extend the selection payload / a `GET /_api/canvas-style?canvas&id` that returns the element's current inline `style` object parsed from source (oxc, reusing `canvas-edit` AST walk); (b) parse it client-side from `selected.html`. Lean (a) — authoritative, reuses the engine. Computed value shown only as faint placeholder/reference. Decide unit handling (number + unit-select vs free string) + token-dropdown source (read DS tokens from `system/<ds>` CSS).
- **Validate:** DDR records the value-source + unit + token-source decisions.

### Task 1 — Panel layout + sizing
- **Do:** Redesign the CSS tab layout: full-width value fields (label above or a wider 2-col grid), proper section rhythm, panel min-width bump if needed. New scoped CSS in `client/styles/` (not reused `.st-field`). Fix/replace the helper callout (move to a `?` tooltip or a single non-wrapping line). Respect the maude chrome tokens.
- **Validate:** every value renders without truncation at the panel's real width; no catastrophic wrapping; matches the critic-approved spec.

### Task 2 — Humanized values + authored-value sourcing
- **Do:** Implement the Task-0 value source (authored inline style). Round dimensions, drop sub-pixel noise; show empty/placeholder when a property is not authored (not the resolved default). Color: convert to hex (+ alpha) for display.
- **Validate:** a button with `style={{ padding: 8 }}` shows `8px` in padding and BLANK (placeholder) in width/color; no `656.003` / `oklch(…)` / `rgba(0,0,0,0)` noise.

### Task 3 — Color control
- **Do:** Color + background-color knobs get a swatch + native color picker + hex/token text field. Writes hex or `var(--token)`.
- **Validate:** pick a color → swatch updates → source gets the hex/token; alpha handled.

### Task 4 — Units + steppers + token dropdowns
- **Do:** Dimension/spacing/size/radius/gap knobs: number field + unit `<select>` (px/rem/em/%/auto) + ↑/↓ steppers. A DS-token dropdown (spacing/radius/color scale read from the active DS) that writes `var(--token)`.
- **Validate:** stepper increments; unit switch rewrites the value; token pick writes `var(--…)`; on-system edits round-trip.

### Task 5 — Box-model widget (spacing)
- **Do:** Webflow-style 4-side padding + margin widget (per-side longhand writes via `style.paddingTop` etc.).
- **Validate:** editing one side writes only that longhand; visual widget reflects current values.

### Task 6 — Feedback + a11y + perf
- **Do:** Inline per-field save state (saving / saved / error with the endpoint message + revert). Full keyboard operability, labels, focus rings; respect reduced-motion. Sub-50ms perceived (pairs with phase-12 Task 5 optimistic preview if landed).
- **Validate:** `a11y-auditor` on the panel (keyboard-only); error state shows the endpoint refusal legibly.

### Task 7 — Port + live verify + rebuild
- **Do:** Port the critic-approved spec to `app.jsx`; release rebuild (`MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) + commit `dist/client.bundle.js` + `styles.css`.
- **Validate:** agent-browser on a worktree-rooted server — Cmd+click element → CSS tab → change padding/color/radius → source `.tsx` updated → HMR reload shows it. `/design:smoke` clean.

## Acceptance criteria
- [ ] Panel edits the AUTHORED inline-style value; computed shown only as faint reference; no raw `getComputedStyle` noise in editable fields.
- [ ] No truncation / no catastrophic wrapping at the real panel width; helper text fixed.
- [ ] Color swatch + picker; unit select + steppers; DS-token dropdown writing `var(--token)`; box-model widget for spacing.
- [ ] Per-field save/error feedback; keyboard-operable; a11y-auditor pass.
- [ ] Designed-as-canvas-first, critic ≥ 4.0, then ported (not free-handed into the shell).
- [ ] Live agent-browser verified + `/design:smoke` clean; release bundle rebuilt + committed.

## Notes
- The current `CssKnobs` (eb8705f) stays as the functional fallback until this lands; OR a quick stopgap (full-width inputs + fix callout + stop pre-filling noisy computed values) can make it tolerable in the meantime — separate from this thorough pass.
- Write path is DONE: `editAttribute` `style.<prop>` merge + `POST /_api/edit-css` (live-verified). This plan touches only the client panel (+ optionally a small read endpoint for authored-style sourcing, Task 0/2).
