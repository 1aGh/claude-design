/**
 * @canvas      motion — the maude motion vocabulary. Eight canonical roles
 *              looping on first paint, four duration tokens fired live on a
 *              playback bench, two easing curves drawn from the live cubic-bezier
 *              control points, and a reduced-motion contract panel. Crisp and
 *              snappy (Zed-fast) — a Pro Tool, not a Toy. No bouncy springs by
 *              default; the spring role appears only to teach the role itself.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/motion — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline · motion/react via @maude/canvas-lib
 *
 * SPECIMEN: motion (DDR-049 exception — NOT a bare specimen)
 * DEMONSTRATES: --dur-flip · --dur-panel · --dur-route · --dur-soft ·
 *               --ease-out · --ease-in-out · prefers-reduced-motion contract ·
 *               <MotionDemo role> 8-role vocabulary · <TokenPlayback> chips
 *
 * ANIMATION SAFETY (SUB-AGENT-PROMPTS.md):
 *   Every <MotionDemo> root sets `overflow: hidden` inline (canvas-lib), and the
 *   .mo-stage chrome clips a second time. The presence sparkle (scale 0→1) runs
 *   ONLY on a 14px chip via small={true} — never on a full tile. Roles loop
 *   `infinite alternate` so the bench is never dead at rest. Compositor-only:
 *   transform + opacity, never layout. Reduced-motion is enforced twice — the
 *   CSS --dur-* → 1ms collapse AND <MotionDemo>'s useReducedMotion() short-circuit.
 */
import "../colors_and_type.css";
import "./_layout.css";
import "./motion.css";
import { MotionDemo, MotionTrack, TokenPlayback, useMotionTokens } from "@maude/canvas-lib";
import { ThemeToggle, ReducedMotionToggle } from "./_specimen-controls";

/* The eight canonical roles. Each binds to ONE duration + ONE ease token; the
 * 4 duration tokens (--dur-flip/panel/route/soft) are each referenced ≥1× below
 * (completeness-critic asserts coverage). Notes use maude nouns + voice. */
const ROLES = [
  { name: "Flip",     role: "flip",     dur: "--dur-flip",  ease: "--ease-out",    use: "select · press",  note: "Node lifts on select, settles on release. The smallest, snappiest beat." },
  { name: "Panel",    role: "panel",    dur: "--dur-panel", ease: "--ease-in-out", use: "inspector · layers", note: "Inspector and layer panels slide in from the chrome edge." },
  { name: "Route",    role: "route",    dur: "--dur-route", ease: "--ease-out",    use: "open · hand off", note: "Opening an artboard or the hand-off view. Fade plus a hair of scale." },
  { name: "Soft",     role: "soft",     dur: "--dur-soft",  ease: "--ease-out",    use: "toast · tooltip", note: "The quietest fade — a saved toast, a property tooltip. Fastest token." },
  { name: "Spring",   role: "spring",   dur: "--dur-panel", ease: "spring",        use: "off by default", note: "Tactile snap. Shown to teach the role — Pro Tool stays tween. Toy energy, kept boxed." },
  { name: "Scroll",   role: "scroll",   dur: "--dur-soft",  ease: "--ease-in-out", use: "canvas drift",   note: "Scroll-linked drift as the dotted canvas pans under a frame." },
  { name: "Drag",     role: "drag",     dur: "--dur-flip",  ease: "--ease-out",    use: "drag a node",    note: "Pick up a node, a touch of rotational settle, square on release." },
  { name: "Presence", role: "presence", dur: "--dur-soft",  ease: "--ease-out",    use: "agent pulse",    note: "The AI agent's presence pulse — a 14px dot only, never a panel." },
] as const;

