/**
 * @canvas      motion — motion tokens. Continuous-loop demos on first paint
 *              (Phase 3.7 spec — see DDR-049). Maude's "no motion beyond
 *              hover" rule applies to product chrome; this specimen page
 *              is where the motion vocabulary is *demonstrated*.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.motion / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/motion/
 * @handoff     bunx shadcn add file://./motion.registry.json
 */
// Ambient styles — tokens + specimen chrome. Required for the standalone
// `_canvas-shell.html?canvas=...` load path, where the shell template's
// <link id="canvas-tokens"> placeholder is empty (the static template ships
// blank — only the API-driven shell URL fills it). Importing here makes the
// specimen self-contained: canvas-build inlines every CSS asset reachable
// from the entry, so the rendered bundle carries tokens + chrome + bespoke.
import "../colors_and_type.css";
import "./_layout.css";
import "./motion.css";
import { ThemeToggle, ReducedMotionToggle } from "./_specimen-controls";
// Canonical motion vocabulary (DDR-049 — "Animation tooling contract"). These
// wrap motion/react with token-bound duration + easing + reduced-motion
// short-circuit. The duration-bar demos above are the restrained CSS baseline;
// this section exercises the richer orchestrated patterns through the library.
import { MotionDemo, MotionTrack, TokenPlayback } from "@maude/canvas-lib";

// Visible payload for a MotionDemo — the lib's default chip ships no CSS, so the
// specimen supplies its own token-styled box.
function Pellet({ label }: { label?: string }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "var(--radius-2, 8px)",
        background: "var(--accent, #6366f1)",
        display: "grid",
        placeItems: "center",
        color: "var(--accent-fg, #fff)",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {label}
    </div>
  );
}

