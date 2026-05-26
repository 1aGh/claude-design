/**
 * @canvas      motion — motion vocabulary (Phase 3.7 / DDR-049 playground).
 *              8 role tiles looping on first paint, 4 token-derived playback
 *              chips, 2 easing-curve SVGs derived from token cubic-bezier
 *              control points. Reduced-motion toggle for in-browser
 *              inspection without OS settings.
 * @ds          {{ds_dirname}}
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.motion / {{project_label}}
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/motion/
 * @handoff     bunx shadcn add file://./motion.registry.json
 *
 * SPECIMEN: motion
 * DEMONSTRATES: --dur-flip · --dur-panel · --dur-route · --dur-soft ·
 *               --ease-out · --ease-in-out · prefers-reduced-motion guard ·
 *               <MotionDemo role> 8-role vocabulary · TokenPlayback chips
 * COMPOSITION: 8 role tiles looping always · 4 token chips · 2 curve SVGs ·
 *              reduced-motion toggle · inline a11y note
 * COPY VOICE: role-named ("Flip", "Panel slide", "Route enter", ...)
 * WHEN SCAFFOLDED: always (Core, gated on motion ∈ activeFamilies which is
 *                  default-on)
 *
 * BOUNDED GEOMETRY (ANIMATION SAFETY, SUB-AGENT-PROMPTS.md):
 *   Every <MotionDemo> root has overflow: hidden inline (set in canvas-lib).
 *   Sparkle / pulse / twinkle keyframes (scale 0→1→0) are demonstrated ONLY
 *   on the 32×32 sparkle chip inside the "presence" tile — NEVER on the full
 *   tile. The bounding box of a rotating element extends √2× at 45°; tile
 *   chrome would overflow without the explicit clip.
 *
 * REDUCED-MOTION:
 *   <ReducedMotionToggle/> on the chrome row flips data-reduced-motion="true"
 *   on <html>. The motion specimen is the documented exception to the
 *   OS-level prefers-reduced-motion contract — reviewers need both branches
 *   visible side-by-side. <MotionDemo> programmatically short-circuits its
 *   animate prop when useReducedMotion() returns true (the contract is
 *   enforced in two places: CSS --dur-*: 1ms collapse + JS short-circuit).
 */
import "../colors_and_type.css";
import "./_layout.css";
import "./motion.css";
import {
  MotionDemo,
  MotionTrack,
  TokenPlayback,
  ReducedMotionToggle,
  useMotionTokens,
} from "@maude/canvas-lib";

export default function Motion() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MDCC-DSN/01.motion</span>
        <span className="crumbs">{{project_label}} · motion vocabulary · 8 roles · 4 tokens</span>
        <span className="theme-toggle-slot">
          <ReducedMotionToggle />
        </span>
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Motion</h1>
          <p className="lede">
            Eight roles. Four durations × two eases. Every animation in the
            system maps to one role; <code>&lt;MotionDemo role="…"&gt;</code>{" "}
            from <code>@maude/canvas-lib</code> is the only legal authoring
            surface (CSS-only escape hatch via <code>.motion-*</code> classes).
            Roles loop on first paint — hover not required.
          </p>
        </section>

        <section className="motion-roles">
          <h2>Roles</h2>
          <div className="motion-grid">
            <RoleTile name="Flip" role="flip" token="--dur-flip" ease="--ease-out" note="Press-down, hover lift, single-card flip." />
            <RoleTile name="Panel slide" role="panel" token="--dur-panel" ease="--ease-in-out" note="Drawer / sidebar / segmented." />
            <RoleTile name="Route enter" role="route" token="--dur-route" ease="--ease-out" note="Page transition. Opacity + tiny scale." />
            <RoleTile name="Soft fade" role="soft" token="--dur-soft" ease="--ease-out" note="Toast, tooltip, soft reveal." />
            <RoleTile name="Spring snap" role="spring" token="--dur-panel" ease="spring" note="Use only when brief asks for tactile/playful." />
            <RoleTile name="Scroll link" role="scroll" token="--dur-route" ease="--ease-in-out" note="Scroll-progress-bound entry." />
            <RoleTile name="Drag spring" role="drag" token="--dur-flip" ease="--ease-out" note="Pick up + release rotational settle." />
            <RoleTile name="Presence" role="presence" token="--dur-soft" ease="--ease-out" sparkle note="Sparkle demo — 32×32 chip ONLY." />
          </div>
        </section>

        <section className="motion-tokens">
          <h2>Token playback (click to replay)</h2>
          <p className="lede">
            Each chip fires its token verbatim once. The numeric ms value
            is the live <code>getComputedStyle</code> read, so token edits to{" "}
            <code>colors_and_type.css</code> reflect here without a rebuild.
          </p>
          <MotionTrack>
            <TokenPlayback duration="--dur-flip" easing="--ease-out" label="--dur-flip" />
            <TokenPlayback duration="--dur-soft" easing="--ease-out" label="--dur-soft" />
            <TokenPlayback duration="--dur-panel" easing="--ease-in-out" label="--dur-panel" />
            <TokenPlayback duration="--dur-route" easing="--ease-out" label="--dur-route" />
          </MotionTrack>
        </section>

        <section className="motion-curves">
          <h2>Easing curves</h2>
          <p className="lede">
            Both curves derived from the token's live{" "}
            <code>cubic-bezier(x1, y1, x2, y2)</code> value — not hand-drawn.
            Edit the token in <code>colors_and_type.css</code>; the curve
            redraws.
          </p>
          <div className="motion-curves__row">
            <EasingCurve label="--ease-out" cssVar="--ease-out" />
            <EasingCurve label="--ease-in-out" cssVar="--ease-in-out" />
          </div>
        </section>

        <section className="motion-a11y">
          <h2>Reduced motion</h2>
          <p className="lede">
            OS-level <code>@media (prefers-reduced-motion: reduce)</code>{" "}
            collapses every <code>--dur-*</code> to <code>1ms</code> at the CSS
            layer. <code>&lt;MotionDemo&gt;</code> additionally short-circuits
            its <code>animate</code> prop via{" "}
            <code>useReducedMotion()</code> from <code>motion/react</code>{" "}
            (belt + suspenders — the a11y invariant deserves both). The toggle
            on the chrome row above flips{" "}
            <code>data-reduced-motion="true"</code> on <code>&lt;html&gt;</code>{" "}
            for in-browser inspection without OS settings; specimen chrome is
            the documented exception to OS-level honor.
          </p>
        </section>
      </main>
    </>
  );
}