export default function Motion() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/motion</span>
        <span className="crumbs"><span>maude</span><span>motion</span><span>8 roles · 4 durations</span></span>
        <span style={{ display: "inline-flex", gap: "var(--space-3)", alignItems: "center" }}>
          <ReducedMotionToggle />
          <ThemeToggle />
        </span>
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Motion. Crisp, snappy, boxed.</h1>
          <p className="lede">
            Every animation in the studio maps to one of eight roles. Four durations,
            two eases — <strong>Zed-fast</strong>, never showy. The chrome moves so you
            barely notice it; the canvas is what you watch. <code>&lt;MotionDemo role="…"&gt;</code>{" "}
            from <code>@maude/canvas-lib</code> is the only authoring surface. Springs
            say <em>Toy</em>, so the spring role is here to be recognised, not reached for.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Roles</dt><dd>8</dd></div>
          <div><dt>Durations</dt><dd>120 · 140 · 220 · 280 ms</dd></div>
          <div><dt>Eases</dt><dd>out · in-out</dd></div>
          <div><dt>Default</dt><dd>tween · no spring</dd></div>
        </dl>

        <h2 data-no>The vocabulary <span className="h2-aside">8 roles · looping on first paint</span></h2>
        <p>
          Each tile loops <code>infinite alternate</code> the instant the page paints —
          a motion bench that is never dead at rest. The payload reads as a node on the
          dotted canvas: one shared chrome material, calmer than the surface it rides.
        </p>
        <div className="mo-grid">
          {ROLES.map((r) => (
            <div className="mo-tile" key={r.role} data-warn={r.ease === "spring" ? "spring" : undefined}>
              <div className="mo-tile__hd">
                <span className="mo-tile__name">{r.name}</span>
                <span className="mo-tile__tok">{r.dur}</span>
              </div>
              <div className="mo-stage" data-role={r.role}>
                <MotionDemo role={r.role} loop="always" small={r.role === "presence"} label={`${r.role} role demo`} />
              </div>
              <span className="mo-tile__note">
                <span className="role-use">{r.use} · {r.ease}</span>
                {r.note}
              </span>
            </div>
          ))}
        </div>

        <h2 data-no>Token playback <span className="h2-aside">click a chip — fires the live token once</span></h2>
        <p>
          The four duration tokens, each fired verbatim. The millisecond value is a live{" "}
          <code>getComputedStyle</code> read off <code>colors_and_type.css</code>, so a token
          edit reflects here with no rebuild. Flip the toggle to <code>REDUCED</code> and the
          chips fall silent — same contract the whole studio honours.
        </p>
        <div className="mo-bench">
          <MotionTrack staggerMs={40}>
            <TokenPlayback duration="--dur-soft"  easing="--ease-out"    label="--dur-soft" />
            <TokenPlayback duration="--dur-flip"  easing="--ease-out"    label="--dur-flip" />
            <TokenPlayback duration="--dur-panel" easing="--ease-in-out" label="--dur-panel" />
            <TokenPlayback duration="--dur-route" easing="--ease-out"    label="--dur-route" />
          </MotionTrack>
        </div>

        <h2 data-no>Easing curves <span className="h2-aside">drawn from the live cubic-bezier</span></h2>
        <p>
          Both curves are derived from the token's live{" "}
          <code>cubic-bezier(x1, y1, x2, y2)</code> control points — not hand-drawn. Edit
          the token; the path redraws. <code>--ease-out</code> is the decisive one (most
          roles); <code>--ease-in-out</code> carries the symmetric panel slides.
        </p>
        <div className="mo-curves">
          <EasingCurve label="--ease-out" cssVar="--ease-out" />
          <EasingCurve label="--ease-in-out" cssVar="--ease-in-out" />
        </div>

        <h2 data-no>Reduced motion <span className="h2-aside">the a11y contract, enforced twice</span></h2>
        <div className="callout mo-rm">
          <p style={{ margin: 0 }}>
            OS-level <code>@media (prefers-reduced-motion: reduce)</code> collapses every{" "}
            <code>--dur-*</code> token to <code>1ms</code> at the CSS layer — the canonical
            contract. <code>&lt;MotionDemo&gt;</code> belts-and-suspenders it with{" "}
            <code>useReducedMotion()</code>, short-circuiting its <code>animate</code> prop.
            The <code>MOTION / REDUCED</code> toggle in the chrome flips{" "}
            <code>data-reduced-motion="true"</code> on <code>&lt;html&gt;</code> so you can
            eyeball both branches without touching OS settings — this specimen is the one
            documented exception to OS-level honour. All motion is compositor-only{" "}
            (<code>transform</code> + <code>opacity</code>), so a frozen branch costs nothing.
          </p>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/motion</span>
          <span>8 roles · 4 durations · tween-default · DDR-049</span>
        </footer>
      </main>
    </>
  );
}

/**
 * Draws a Bezier path from a CSS easing token's live cubic-bezier(x1,y1,x2,y2)
 * value. Falls back to the maude token defaults when unreadable (SSR /
 * detached). Fitted to a 100×100 viewBox; the y-axis is flipped so progress
 * reads bottom-left → top-right the way curves are shown in editors.
 */
function EasingCurve({ label, cssVar }: { label: string; cssVar: string }) {
  const tokens = useMotionTokens();
  const live = tokens.easings[cssVar] ?? "";
  const match = live.match(/cubic-bezier\(([^)]+)\)/);
  const [x1, y1, x2, y2] = match
    ? match[1].split(",").map((s) => Number.parseFloat(s.trim()))
    : cssVar === "--ease-in-out"
      ? [0.4, 0, 0.2, 1]   // maude --ease-in-out token default
      : [0.2, 0, 0, 1];    // maude --ease-out token default
  const path = `M 0 100 C ${x1 * 100} ${100 - y1 * 100} ${x2 * 100} ${100 - y2 * 100} 100 0`;
  return (
    <figure className="mo-curve">
      <svg viewBox="0 0 100 100" width="128" height="128" aria-hidden="true">
        <path d="M 0 100 L 100 100 M 0 100 L 0 0" stroke="var(--border-strong)" strokeWidth="1" fill="none" opacity="0.5" />
        <path d="M 0 0 L 100 100" stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="2 4" fill="none" />
        <path d={path} stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <figcaption>
        <code>{label}</code>
        <span className="mo-curve__vals">
          {x1.toFixed(2)}, {y1.toFixed(2)}, {x2.toFixed(2)}, {y2.toFixed(2)}
        </span>
      </figcaption>
    </figure>
  );
}
