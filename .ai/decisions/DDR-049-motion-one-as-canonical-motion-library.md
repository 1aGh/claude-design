# DDR-049 — Motion One (`motion/react`) is the canonical motion library; CSS-only is an opt-in escape hatch

**Status:** Accepted — 2026-05-26.
**Supersedes:** none.
**Related:** [DDR-019](DDR-019-canvas-tsx-format.md) (canvas TSX format — motion specimens become TSX too), [DDR-025](DDR-025-canvas-lib-single-source-in-dev-server.md) (canvas-lib is the one place motion helpers live), [DDR-043](DDR-043-bias-free-design-plugin-templates.md) (motion tokens stay generic — placeholders, no priors), [DDR-021](DDR-021-design-smoke-gate-for-infra-and-bulk-ui-work.md) (smoke gate carries the new motion specimen).

## Context

Pre-Phase-3.7 motion in the maude design plugin had three structural gaps:

1. **No canonical library.** The dev-server's `canvas-lib.tsx` has a `prefers-reduced-motion`-guarded `animateTo` hook for pan/zoom, but no exposed motion primitives for canvases. Every motion-using canvas re-invents `@keyframes` literals in inline `<style>` blocks.
2. **No AI-readable vocabulary.** Sub-agent prompts list "demo sparkle" alongside "fade-in / slide-in / zoom-in" as uniform demos, so an agent that has never seen the actual rendered output ships sparkle keyframes on full-width tiles (BAD-3 in the studyfi imprint retro `imprint-bootstrap-review-2026-05-26.md` D-3). There's no library export that encodes "sparkle is for ≤56px elements".
3. **No production handoff parity.** `/design:handoff` emits a `registry-item.json` for `bunx shadcn add`-style consumption. Shadcn registry items in 2026 routinely declare `"motion"` as a dependency. A handed-off canvas using inline `@keyframes` works (CSS travels), but anything fancier (orchestrated entry sequences, scroll-linked, drag-spring) needs a runtime the target project already has. Without a canonical library declared in the canvas-lib peer-dep set, the handed-off component is "production-ready" only in the structural sense.

The downstream effect was a `/design:setup-ds` retro that landed 2 fix-passes on the motion specimen alone (sparkle overflow + a relative-URL asset bug adjacent to it) and three "visual sanity skipped — would have caught both" calls.

## Decision

**Adopt Motion One (`motion`, the npm package, imported via `motion/react`) as the canonical motion library for the design plugin's canvas-lib + handoff pipeline.** Canvases that want zero JS dep keep a CSS-only escape hatch via shared `_components.css` role classes (`.motion-flip`, `.motion-panel`, etc.).

Five coordinated rules:

