/* _components.css — shared component anatomy (Phase 3.6.1 emit-conditionally).
 *
 * This file is OPTIONAL. The bootstrap scaffolder emits it when Q9 signature
 * treatment ≠ `none` AND the treatment repeats across 3+ components — at that
 * point promoting class anatomy out of per-specimen <style> blocks reduces
 * drift and makes critic-panel scans cleaner.
 *
 * Project-specific component classes (.btn / .tile / .input / etc.) are
 * authored by the scaffolder for the specific Q9 family. The MOTION ROLE
 * CLASSES below are the universally-shared piece — they ship verbatim
 * regardless of Q9 family, because the motion vocabulary is fixed at 8 roles
 * per DDR-049.
 */

/* ─────────────────────────────────────────────────────────────────────── */
/* Motion role classes — CSS-only escape hatch for the canvas-lib motion
 * vocabulary (Phase 3.7 / DDR-049). Use when a canvas wants the role
 * vocabulary without importing motion/react. The shape MUST stay in sync
 * with `<MotionDemo role>` in canvas-lib.tsx.
 *
 * Usage:  <div className="motion-flip">…</div>
 *         <div className="motion-soft">…</div>
 *
 * Each class is `animation: <kf> <dur> <ease> infinite alternate` so the
 * element loops on first paint (matching the canvas-lib helper's default
 * loop="always"). To opt out of the loop, set `animation-iteration-count: 1`
 * on the host or use `animation-play-state: paused`.
 *
 * Reduced-motion is enforced by the colors_and_type.css token collapse
 * (--dur-*: 1ms under prefers-reduced-motion: reduce) — these classes
 * inherit that for free.
 */

/* flip — press-down, hover lift. */
@keyframes motion-flip-kf {
  0% { transform: translateY(0); }
  100% { transform: translateY(-12px); }
}
.motion-flip {
  animation: motion-flip-kf var(--dur-flip, 220ms) var(--ease-out, ease-out) infinite alternate;
  overflow: hidden;
}

/* panel — drawer / sidebar slide. */
@keyframes motion-panel-kf {
  0% { transform: translateX(-80px); }
  100% { transform: translateX(0); }
}
.motion-panel {
  animation: motion-panel-kf var(--dur-panel, 320ms) var(--ease-in-out, ease-in-out) infinite alternate;
  overflow: hidden;
}

/* route — page transition (opacity + tiny scale). */
@keyframes motion-route-kf {
  0% { opacity: 0; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1); }
}
.motion-route {
  animation: motion-route-kf var(--dur-route, 480ms) var(--ease-out, ease-out) infinite alternate;
  overflow: hidden;
}

/* soft — toast / tooltip / soft reveal. */
@keyframes motion-soft-kf {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
.motion-soft {
  animation: motion-soft-kf var(--dur-soft, 160ms) var(--ease-out, ease-out) infinite alternate;
}

/* spring — tactile/playful settle. CSS spring approximation only — for
 * production spring fidelity, lift <MotionDemo role="spring" /> instead. */
@keyframes motion-spring-kf {
  0% { transform: translateY(0); }
  60% { transform: translateY(-20px); }
  78% { transform: translateY(-12px); }
  90% { transform: translateY(-16px); }
  100% { transform: translateY(-14px); }
}
.motion-spring {
  animation: motion-spring-kf var(--dur-panel, 320ms) cubic-bezier(0.34, 1.56, 0.64, 1) infinite alternate;
  overflow: hidden;
}

/* scroll — scroll-progress-bound entry. CSS-only fallback; real scroll-link
 * needs JS (motion/react useScroll). */
@keyframes motion-scroll-kf {
  0% { transform: translateX(0); }
  100% { transform: translateX(24px); }
}
.motion-scroll {
  animation: motion-scroll-kf var(--dur-route, 480ms) var(--ease-in-out, ease-in-out) infinite alternate;
  overflow: hidden;
}

/* drag — pick-up + release rotational settle. CSS-only fallback. */
@keyframes motion-drag-kf {
  0% { transform: rotate(0); }
  50% { transform: rotate(4deg); }
  100% { transform: rotate(0); }
}
.motion-drag {
  animation: motion-drag-kf var(--dur-flip, 220ms) var(--ease-out, ease-out) infinite alternate;
  overflow: hidden;
}

/* presence — sparkle / pulse. Demo on ≤56px elements ONLY (bounded geometry —
 * a full-width tile pulsing scale: 0→1 will overflow adjacent rows). */
@keyframes motion-presence-kf {
  0% { opacity: 0; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}
.motion-presence {
  animation: motion-presence-kf var(--dur-soft, 160ms) var(--ease-out, ease-out) infinite alternate;
  overflow: hidden;
  /* Bounded-geometry guard — the class is intended for elements ≤56px.
   * Sites that violate this earn a motion-critic blocker. */
  max-width: 56px;
  max-height: 56px;
}

/* Honor explicit data-reduced-motion toggle (specimen chrome) AND the
 * standing OS-level prefers-reduced-motion (the token collapse already
 * neutralises the durations; the JS-set attribute is for inspection symmetry). */
:root[data-reduced-motion="true"] [class*="motion-"] {
  animation: none !important;
}