interface RoleTileProps {
  name: string;
  role:
    | "flip"
    | "panel"
    | "route"
    | "soft"
    | "spring"
    | "scroll"
    | "drag"
    | "presence";
  token: string;
  ease: string;
  note: string;
  sparkle?: boolean;
}

function RoleTile({ name, role, token, ease, note, sparkle = false }: RoleTileProps) {
  return (
    <div className="motion-card">
      <strong>{name}</strong>
      <div className="motion-card__stage">
        <MotionDemo role={role} loop="always" small={sparkle} label={`${role} demo`} />
      </div>
      <code className="motion-card__tokens">
        {token} · {ease}
      </code>
      <span className="motion-card__note">{note}</span>
    </div>
  );
}

/**
 * Derives a Bezier path from a CSS easing token's live cubic-bezier(x1, y1,
 * x2, y2) value. Falls back to a sane default when the token isn't readable
 * (SSR, detached). The path is fitted to a 100×100 viewBox; y-axis is
 * flipped so progress goes bottom-left to top-right the way curves are read
 * in editor previews.
 */
function EasingCurve({ label, cssVar }: { label: string; cssVar: string }) {
  const tokens = useMotionTokens();
  const live = tokens.easings[cssVar] ?? "";
  const match = live.match(/cubic-bezier\(([^)]+)\)/);
  const [x1, y1, x2, y2] = match
    ? match[1].split(",").map((s) => parseFloat(s.trim()))
    : cssVar === "--ease-in-out"
      ? [0.4, 0, 0.2, 1]
      : [0, 0, 0.2, 1];
  const path = `M 0 100 C ${x1 * 100} ${100 - y1 * 100} ${x2 * 100} ${100 - y2 * 100} 100 0`;
  return (
    <figure className="motion-curve">
      <svg viewBox="0 0 100 100" width="120" height="120" aria-hidden="true">
        <rect x="0" y="0" width="100" height="100" fill="var(--bg-1)" />
        <path
          d="M 0 100 L 100 100 M 0 100 L 0 0"
          stroke="var(--border-default, currentColor)"
          strokeWidth="1"
          fill="none"
          opacity="0.4"
        />
        <path d={path} stroke="var(--accent)" strokeWidth="2" fill="none" />
      </svg>
      <figcaption>
        <code>{label}</code>
        <span className="motion-curve__values">
          {x1.toFixed(2)}, {y1.toFixed(2)}, {x2.toFixed(2)}, {y2.toFixed(2)}
        </span>
      </figcaption>
    </figure>
  );
}
