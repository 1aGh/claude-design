/**
 * @canvas      grid — the two grids of the studio. (1) The SIGNATURE dotted
 *              infinite-canvas dot-grid: a radial dot pattern at --canvas-grid
 *              (24px) pitch, with a node snapped to it. (2) The layout column
 *              grid that governs panel widths. Demonstrates the dot pitch, snap
 *              behaviour, an overlay toggle, and the panel column grid.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/grid — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import { useState } from "react";
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./grid.css";

const COLUMNS = [
  { span: "rail", w: "188px", role: "layer tree — fixed" },
  { span: "canvas", w: "1fr", role: "the work — flexes to fill" },
  { span: "inspector", w: "224px", role: "properties — fixed" },
];

export default function Grid() {
  const [showDots, setShowDots] = useState(true);
  const [snap, setSnap] = useState(true);

  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/grid</span>
        <span className="crumbs"><span>maude</span><span>foundation</span><span>grid</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Grid. The dotted canvas.</h1>
          <p className="lede">
            Two grids run the studio. The signature one is the dotted infinite canvas — a radial
            dot pattern at <code>--canvas-grid</code> pitch that gives the work a coordinate sense
            without lines fighting for attention. The second is the layout column grid that fixes
            the rail and inspector and lets the canvas flex between them. Both are tokens; the
            light theme retints them for free.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Dot pitch</dt><dd>--canvas-grid · 24px</dd></div>
          <div><dt>Dot color</dt><dd>--canvas-dot (ladder hue 255)</dd></div>
          <div><dt>Snap</dt><dd>nodes round to the 24px lattice</dd></div>
          <div><dt>Layout</dt><dd>rail · canvas · inspector</dd></div>
        </dl>

        <h2 data-no>The infinite canvas <span className="h2-aside">dot-grid · the signature surface</span></h2>
        <p>
          A radial dot at every 24px lattice point. The node below is snapped to that lattice — its
          handles sit on dots, its readout reports lattice multiples. Toggle the lattice or the
          snap to feel why the dots earn their place: structure you sense, never a cage you fight.
        </p>
        <div className="gr-controls">
          <span className="seg" role="group" aria-label="Dot grid">
            <button aria-pressed={showDots} onClick={() => setShowDots(true)}>dots on</button>
            <button aria-pressed={!showDots} onClick={() => setShowDots(false)}>dots off</button>
          </span>
          <span className="seg" role="group" aria-label="Snap">
            <button aria-pressed={snap} onClick={() => setSnap(true)}>snap 24</button>
            <button aria-pressed={!snap} onClick={() => setSnap(false)}>free</button>
          </span>
          <span className="gr-hint mono">pitch = var(--canvas-grid) = 24px</span>
        </div>
        <div className={`canvas gr-canvas${showDots ? "" : " gr-canvas--plain"}`} aria-label="Dotted canvas with a snapped node">
          <div className="gr-readout mono">x 96 · y 72 · w 168 · h 96 · {snap ? "snapped" : "free"}</div>
          <div className={`gr-node${snap ? " is-snapped" : " is-free"}`}>
            <span className="gr-node-tag mono">artboard · home</span>
            <span className="gr-handle tl" /><span className="gr-handle tr" />
            <span className="gr-handle bl" /><span className="gr-handle br" />
          </div>
          {snap && <div className="gr-snaplines" aria-hidden="true" />}
        </div>

        <h2 data-no>Snap math <span className="h2-aside">24px lattice</span></h2>
        <p>
          Snapping is a round to the pitch. A coordinate <code>c</code> lands at
          <code> round(c / 24) × 24</code> — so geometry stays legible and two artboards an arm's
          length apart still align pixel-for-pixel.
        </p>
        <div className="gr-math">
          <div className="gr-math-row"><span className="gr-math-k mono">pitch</span><span className="gr-math-v mono">var(--canvas-grid) → 24px</span></div>
          <div className="gr-math-row"><span className="gr-math-k mono">snap(c)</span><span className="gr-math-v mono">Math.round(c / 24) * 24</span></div>
          <div className="gr-math-row"><span className="gr-math-k mono">node origin</span><span className="gr-math-v mono">(96, 72) — both multiples of 24</span></div>
          <div className="gr-math-row"><span className="gr-math-k mono">node size</span><span className="gr-math-v mono">168 × 96 — 7 × 4 cells</span></div>
        </div>

        <h2 data-no>The layout column grid <span className="h2-aside">rail · canvas · inspector</span></h2>
        <p>
          The studio frame is three columns: a fixed layer rail, the flexing canvas, and a fixed
          inspector. <code>--layout-max-w</code> is <code>none</code> — the app is full-bleed; only
          the rail and inspector hold a fixed width, so the canvas always claims the rest.
        </p>
        <div className="gr-layout" aria-label="Three-column app grid">
          {COLUMNS.map((c) => (
            <div className={`gr-col gr-col--${c.span}`} key={c.span}>
              <span className="gr-col-name mono">{c.span}</span>
              <span className="gr-col-w mono">{c.w}</span>
              <span className="gr-col-role">{c.role}</span>
            </div>
          ))}
        </div>
        <p className="gr-aside">
          Inside any single panel, content falls back to a 4px spacing rhythm
          (<code>--space-*</code>) — there is no 12-column web grid here. This is a desktop tool, not
          a marketing page; the column grid is structural chrome, not a content scaffold.
        </p>

        <footer className="specimen-ft">
          <span>MAUDE/grid</span>
          <span>dotted canvas · 24px pitch · rail/canvas/inspector</span>
        </footer>
      </main>
    </>
  );
}
