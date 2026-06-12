# DDR-104: Phase 12.2 — CSS-panel UX model (hybrid vocabulary, curated tier + custom-attributes escape hatch, token-first, DOM-authored value source)

- **Date:** 2026-06-11
- **Status:** Accepted (implementing — `phase-12.2-css-panel-ux.md`)
- **Tags:** dev-server, inspector, css-panel, ux, design-tokens, vocabulary, escape-hatch, value-source, provenance, canvas-first
- **Related:** [DDR-103](./DDR-103-phase-12-in-canvas-direct-edit.md) (the inline-`style={{}}` write model this panel drives), [DDR-019](./DDR-019-two-pass-transform-stable-source-dom-identity.md) (the `editAttribute` rewrite both the curated rows and the custom-attribute hatch ride), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (`POST /_api/edit-css` is main-origin-only), [DDR-093](./DDR-093-canvas-ds-token-injection.md) (the per-canvas `canvasDesignSystems` map the token dropdown reads through), [DDR-097](./DDR-097-studio-shell-scope-and-inspector-display-only.md) (inspector shipped display-only with the Phase-12 callout). Plan: [`phase-12.2-css-panel-ux.md`](../plans/phase-12.2-css-panel-ux.md).

## Context

The Phase-12 CSS knobs (commit `eb8705f`) write correctly to source but shipped functional-but-unusable (user verdict 2026-06-11: "tragédie / nepoužitelný"). Phase 12.2 reworks **only the panel UX**, done thoroughly, and was reinforced with real competitive + heuristic UX research before any code moved — three sweeps over pro-code builders (Webflow, Framer, Webstudio, Plasmic, Builder.io), no-code builders for non-technical users (Gutenberg, Elementor, Wix, Squarespace, Shopify, Notion, Canva, Carrd), and interaction-design heuristics (NN/g, W3C WAI-ARIA APG, Smashing, MDN).

Three forks needed recording up front because each shapes the whole panel **and** the downstream port into the 3000-line `app.jsx` shell, and because the original plan's "Problem" section was written against `eb8705f` while the live `CssKnobs` (`app.jsx:2878`) had already moved past it (reads `el.authored` not computed; has a swatch; has a `RawKnob` escape hatch; scoped `.st-css-*` CSS). This is an **evolution**, not a rewrite — the DDR fixes the target so the evolution is coherent.

The two user-facing decisions (vocabulary, curated-tier width) were taken via `AskUserQuestion` on 2026-06-11: **Hybrid** + **broader (~14)**.

## Decision

1. **Value source = DOM-authored inline; computed is reference-only. The AST read endpoint is deferred-optional.** The panel edits the element's **authored** inline value (`el.authored[prop]`, captured in the iframe via `element.style.getPropertyValue` — i.e. only values literally set in the source `style={{}}`), shows the resolved `getComputedStyle` value only as a faint placeholder, and is correctly **blank** when a value comes from a class/token. Pre-filling editable fields with resolved computed output was the root v1 UX error (DDR-103's inline-write model means only authored values are editable anyway). The plan's option (a) — a `GET /_api/canvas-style` endpoint that parses authored inline style from source via `canvas-edit.ts findOpening` — is **demoted to optional**, built only if live round-trip shows DOM-inline ≠ source-literal drift (e.g. post-HMR staleness). Default v2 keeps DOM-authored: simpler, already live, no new HTTP surface.

2. **Vocabulary = Hybrid.** Friendly **section headers** (`TYPOGRAPHY` / `SPACING` / `SIZE` / `APPEARANCE`) with **CSS-named rows** inside (`color`, `font-size`, `padding`, `border-radius`). We do **not** rename properties to human labels (Fill/Corner/Size) — the section header carries the approachability, the row keeps the honest property name. Rationale: this is a designer tool whose users iterate on real TSX, so the row must name the actual property; the friendly grouping + named-token values are what make it legible to a non-technical user. (Rejected: full human-label translation — too lossy for a code-backed tool; raw-CSS-only — the v1 failure.)

