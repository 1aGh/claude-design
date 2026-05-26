# Motion specimen — author notes

> A cold-reader's guide to `motion.tsx` + `motion.css`. Lives alongside the specimen so a future Claude opening this folder can answer "why is this file shaped this way?" without grepping the plan archive.

## The 8 roles

The canvas-lib `<MotionDemo role>` accepts a fixed 8-value union. Each role binds to a DS duration + easing token from `colors_and_type.css`:

| Role | Token | Easing | Use when |
| --- | --- | --- | --- |
| `flip` | `--dur-flip` (~220 ms) | `--ease-out` | Press-down, hover lift, single-card flip. Smallest, snappiest. |
| `panel` | `--dur-panel` (~320 ms) | `--ease-in-out` | Drawer, sidebar, segmented control transitions. |
| `route` | `--dur-route` (~480 ms) | `--ease-out` | Page / route transitions. Opacity + tiny scale. |
| `soft` | `--dur-soft` (~160 ms) | `--ease-out` | Toast, tooltip, soft fades. Fastest. |
| `spring` | `--dur-panel` | `spring` | **Use only when the brief asks for tactile / playful / bouncy.** Springs say "Toy" by default. |
| `scroll` | `--dur-route` | `--ease-in-out` | Scroll-progress-bound entries (parallax hint, on-scroll reveals). |
| `drag` | `--dur-flip` | `--ease-out` | Pick-up + release rotational settle for draggables. |
| `presence` | `--dur-soft` | `--ease-out` | The sparkle / pulse / twinkle. **Demo on 32×32 chips only.** Setting `small={true}` enforces the bounded size. |

## The loop policy

Every role defaults to `loop="always"` with `repeatType: 'reverse'`. **Initial paint = full motion vocabulary playing.** No hover required.

Why: the studyfi imprint retro caught a hover-driven specimen that looked dead at rest. Reviewers (rightly) assumed the DS had no motion. The fix isn't more documentation; it's making the specimen self-evident at first paint.

`loop="hover"` is reserved for canvases that mock real product chrome where a constant loop would be visually noisy. `loop="once"` is for one-shot reveals (rare in specimens; common in real components).

## The bounded-geometry rule

Every `<MotionDemo>` root has `overflow: hidden` set inline by the canvas-lib component itself. This is non-negotiable and intentionally hard to bypass.

The reason: a 32×32 chip rotating 45° has a bounding box of ~45×45. A tile rotating to 45° has a bounding box of ~√2× its width and overflows adjacent rows. The studyfi imprint retro D-3 was caused by a sparkle keyframe (`scale: 0 → 1 → 0`) applied to a full-width tile — the chip itself was fine, but the chrome's `overflow: visible` let the scale ripple out of the row.

If a canvas legitimately needs visible overflow (e.g. an asymmetric brand mark that bleeds intentionally), it composes outside `<MotionDemo>` — not by removing the clip.

## The reduced-motion contract

Two layers:

1. **CSS** — `colors_and_type.css` collapses every `--dur-*` to `1ms` under `@media (prefers-reduced-motion: reduce)`. This is the canonical layer; any canvas-lib helper that reads the live token value inherits the collapse for free.
2. **JS** — `<MotionDemo>` calls `useReducedMotion()` from `motion/react` and short-circuits the `animate` prop. Belt-and-suspenders for a hard a11y invariant; the cost is one boolean check per render.

The motion specimen is the documented exception. `<ReducedMotionToggle>` flips `data-reduced-motion="true"` on `<html>` so reviewers can eyeball both branches without OS settings. **No other specimen ships this toggle.**

## The handoff path

Per DDR-049: a canvas that imports `<MotionDemo>` or any sibling motion helper from `@maude/canvas-lib` gets `"motion": "^11"` declared in its `registry-item.json` dependencies block at `/design:handoff` time. The motion primitives are inlined as `type: "registry:component"` entries in `files[]`; the consumer's TSX imports them from a relative path. No `@maude/canvas-lib` reference survives.

`bunx shadcn add file:///path/to/canvas.registry.json` in a scratch Next.js project pulls `motion` from npm, drops the primitives inline, and the canvas animates with zero manual wiring.

## Critics that watch this specimen

- **`motion-critic`** — auto-routed when `motion.tsx` exists, regardless of `--opt-out=motion` scope. Validates: bounded geometry, compositor-only properties, loop policy (`infinite alternate` for "always" roles), reduced-motion handling, role-vocabulary fidelity.
- **`design-system-completeness-critic`** — adds two Phase 3.7 checks: (1) motion specimen renders without console errors; (2) every `--dur-*` token defined in `colors_and_type.css` is referenced at least once by the motion specimen (the "orphan token" check).
- **`design-system-keeper`** — when auditing a non-specimen canvas, greps for `@keyframes` literals that match a canvas-lib role; warns "pattern reinvention — lift `<MotionDemo role='…'>` instead". ≥3 warnings on a single canvas promotes to blocker.

## Cross-links

- Library source: `plugins/design/dev-server/canvas-lib.tsx` (`MotionDemo`, `MotionTrack`, `TokenPlayback`, `ReducedMotionToggle`, `useMotionTokens`, `easingFromToken`)
- Library decision: `.ai/decisions/DDR-049-motion-one-as-canonical-motion-library.md`
- Sub-agent safety block: `plugins/design/templates/design-system-inspiration/SUB-AGENT-PROMPTS.md` → ANIMATION SAFETY
- Tokens: `colors_and_type.css.tpl` (lines around `--dur-*` + `--ease-*`)
- CSS escape hatch: `_components.css.tpl` (`.motion-flip`, `.motion-panel`, ... `.motion-presence`)