export default function Motion() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MDCC-DSN/01.motion</span>
        <span className="crumbs">
          <span>maude</span>
          <span>design system</span>
          <span>motion</span>
        </span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Motion</h1>
          <p className="lede">
            Four durations, two easings. <code>--dur-route</code> is 1ms — route changes are
            <em> instant</em>, no fade theatre. The bars below loop at each duration so the cadence
            is visible at rest; you don't have to hover anything to see what the DS feels like.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Durations</dt><dd>4</dd></div>
          <div><dt>Easings</dt><dd>out · in-out</dd></div>
          <div><dt>Loop policy</dt><dd>infinite alternate · bounded geometry</dd></div>
          <div><dt>Reduced motion</dt><dd><ReducedMotionToggle /></dd></div>
        </dl>

        {/* ── Durations ─────────────────────────────────────────────────── */}
        <h2 data-no="01">Durations <span className="h2-aside">continuous loops</span></h2>

        <div className="motion-row">
          <span className="label">--dur-flip</span>
          <span style={{ color: 'var(--fg-1)' }}>90ms · button press, link hover. The "I noticed your click" twitch.</span>
          <div className="motion-stage motion-stage--flip" aria-label="flip duration demo, looping"><div className="motion-dot" /></div>
        </div>

        <div className="motion-row">
          <span className="label">--dur-panel</span>
          <span style={{ color: 'var(--fg-1)' }}>140ms · hover transitions on chrome. Tile hover, row hover.</span>
          <div className="motion-stage motion-stage--panel" aria-label="panel duration demo, looping"><div className="motion-dot" /></div>
        </div>

        <div className="motion-row">
          <span className="label">--dur-soft</span>
          <span style={{ color: 'var(--fg-1)' }}>180ms · tooltips, popovers, soft fades. Reduced-motion-safe ceiling.</span>
          <div className="motion-stage motion-stage--soft" aria-label="soft duration demo, looping"><div className="motion-dot" /></div>
        </div>

        <div className="motion-row">
          <span className="label">--dur-route</span>
          <span style={{ color: 'var(--fg-1)' }}>1ms · route changes. <strong>Instant.</strong> No "fade between pages" theatre — the bar snaps so you can see what 1ms means.</span>
          <div className="motion-stage motion-stage--route" aria-label="route duration demo, looping at 1ms"><div className="motion-dot" /></div>
        </div>

        {/* ── Easings ───────────────────────────────────────────────────── */}
        <h2 data-no="02">Easings <span className="h2-aside">two curves, graphed</span></h2>

        <div className="easing-row">
          <span className="label">--ease-out</span>
          <span style={{ color: 'var(--fg-1)' }}>
            <code>cubic-bezier(0.22, 1, 0.36, 1)</code>. The default. Almost everything uses this. Fast start, gentle settle.
          </span>
          <EasingGraph x1={0.22} y1={1.00} x2={0.36} y2={1.00} label="ease-out" />
        </div>

        <div className="easing-row">
          <span className="label">--ease-in-out</span>
          <span style={{ color: 'var(--fg-1)' }}>
            <code>cubic-bezier(0.65, 0, 0.35, 1)</code>. Symmetric, for the rare bidirectional motion (sheet slide in-out where the same curve plays both ways).
          </span>
          <EasingGraph x1={0.65} y1={0.00} x2={0.35} y2={1.00} label="ease-in-out" />
        </div>

        {/* ── Vocabulary in motion (canvas-lib) ─────────────────────────── */}
        <h2 data-no="03">
          Vocabulary in motion <span className="h2-aside">orchestrated · canvas-lib</span>
        </h2>
        <p style={{ color: "var(--fg-1)", margin: "0 0 var(--space-4)" }}>
          The eight roles from <code>@maude/canvas-lib</code> (<code>motion/react</code> under the
          hood), each token-bound and looping on first paint. This is the canonical path the{" "}
          <strong>Animation tooling contract</strong> mandates — no hand-rolled <code>@keyframes</code>.
          Flip the reduced-motion toggle above; every role short-circuits to its end state.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: "var(--space-4)",
            margin: "0 0 var(--space-6)",
          }}
        >
          {(
            [
              ["flip", "y twitch"],
              ["panel", "slide in/out"],
              ["soft", "fade"],
              ["route", "snap (1ms)"],
              ["spring", "spring rise"],
              ["scroll", "x drift"],
              ["drag", "tilt"],
              ["presence", "pop in"],
            ] as const
          ).map(([role, blurb]) => (
            <div
              key={role}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                padding: "var(--space-4)",
                border: "1px solid var(--bg-3, #e5e7eb)",
                borderRadius: "var(--radius-2, 8px)",
                background: "var(--bg-1, #fafafa)",
              }}
            >
              <span className="label">{role}</span>
              <span style={{ color: "var(--fg-1)", fontSize: 12 }}>{blurb}</span>
              <div style={{ minHeight: 56, display: "grid", placeItems: "center" }}>
                <MotionDemo role={role} label={`${role} role demo, looping`}>
                  <Pellet />
                </MotionDemo>
              </div>
            </div>
          ))}
        </div>

        {/* Orchestration — staggered entrance track */}
        <div className="motion-row">
          <span className="label">stagger</span>
          <span style={{ color: "var(--fg-1)" }}>
            <code>&lt;MotionTrack staggerMs=&#123;90&#125;&gt;</code> — five springs entering 90ms
            apart. Orchestration without hand-wiring delays.
          </span>
          <MotionTrack staggerMs={90}>
            {[0, 1, 2, 3, 4].map((i) => (
              <MotionDemo key={i} role="spring" small label={`stagger pellet ${i + 1}`}>
                <Pellet label={String(i + 1)} />
              </MotionDemo>
            ))}
          </MotionTrack>
        </div>

        {/* Click-to-fire replay chips */}
        <div className="motion-row">
          <span className="label">replay</span>
          <span style={{ color: "var(--fg-1)" }}>
            <code>&lt;TokenPlayback&gt;</code> — single-shot, click to fire. Probe one token without
            waiting for the loop.
          </span>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <TokenPlayback duration="--dur-panel" easing="--ease-out" label="panel" />
            <TokenPlayback duration="--dur-soft" easing="--ease-out" label="soft" />
            <TokenPlayback duration="--dur-flip" easing="--ease-out" label="flip" />
          </div>
        </div>

        {/* ── Hard rules ────────────────────────────────────────────────── */}
        <h2 data-no="04">Hard rules <span className="h2-aside">what motion is NOT</span></h2>
        <div className="anti">
          <p style={{ margin: '0 0 var(--space-2)' }}>
            <strong>No animations on product chrome.</strong> <code>.specimen-hd</code> doesn't animate in. <code>.specimen-title</code> doesn't fade up. The page is just <em>there</em>. Looping demos belong on the motion specimen page; the rest of the DS is still hover-driven.
          </p>
          <p style={{ margin: '0 0 var(--space-2)' }}>
            <strong>No scroll-jacking.</strong> No parallax. No "ambient drift" on hero sections. No auto-play marquees.
          </p>
          <p style={{ margin: '0' }}>
            <strong>Route changes are 1ms.</strong> If you want a "what changed" affordance, use a brief content-area fade. Never a full-page fade.
          </p>
        </div>
        <div className="pro">
          <p style={{ margin: '0' }}>
            <strong>Hover micro-interactions are the primary feedback channel</strong> at <code>--dur-flip</code> / <code>--dur-panel</code> + <code>--ease-out</code>. Bg-swap, border-swap, color-swap. Anything that signals "I'm interactive" is welcome. Bounded geometry (<code>overflow: hidden</code> on rotating / scaling demos) is mandatory.
          </p>
        </div>

        <footer className="specimen-ft">
          <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· motion</span></div>
          <div className="colo-block"><span>Maude · v0.16.0</span></div>
        </footer>
      </main>
    </>
  );
}

/**
 * Token-derived cubic-bezier graph. Renders a 240×96 SVG with the curve drawn
 * inside an 8-unit margin so the stroke doesn't get clipped at the endpoints.
 * Pure SVG, no JS state — safe to render during SSR / smoke / handoff.
 */
function EasingGraph({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  const W = 240;
  const H = 96;
  const PAD = 8;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  // Bezier control points in SVG pixel space. Y is inverted (SVG +Y goes down).
  const p0x = PAD,                p0y = PAD + innerH;
  const c1x = PAD + x1 * innerW,  c1y = PAD + (1 - y1) * innerH;
  const c2x = PAD + x2 * innerW,  c2y = PAD + (1 - y2) * innerH;
  const p1x = PAD + innerW,       p1y = PAD;
  const d = `M ${p0x} ${p0y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p1x} ${p1y}`;
  return (
    <svg className="easing-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} curve`}>
      {/* faint baseline + ceiling */}
      <line className="grid-line" x1={PAD} y1={PAD}            x2={W - PAD} y2={PAD}            />
      <line className="grid-line" x1={PAD} y1={PAD + innerH}   x2={W - PAD} y2={PAD + innerH}   />
      {/* x + y axes */}
      <line className="axis" x1={PAD} y1={PAD + innerH} x2={W - PAD} y2={PAD + innerH} />
      <line className="axis" x1={PAD} y1={PAD}          x2={PAD}     y2={PAD + innerH} />
      <path className="curve" d={d} />
      <circle className="end-dot" cx={p1x} cy={p1y} r={3} />
    </svg>
  );
}
