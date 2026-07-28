# DDR-046: canvas chrome — three-state halo language (hover / selected / group) + marquee as the fourth idiom

- **Date:** 2026-05-26 (rev 1) · 2026-05-26 (rev 2 — dashed clarified as group-container signal)
- **Status:** Accepted (rev 2)
- **Tags:** design, canvas-lib, dev-server, canvas-shell, snap-guides, halo, visual-identity, phase-canvas-figjam-feel
- **Related:** [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md), [DDR-026](./DDR-026-universal-canvas-input-grammar.md), [DDR-028](./DDR-028-snap-tolerance-in-world-units.md), [`.ai/plans/canvas-figjam-feel.md`](../plans/canvas-figjam-feel.md)

## Context

Phase 4 + DDR-026 shipped a single universal canvas grammar with `position: fixed` overlays for hover, selection, group-bbox, snap guides. The visual layer was pragmatic — one `2px solid var(--accent)` line covered every state. Once we lit up multi-select, snap math, annotation chrome, mini-map viewport indicators and the active-artboard ring, the canvas surface was carrying 8+ semantic states (hover / selected / member-of-multi / group bbox / snap-sibling / snap-grid / marquee / annotation-selected / mini-map-viewport / lock-banner) through one undifferentiated visual idiom. The user-visible result: the canvas "feels nevýrazné" — every chrome line reads the same regardless of meaning.

The design-critic pass on `Canvas Viewport.tsx` (the spec) vs. `canvas-shell.tsx` (the implementation) named this as Blocker #1: the spec defines a layered visual language (filled corner ticks for selection, dashed marquee, dotted grid guides, magenta snap pills) that the implementation collapsed into one line. The ux-research-agent's `synthesized_pattern_reference` confirms across Figma / FigJam / tldraw / Excalidraw / Whimsical that the canonical chrome stack uses dual-stroke differentiation (1 px vs 2 px), tinted-vs-solid color (50 % vs 100 %), and a distinct geometric idiom per state (filled ticks vs dashed border vs dotted line vs pill callout). Without that layering the canvas reads as a single-state wireframe.

## Decision

**The canvas chrome layer uses a four-state visual language. Each state has its own border weight, opacity, color treatment, and geometric idiom. Painting a state with another state's idiom is a regression.**

| State | Border | Color treatment | Extra idiom | Class |
| ----- | ------ | --------------- | ----------- | ----- |
| **Hover** | `1.5 px solid` | `color-mix(in oklab, var(--accent) 60%, transparent)` | `inset 0 0 0 1px var(--bg-0)` — white inner ring for contrast on dark elements | `.dc-cv-halo--hover` |
| **Selected (single)** | `2 px solid var(--accent)` | full accent | `box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent)` ring + four `8 × 8` filled-accent corner ticks at `inset: -3px` | `.dc-cv-halo--selected` + four `<i class="tick tick-tl/tr/bl/br" />` children |
| **Selected (member of multi)** | `1.5 px solid var(--accent)` | full accent (no tint — opacity weakens the signal once the group bbox carries the container affordance) | no ring, no ticks (group bbox carries the loud signal) | `.dc-cv-halo--selected-member` |
| **Group bbox** | `1 px dashed var(--accent)` | full accent | union bbox of all selected members + four `6 × 6` filled-accent square corner handles at `inset: -3px` (smaller than single-select ticks — "thinner authority") | `.dc-cv-group-bbox` |

**Why dashed for group, solid for selection.** Dashed = "ambient grouping affordance" — the user reads "these things are bound together" without the dashed border claiming subject-ness. Solid = "this thing is the active subject of my edit." Every direct-manipulation tool reaches for the same vocabulary (Figma group bbox, FigJam Section drag-state, Photoshop selection "marching ants"). Members carry the full-opacity solid outline so each one reads as individually selected; the dashed dashed bbox above them reads as the *container* of the selection.

**Fifth idiom — marquee** (active gesture, visually distinct from group-bbox): `1 px solid var(--accent)` border + `color-mix(in oklab, var(--accent) 8%, transparent)` fill (translucent so content reads through). `border-radius: 0`. Class `.dc-cv-marquee`. Solid (not dashed) because marquee is an **active gesture** the user is currently dragging — dashed is reserved for the **persistent multi-select state** (the group bbox above). Both are "container" affordances semantically, but the visual idioms split: gesture = solid + tinted-fill, persistent state = dashed-outline.