3. **Curated tier ≈ 14 controls; everything else → the custom-attributes escape hatch.** The empirically-convergent "everyday 8" floor (Builder.io's 8 visual panels) **plus** width/height, gap, opacity, shadow, line-height:
   - **TYPOGRAPHY:** `color`, `font-size`, `font-weight`, `line-height`, `text-align`
   - **SPACING:** `padding`, `margin` (one nested box-model widget), `gap`
   - **SIZE:** `width`, `height`
   - **APPEARANCE:** `background-color`, `border-radius`, `border` (width+style+color), `box-shadow`, `opacity`
   - **Explicitly OUT → custom attributes** (recorded so it's a decision, not an omission): `display`, `position`, `top/right/bottom/left`, `transform`, `filter`, `backdrop-filter`, `letter-spacing`, `text-transform`, `max-width`/`min-*`, `overflow`, `z-index`, `transition`, `cursor`, blend modes, and any arbitrary property. `display` is the borderline one — kept OUT for v2 (block/flex/grid confuses non-technical users; `gap` degrades gracefully if the element isn't already flex/grid); reconsider later as a friendly "Layout: Stack / Row / Grid" select.

4. **Token-first via a per-field dropdown, reading `system/<ds>` tokens grouped by prefix.** Every token-able row defaults to picking a DS token; a raw value is the deliberate exception behind a "Custom…" entry. The dropdown lists the token family for the property (`color`→`--accent*`/`--fg-*`/`--bg-*`, spacing→`--space-*`, radius→`--radius-*`, size→`--type-*`/`--layout-*`, shadow→`--shadow-*`, border→`--border-*`, line-height→`--lh-*`), read from the **active canvas's** declared DS via the `canvasDesignSystems` map (DDR-093), and writes `var(--token)`. When an authored value equals a token, the field shows the **token name**, not the raw value. The **per-field visible dropdown** is chosen over Webstudio-style `--`-autocomplete because it's more discoverable for non-technical users (Webflow/Builder.io pattern) — autocomplete assumes the user knows variables exist.

5. **Two fenced escape hatches, collapsed/last/labeled, forgiving, with shadow-flagging.** The current single `RawKnob` becomes a demoted, last-in-panel **"Advanced"** disclosure containing **(a) custom CSS property** — "+ Add property" with property-name autocomplete + value, soft-warn (not hard-block) on unknown property, labeled "applied as-is, not token-bound", fully editable/removable; optional paste-a-CSS-block-that-auto-routes (Webstudio pattern — stretch) — and **(b) custom HTML attribute** — `data-*`/`aria-*`/`id` name/value pairs writing a real JSX attribute via `editAttribute`'s **non-`style.` path** (no new endpoint; `/_api/edit-css`'s `property` already maps to an `attr`). Any custom CSS property that **shadows** a curated control is flagged inline (the documented Plasmic failure mode where the visual control silently lies).

6. **Provenance is legible per row: token-bound / raw-override / inherited-default.** Adopt Webstudio's source-coloring idea (a small marker per row) so the user can tell whether a value is a bound token, a local raw override, or just the inherited/computed default. This pairs with decision 5's shadow-flag.

7. **This panel is a maude-DS surface → designed canvas-first, gated on critic ≥ 4.0 before porting.** The composition (token dropdowns, box-model widget, section rhythm, provenance, save-state, the two-hatch Advanced section, all states) is built first as a spec in `.design/ui/Studio.tsx` artboard E (inspector) + `Studio.css`, run through `/design:critic` (graphic + a11y + typography + signature-moment + copy) to ≥ 4.0, **then** ported to `app.jsx` `CssKnobs`. This is an acceptance criterion, not a nicety — the v1 failure came from free-handing JSX into the shell.

## Consequences

- **No new write endpoint.** Every curated row, the custom-CSS hatch, and the custom-HTML-attribute hatch all ride the existing main-origin-only `POST /_api/edit-css` → `editAttribute` (`style.<prop>` for CSS, bare `attr` for HTML attributes). The DDR-054 trust boundary and `canvas-origin-gate.test.ts` are unchanged. The only *possible* new surface (the optional `GET /_api/canvas-style` AST read) is read-only and gated behind a proven need.
- **Inline-style writes still win over class/token styling by specificity** (unchanged from DDR-103) — the new provenance markers make that legible instead of surprising.
- **`display` and the long tail are reachable but not curated** — a non-technical user gets a clean ~14-control surface; a power user drops into Advanced. If telemetry/feedback shows `display` is a common edit, promote it to a friendly Layout select (revisit, don't silently expand).
- **The port is bounded by the approved spec**, not invented in the shell — the critic gate is the contract between the canvas mock and `app.jsx`.

## Addendum — 2026-06-11 (post-critic user iteration)

After the spec passed the critic gate, the user reviewed it in-canvas and drove a round of `/design:edit` feedback (5 inline comments + one structural ask) that revises two earlier calls:

- **`display` is back IN — a curated `Layout` section was added** (the "reconsider later" path of decision §3 is now taken). `Layout` leads the panel (canonical section order) with `display`, `flex-direction`, `align-items`, `justify-content` (selects) + `gap` (moved out of `Spacing` — gap is a flex/grid property, not box-model). Curated tier is now ~19. `position`/`transform`/`filter`/etc. stay OUT → custom attributes.
- **Sections are collapsible** (each `.st-cp-sechd` is a disclosure button with `aria-expanded`).
- **`Typography` gains `font-family` + `letter-spacing`** (both were in the original OUT-list; promoted on request).
- **`border-radius` gains a per-corner split** (toggle → 4 corner inputs TL/TR/BL/BR), the same "destructure the shorthand into longhands" affordance the box-model already gives `padding`/`margin`. Implies the port writes `border-top-left-radius` etc. longhands when split.
- **The box-model's modifier-key hint chips (`⇧ all sides / ⌥ opposite / link sides`) were replaced** by one self-explanatory `link all sides` toggle + a plain-language hint — they read as jargon to the target user ("tomuhle moc nerozumím").
- **`is-zero` box-model values lifted `--fg-3`→`--fg-2`** so margin left/right (`auto`) are legibly present (the a11y/typography "empty-state dimming" lift, now also a usability fix).

The write-model invariants (DDR-103 inline `style={{}}`, main-origin endpoint, longhand writes for box-model/corners) are unchanged — this only widens the curated control set.