1. **Library choice — Motion One.**
   - `motion` (npm), import surface `motion/react`. ~10 KB gz vs framer-motion's ~30 KB. Native React 19. Same author as framer-motion (Matt Perry). 100% API-compatible with framer-motion v11+ so any sub-agent that has framer-motion in its training data writes valid code by default. Spring + tween + keyframes + layout + presence + scroll-linked + drag — full surface, not a subset.
   - Declared as a **peer dep** of `@maude/canvas-lib` (the dev-server's canvas-lib package). Canvases that import a motion helper get the dependency declared in handoff's `registry-item.json` automatically.

2. **Canvas-lib exports the role vocabulary.** New exports from `plugins/design/dev-server/canvas-lib.tsx`:
   - `<MotionDemo role>` — 8 roles (flip, panel, route, soft, spring, scroll, drag, presence). Each role maps to `{ duration: --dur-*, easing: --ease-* }` token + a bounded keyframe set. Default `loop="always"` so the specimen shows motion on first paint (closes the "looks dead until you hover" failure mode).
   - `<MotionTrack>` — staggered row container.
   - `<TokenPlayback>` — single-shot replay chip; click to fire.
   - `<ReducedMotionToggle>` — UI toggle that mirrors `prefers-reduced-motion: reduce` for in-browser inspection without OS settings.
   - `useMotionTokens()` — reads `--dur-*` from `getComputedStyle(document.documentElement)`; ms → number.
   - `easingFromToken(token)` — maps `--ease-out`/`--ease-in-out`/`--ease-in` → motion-one `cubicBezier(...)` value, or returns the string `"spring"` for spring roles.

3. **`<MotionDemo>` is reduced-motion-aware by construction.** Every helper short-circuits to a no-op transition when `useReducedMotion()` from `motion/react` returns true. The DS contract (the existing `--dur-*: 1ms` collapse in tokens for `prefers-reduced-motion: reduce`) becomes programmatically enforced, not just CSS-best-effort.

4. **CSS escape hatch — `_components.css` role classes.** For canvases that legitimately need zero JS deps (static heroes, single hover transition, accessibility-first marketing pages), `_components.css` ships 8 matching role classes — `.motion-flip`, `.motion-panel`, `.motion-route`, `.motion-soft`, `.motion-spring`, `.motion-scroll`, `.motion-drag`, `.motion-presence`. Same token bindings, same bounded keyframes, no JS. A canvas opts into the vocabulary with `<div className="motion-flip">` without importing `motion/react` — `motion-one` is tree-shaken away by Bun.build's dead-code elimination when no helper is imported.

5. **Handoff inlines motion primitives, declares `motion` in dependencies.** When `/design:handoff` emits a `registry-item.json` for a canvas that imports a motion helper from `@maude/canvas-lib`:
   - `motion-demo.tsx` is inlined into `files[]` as a `type: "registry:component"` entry. The consumer's TSX still imports from a relative path (matches how shadcn handles its own primitive layer).
   - `"motion"` (`^11`) and `"react"` (`^19`) are declared in `dependencies`.
   - **No `@maude/canvas-lib` references survive into the registry-item output** — the consumer doesn't have that package and shouldn't need it.
   - Result: `bunx shadcn add file:///path/to/canvas.registry.json` in a scratch Next.js project pulls `motion` from npm, drops `motion-demo.tsx` inline, and the canvas animates with zero manual wiring.

## Decision table

| Surface | Before | After |
|---|---|---|
| Canvas motion primitive | inline `@keyframes` per specimen | `<MotionDemo role="flip" />` from `@maude/canvas-lib` (or `.motion-flip` CSS class) |
| Specimen first paint | hover-driven; looks dead at rest | continuous `infinite alternate` loop; visible from frame 1 |
| AI-readable vocab | none (sub-agent prompt lists demo names) | 8 named roles with bounded geometry codified in canvas-lib types |
| Reduced-motion | `--dur-*: 1ms` CSS collapse only | CSS collapse + `useReducedMotion()` short-circuit in JS path |
| Bundle weight (motion-using canvas) | 0 KB (CSS-only) | ~10 KB gz (motion-one), tree-shaken when unused |
| Handoff motion declaration | `@maude/canvas-lib` opaque to consumer | `"motion": "^11"` in `registry-item.json` dependencies, primitives inlined |
| Token coverage check | none | `design-system-completeness-critic` asserts every `--dur-*` token referenced by motion specimen |
| Specimen-presence auto-route | `motion-critic` opt-in via `--agent` | `motion-critic` always queued when `motion.tsx` exists |

## Alternatives considered

| Option | Why not |
|---|---|
| **Framer-motion** (`framer-motion` npm) | Predecessor of motion-one by the same author. Larger bundle (~30 KB gz vs 10 KB). Slower to ship React 19 support. Motion-one's API is 100% framer-compatible — same training-data hit rate for sub-agents, smaller cost. |
| **GSAP / ScrollTrigger** | Imperative API, larger bundle (~40 KB minified), commercial license tail for some plugins. Overkill for design-time specimens. Excellent for production hero animations — out of scope for the design plugin's canvas-lib. |
| **CSS-only via `@keyframes` literals + role classes** | Kept as the escape hatch (Rule 4). Cannot express orchestration / springs / scroll-linked / drag-spring with parity. Would force every canvas with non-trivial motion to ship hand-rolled JS regardless — defeats the "one canonical library" goal. |
| **Web Animations API (`element.animate()`)** | Native, zero dep, but no orchestration primitives, no `<AnimatePresence>` analog, no spring presets, less helpful debugging. Considered for the `useMotionTokens` parsing helper internally; not the canvas-facing API. |
| **No library — keep `@keyframes` everywhere + improve the sub-agent prompt** | The original gap. Cannot codify "sparkle is ≤56px only" as a TypeScript type. Cannot pass typed roles between sub-agents. Pattern-reinvention warnings from `design-system-keeper` would have to grep CSS literals indefinitely. Loses production handoff parity (the deciding factor). |

**Deciding factor: production handoff parity.** Shadcn / v0 / Lovable / Next.js consume `motion` as a peer dep. Bundling motion-one with canvas-lib AND declaring it in handoff manifests means "drop the registry-item, run `bunx shadcn add`, animations work" with zero manual wiring. Framer-motion was the previous default; motion-one is its successor by the same author, same API. Choosing motion-one = future-proof + smaller + faster.

## Consequences

**Positive:**

- **One vocabulary for the loop and the handoff.** A sub-agent prompted with "use `<MotionDemo role='panel'>`" cannot ship sparkle-on-tile because the role's keyframe set is bounded. Pattern-reinvention warnings from `design-system-keeper` can grep `@keyframes` literals and match them against the canvas-lib role table — concrete, not heuristic.
- **Handoff stops shipping silently-static "production-ready" components.** A motion-using canvas drops into Next.js + shadcn and animates without further work.
- **Reduced-motion contract is enforced in two places.** CSS `--dur-*: 1ms` collapse for the static path + `useReducedMotion()` short-circuit for the JS path. Belt-and-suspenders is appropriate for the a11y invariant.
- **Same-author API stability.** Matt Perry's track record: framer-motion's API is stable across minor versions; motion-one inherits that discipline. Risk of churn is low.

**Negative / mitigated:**

- **~10 KB gz peer-dep added to canvas-lib's surface.** Mitigation: peer-dep declaration (consumer's npm de-duplicates). Tree-shaken away from canvases that don't import a motion helper. The "Performance budgets" gate in the phase plan caps the delta at <12 KB gz for a motion-using canvas vs. baseline.
- **Two motion vocabularies cohabit (JS via helpers + CSS via `_components.css` classes).** Mitigation: both bind to the same 8 role names + same token table, so the vocabulary at the brief level is unchanged. The choice is purely a "do I want JS?" question per canvas.
- **`motion-critic` becomes always-on alongside `a11y-critic` when `motion.tsx` exists.** Mitigation: ~30s cost per scaffold. Acceptable per the imprint retro (motion was the highest-friction surface; 2 of 4 bad divergences happened there).
- **`SUB-AGENT-PROMPTS.md` adds maintenance surface** (the new ANIMATION SAFETY block must stay in sync with `motion-critic` rules). Mitigation: completeness-critic's token-coverage check + the new `motion-critic` `motion.tsx` presence-route asserts the two stay in lockstep.

