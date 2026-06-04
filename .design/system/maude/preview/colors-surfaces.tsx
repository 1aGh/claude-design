/**
 * @canvas      colors-surfaces — the cool-neutral elevation ladder.
 *              Demonstrates --bg-0 … --bg-4 (deepest → highest) plus the three
 *              border weights, and the central claim of the DS: the DEEPEST
 *              surface is the canvas. Chrome elevates UP from the work, never
 *              the other way around. One shared material, one elevation rule.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/colors-surfaces — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN: colors-surfaces
 * DEMONSTRATES: --bg-0..4, --border-subtle, --border-default, --border-strong
 * NOTES: --bg-0 is deepest (the canvas / page), --bg-4 is highest (pressed).
 * Hairlines carry separation, not heavy fills or shadows — that's the
 * "chrome must not out-shout the canvas" rule made visible.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./colors-surfaces.css";

const LADDER = [
  { tok: "--bg-0", role: "Canvas / page", note: "the deepest surface — the work lives here", oklch: "0.165 0.012 255" },
  { tok: "--bg-1", role: "Panel / card", note: "the first lift — inspector, layers, toolbar", oklch: "0.198 0.012 255" },
  { tok: "--bg-2", role: "Nested / popover", note: "a panel inside a panel", oklch: "0.232 0.013 255" },
  { tok: "--bg-3", role: "Input / row", note: "fields and hovered rows", oklch: "0.270 0.013 252" },
  { tok: "--bg-4", role: "Pressed / active", note: "the highest step — held state", oklch: "0.310 0.014 252" },
];

const BORDERS = [
  { tok: "--border-subtle", use: "seams inside one panel" },
  { tok: "--border-default", use: "the panel material itself" },
  { tok: "--border-strong", use: "hover edge · resize handles" },
];

export default function ColorsSurfaces() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/colors-surfaces</span>
        <span className="crumbs"><span>maude</span><span>color</span><span>surfaces</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Surfaces. The canvas is the floor.</h1>
          <p className="lede">
            Five steps of background, deepest to highest — but the rule that matters is the
            direction. <code>--bg-0</code> is the canvas: the work sits at the bottom of the
            stack and chrome elevates <em>up</em> from it. A panel is one step up, a nested
            popover two, an input three. Hairlines do the separating; the steps are small on
            purpose so nothing in the chrome out-shouts the work it frames.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Steps</dt><dd>5 (bg-0 … bg-4)</dd></div>
          <div><dt>Hue</dt><dd>255 (cool-neutral)</dd></div>
          <div><dt>Deepest</dt><dd>bg-0 · the canvas</dd></div>
          <div><dt>Separation</dt><dd>1px hairlines</dd></div>
        </dl>

        <h2 data-no>The elevation ladder <span className="h2-aside">deepest → highest, as steps</span></h2>
        <p>
          Drawn as physical steps rather than detached chips so the small inter-step deltas
          read as a continuous ramp. Each step carries its token, its role and its OKLCH — the
          lightness climbs ~3–4% per rung, just enough to separate without ever competing.
        </p>
        <div className="surf-stairs" aria-label="Surface elevation ladder">
          {LADDER.map((l, i) => (
            <div
              className="surf-step"
              key={l.tok}
              style={{ background: `var(${l.tok})`, zIndex: i }}
            >
              <div className="surf-step-id">
                <strong className="mono">{l.tok}</strong>
                <span className="surf-role">{l.role}</span>
              </div>
              <div className="surf-step-meta">
                <span className="mono oklch">{l.oklch}</span>
                <span className="surf-note">{l.note}</span>
              </div>
            </div>
          ))}
        </div>

        <h2 data-no>Cohesion in use <span className="h2-aside">one material, nested</span></h2>
        <p>
          The stack made literal: the dotted canvas at <code>--bg-0</code>, a floating panel at
          <code>--bg-1</code>, a nested section at <code>--bg-2</code>, a field at
          <code>--bg-3</code>. Every edge is the same hairline, every radius from the same
          ramp — the sameness IS the signature. Read it from the back: canvas, panel, nested,
          field. That's the elevation contract, top to bottom.
        </p>
        <div className="canvas surf-cohesion" aria-label="Nested panel stack on the canvas">
          <div className="surf-float panel">
            <div className="panel-hd"><span>Inspector</span><span className="mono">bg-1</span></div>
            <div className="panel-bd">
              <div className="surf-nested">
                <span className="surf-tag mono">nested · bg-2</span>
                <div className="insp-row">
                  <span className="insp-label">X</span>
                  <span className="insp-fields">
                    <span className="field">248</span>
                    <span className="field">96</span>
                  </span>
                </div>
                <input className="input surf-field" defaultValue="Frame · Hero" aria-label="Layer name (bg-3)" />
              </div>
            </div>
          </div>
        </div>

        <h2 data-no>Borders <span className="h2-aside">three weights, hairline-mono</span></h2>
        <p>
          Three border weights carry all the separation this DS needs. Subtle seams sit
          <em>inside</em> a panel; default is the panel's own edge; strong marks an active edge —
          a hovered tile or a resize handle. There is no fourth weight and no decorative rule.
        </p>
        <div className="surf-borders">
          {BORDERS.map((b) => (
            <div
              className="surf-bcard"
              key={b.tok}
              style={{ borderColor: `var(${b.tok})` }}
            >
              <strong className="mono">{b.tok}</strong>
              <span className="surf-buse">{b.use}</span>
            </div>
          ))}
        </div>

        <div className="callout callout--warn surf-note-box">
          <span className="mono">guardrail</span>
          <span>
            Shadows are subtle by design — the hairlines do the elevation work, not drop
            shadows. If a panel needs a heavy shadow to separate from the canvas, the surface
            step is wrong; raise it one rung instead of stacking a shadow on top.
          </span>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/colors-surfaces</span>
          <span>bg · 5 steps · hue 255 · deepest = canvas</span>
        </footer>
      </main>
    </>
  );
}