**Snap guides** (separate layer — `SnapGuideOverlay`) get their own color family per [DDR-046-supplement: snap chrome](./DDR-046-canvas-chrome-three-state-halo-language.md#snap-chrome-supplement):

| Sub-state | Line | Distance pill |
| --------- | ---- | ------------- |
| Sibling snap | `2 px solid var(--guide-magenta)` + `box-shadow: 0 0 4px color-mix(in oklab, var(--guide-magenta) 35%, transparent)` glow | `Δ{Math.round(delta)}` at midspan when `|span| > 60 px`. `11 px` mono, white on magenta, `2 px 6 px` padding, `2 px` radius. |
| Grid snap | `2 px solid color-mix(in oklab, var(--fg-3) 40%, transparent)` — lighter gray | no pill |

`--guide-magenta` is a NEW token. Default `oklch(62% 0.28 350)` (FigJam magenta in the project's OKLCH space). Lives in `ENGINE_CSS` `:root`. Distinct from `--accent` so the snap layer never melts into the selection halo.

**Spawn animations** for the chrome layer:

- Hover paint: synchronous, no debounce, no fade-in. Disappear synchronous. (Hover with debounce reads as "tool thinking" per research anti-pattern #5.)
- Selected halo: 60 ms opacity fade-in on mount, 60 ms fade-out on unmount. Match existing `transition: opacity 60ms linear`.
- Snap guide: `@keyframes snap-spawn { from { opacity: 0; transform: scaleY(0.92); } to { opacity: 1; transform: scaleY(1); } }` over `80 ms cubic-bezier(0.2, 0.8, 0.2, 1)` on mount. Fade-out 160 ms ease-out on unmount.
- Distance pill: synchronous (it follows the guide; animating both is noise).
- `prefers-reduced-motion`: collapse all chrome animations to `1 ms`. Honored at the keyframe level via `@media (prefers-reduced-motion: reduce)`.

**Floating chrome shadow contract.** A separate contract layered on this DDR: all floating overlays (mini-map, tool palette, zoom HUD, contextual toolbar, popovers, export dialog, comment composer) use `box-shadow: 0 6px 24px color-mix(in oklab, var(--fg-0) 10%, transparent)` + `border-radius: 8px`. The brutalist `4 × 4 × 0 var(--fg-0)` hard offset stays on **app shell chrome only** (menubar, header, tab strip, file tree) — the project's deliberate visual identity per the DS palette. Mixing the two on the same element is a regression.

## Consequences

**Positive.**

- 8+ semantic states become visually distinguishable. The user reads "selected" vs "snap" vs "marquee" vs "group" without parsing color alone.
- `--guide-magenta` separates snap from selection in color space, so the two layers never visually compete during a drag-and-snap gesture.
- The distance pill (`Δ34`) is the single biggest visible upgrade — the ux-research-agent calls it out as THE differentiator between "professional" and "school-project tier" tools (Figma + tldraw v3.3+ have it; Excalidraw / early tldraw don't).
- Floating-vs-shell shadow contract clarifies that the brutalist hard offset belongs to the **app frame** not to the **interactive surface** — the project's "brutalist mark on a floating-soft world" identity reads cleanly.
- The four-state language is extensible. When draw-tool selection (Phase 5) and annotation chrome (Phase 5.1) need their own halo idioms, they slot in as new rows in this table rather than reusing one of the existing four states.

**Negative / accepted trade-offs.**

- Five `position: fixed` overlay components instead of one. The rAF cost is linear in selection-set size + active guides + members. At realistic limits (≤ 64 selected elements, ≤ 4 simultaneous guides) this is well under 1 ms/frame on the dev-server's target hardware.
- The corner-tick inner `<i>` children inside each `.dc-cv-halo--selected` make the SelectionHalos render loop slightly more expensive — reusing the existing `child = document.createElement('div')` slot with appended `<i>` children adds 4 DOM nodes per selection. Acceptable; alternative (single `::before/::after` synth) would only reach 2 ticks.
- The `--guide-magenta` token in OKLCH must be defined in every downstream `.design` project that overrides `--accent`. Fallback chain `var(--guide-magenta, oklch(62% 0.28 350))` ensures the default works without a project-side declaration.

## Alternatives considered

1. **Color-only differentiation (keep one border weight; vary only color).** Rejected — colorblind users would lose all signal. The 1.5 px vs 2 px vs 1 px weight is the primary discriminator; the opacity / hue is secondary.

2. **Dashed border reserved for none — rev 1's choice (~~superseded by rev 2~~).** rev 1 banned dashed entirely as "work-in-progress / draft" idiom that would clash with the brutalist DS direction. That was wrong. Every direct-manipulation reference (Figma, FigJam, Photoshop, Illustrator, Affinity) uses dashed for the **group-container** affordance precisely because it reads as "ambient binding, not active subject." Treating dashed as taboo collapsed multi-select chrome back to one weight + one color, defeating the whole DDR. Rev 2 restores dashed as the canonical Group bbox idiom while keeping single-select solid (subject) and marquee solid + filled (active gesture). The DS brutalist direction is honored on **chrome SHADOW + RADIUS** (hard 4×4×0 offset + 0-radius on app shell), not on selection-chrome stroke style — those are different axes.

3. **Per-element class stamping (CSS class on the actual element, not a fixed overlay).** Rejected per DDR-026 — CSS `zoom` on the world plane scales a 2 px outline to subpixel at low zoom. Position-fixed overlays reading `getBoundingClientRect()` per rAF tick keep the chrome at constant CSS pixel weight.

4. **Match Figma's blue (#0d99ff) for selection accent and FigJam's purple (#a259ff) for hover.** Rejected — the project's DS sets `--accent` itself (often a deep amber-rust or other domain-specific hue). Hardcoding Figma blue would override the project's brand voice. Instead we use the project's `--accent` for selection and a tint-mixed variant for hover, and reserve `--guide-magenta` for the one place where a contrasting hue is functionally required (snap layer distinct from selection layer).

## Implementation notes

- `HALO_CSS` template literal in `canvas-shell.tsx` is the single source for the four-state CSS. The shell-side duplicate (`client/styles/3-shell.css:872-896` `.sel-halo`) is dead per DDR-026 and gets reconciled (deleted) in this phase too.
- `SelectionHalos` (`canvas-shell.tsx:657-714`) appends 4 `<i class="tick tick-*">` children to each selected halo node. When `selected.length > 1`, the halo node's class switches to `.dc-cv-halo--selected-member` (no ticks), and `GroupBbox` paints the loud signal.
- `SnapGuide` (`use-snap-guides.tsx:43-50`) gains optional `delta?: number` and `kind?: 'grid' | 'sibling'` fields. `computeSnap` populates both. The pure-function contract from DDR-028 (no DOM, no React) is preserved.
- `--guide-magenta` is declared in `ENGINE_CSS` (`canvas-lib.tsx`) — the single source for `.dc-canvas`-scoped tokens. Per-project override is via the same cascade as `--accent`.
- `prefers-reduced-motion` is honored at the `@keyframes` level: `@media (prefers-reduced-motion: reduce) { .dc-cv-snap-guide { animation: none !important; } .dc-cv-halo, .dc-cv-group-bbox { transition: none !important; } }`.

## Acceptance check

- `bun test plugins/design/dev-server/__tests__/snap-distance-pill.test.ts`: grid delta + sibling-beats-grid fixtures green.
- `bun test plugins/design/dev-server/`: 351 / 351 baseline preserved.
- `/design:browse` on a project with 2+ canvases: hover paints 1.5 px tinted line + white inner ring; click selects with 2 px solid + ring + 4 corner ticks; Cmd+Shift+click adds a 1 px-tinted member with the group bbox carrying the bold signal.
- Drag an artboard near a sibling 34 px away: 2 px magenta snap guide appears with `Δ34` mid-span pill, glow halo readable at any zoom ≥ 0.35.
- `grep -rn '4px 4px 0 var(--fg-0' plugins/design/dev-server/`: no results on floating chrome (mini-map, tool palette, zoom HUD, popovers, export dialog, contextual toolbar, comment composer). Hits on app-shell chrome are expected and acceptable.
- `prefers-reduced-motion` media query collapses all chrome animations to 1 ms; visible via Chrome DevTools "Emulate CSS prefers-reduced-motion: reduce".