## Open questions

- **Page-level orchestration via `<LayoutGroup>` / `<AnimatePresence>` at the canvas-shell tab level** is deferred to Phase 5+ (canvas-tab transitions). The canvas-lib helpers are per-canvas only for now.
- **Lottie / Rive integration** stays out of scope. Both are useful for hero pieces but break the "token-driven, AI-readable" invariant — the lottie JSON is opaque to graphic-design-critic and motion-critic.
- **Sub-agent prompts in `SUB-AGENT-PROMPTS.md` may drift from `SKILL.md`** as the skill evolves. Tracked in this phase's risk register; a CI grep check "SKILL.md must reference SUB-AGENT-PROMPTS.md by exact filename" is the mitigation.

## Enforcement addendum (2026-05-28)

DDR-049 declared the policy but generation didn't enforce it: a `/design:setup-ds`
run shipped a `motion.tsx` specimen that was 100% hand-rolled `@keyframes` (zero
`@maude/canvas-lib`), directly violating the MUST in `SUB-AGENT-PROMPTS.md`. RCA:
[`.ai/logs/rca/hmr-inlined-css-dropped.md`](../logs/rca/hmr-inlined-css-dropped.md)
(Part 2). The decision is unchanged; enforcement is now tightened:

1. **One authoritative contract.** `skills/design-system/SKILL.md` → "Animation
   tooling contract" is the single source of truth (default = `<MotionDemo>`;
   `.motion-*` = justified-only escape hatch; never reinvent role keyframes).
   `commands/new.md`, `SUB-AGENT-PROMPTS.md`, `agents/motion-critic.md` now link
   it instead of restating partial rules.
2. **One verb — MUST, for specimens and canvases alike.** `new.md` changed from
   "SHOULD prefer" to MUST.
3. **Fail closed at scaffold.** `/design:setup-ds` step 7.5 greps the generated
   `motion.tsx` for the canvas-lib import + `<MotionDemo>`/`<MotionTrack>`; a
   pure-CSS specimen is regenerated or must be logged in the DS bypass log.
4. **`motion-critic` blocks at 1 occurrence in `motion.tsx`** (the teaching
   artifact), keeping the ≥3-reinvention threshold for ordinary canvases.

Note: the HMR fix in the same RCA (Part 1 — module-inlined sibling CSS now
triggers a module reload via `hmr-broadcast.ts classifyChange`) is a prerequisite
for the escape-hatch path to be observably editable in the browser at all.

## Cross-links

- RCA (this addendum's origin): [`.ai/logs/rca/hmr-inlined-css-dropped.md`](../logs/rca/hmr-inlined-css-dropped.md)
- Phase 3.7 plan: [`.ai/plans/phase-3.7-setup-ds-hardening-and-motion-subsystem.md`](../plans/phase-3.7-setup-ds-hardening-and-motion-subsystem.md)
- Source retro: [`.ai/logs/system-reviews/imprint-bootstrap-review-2026-05-26.md`](../logs/system-reviews/imprint-bootstrap-review-2026-05-26.md) (divergences D-3, D-4 + improvement actions §3)
- Flow plugin motion rules (parallel discipline, must stay consistent): `plugins/flow/skills/motion-rules/SKILL.md`
- Motion One docs: <https://motion.dev/docs>
- Motion One bundle-size analysis: <https://motion.dev/blog/motion-one-bundle-size>
- Framer-motion → motion migration guide: <https://motion.dev/docs/migrate-from-framer-motion>
