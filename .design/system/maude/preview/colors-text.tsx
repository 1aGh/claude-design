/**
 * @canvas      colors-text — the four-level foreground ladder in context.
 *              Demonstrates --fg-0 (primary) / --fg-1 (secondary) /
 *              --fg-2 (tertiary, muted) / --fg-3 (disabled), how the hierarchy
 *              reads on the panel material AND on the dotted canvas surface, and
 *              proves tertiary stays legible where it actually lives: inspector
 *              labels, coordinate read-outs and layer-tree metadata.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/colors-text — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN: colors-text
 * DEMONSTRATES: --fg-0, --fg-1, --fg-2, --fg-3
 * NOTES: --fg-2 (tertiary) is the load-bearing level — it carries every mono
 * inspector label and read-out. The token file budgets it to stay legible on
 * the deepest surface; we DEMONSTRATE that by placing it on both the panel and
 * the canvas at real size — a thing you read, not a ratio we assert.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./colors-text.css";

const LADDER = [
  { tok: "--fg-0", role: "Primary", use: "the one message in a region", oklch: "0.955 0.005 250" },
  { tok: "--fg-1", role: "Secondary", use: "supporting copy · panel body", oklch: "0.790 0.008 250" },
  { tok: "--fg-2", role: "Tertiary", use: "inspector labels · read-outs · meta", oklch: "0.660 0.010 250" },
  { tok: "--fg-3", role: "Disabled", use: "inactive only — never live text", oklch: "0.500 0.010 250" },
];

export default function ColorsText() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/colors-text</span>
        <span className="crumbs"><span>maude</span><span>color</span><span>text</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Text. Four levels, one job each.</h1>
          <p className="lede">
            Foreground is a hierarchy, not a palette. <code>--fg-0</code> carries the one
            thing that matters in a region; each step down is quieter context. The tertiary
            level does the most work in a pro tool — it's every inspector label and coordinate
            read-out — so it has to stay legible on the panel <em>and</em> on the deepest
            canvas surface. Disabled is the one level that never holds live text.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Levels</dt><dd>4 (fg-0 … fg-3)</dd></div>
          <div><dt>Hue</dt><dd>250 (cool-neutral)</dd></div>
          <div><dt>Load-bearing</dt><dd>fg-2 · tertiary</dd></div>
          <div><dt>On</dt><dd>panel · canvas</dd></div>
        </dl>

        <h2 data-no>The ladder <span className="h2-aside">four tokens, two surfaces</span></h2>
        <p>
          Each level shown as a glyph specimen — not a flat chip — so you read it the way it's
          actually used: as type. The left column sits on the panel material; the right column
          sits on <code>--bg-0</code>, the same deepest surface as the dotted canvas. If a level
          reads on the left but dissolves on the right, it's wrong.
        </p>
        <div className="txt-ladder">
          {LADDER.map((l) => (
            <div className="txt-rung" key={l.tok}>
              <div className="txt-rung-id">
                <strong className="mono">{l.tok}</strong>
                <span className="txt-role">{l.role}</span>
              </div>
              <div className="txt-rung-sample on-panel" style={{ color: `var(${l.tok})` }}>
                Card · Pricing
              </div>
              <div className="txt-rung-sample on-canvas" style={{ color: `var(${l.tok})` }}>
                Card · Pricing
              </div>
              <div className="txt-rung-meta">
                <span className="mono oklch">{l.oklch}</span>
                <span className="txt-use">{l.use}</span>
              </div>
            </div>
          ))}
        </div>

        <h2 data-no>Tertiary on the canvas <span className="h2-aside">prove fg-2 legible</span></h2>
        <p>
          The tertiary level lives mostly in mono: the floating coordinate read-out over a
          selected node, the column headers in the inspector, the dimmed-but-readable layer
          metadata. Here it is doing exactly that job over the full-strength dotted canvas —
          the hardest place it has to survive.
        </p>
        <div className="canvas txt-stage" aria-label="Tertiary text over the dotted canvas">
          <div className="txt-node">
            <span className="txt-readout mono">x 248 · y 96 · w 168 · h 116</span>
            <span className="txt-node-label">Frame · Hero</span>
          </div>
          <div className="txt-caption mono">fg-2 read-out over --bg-0</div>
        </div>

        <h2 data-no>In context <span className="h2-aside">a panel that uses all four</span></h2>
        <p>
          A single layers panel exercises the whole ladder at once: the panel title and active
          row in primary, the body in secondary, the mono counts in tertiary, the locked row in
          disabled. One region, four jobs.
        </p>
        <div className="panel txt-panel">
          <div className="panel-hd"><span>Layers</span><span className="mono">4 nodes</span></div>
          <div className="panel-bd">
            <p className="txt-ctx-0"><strong>Frame · Hero</strong> — active selection</p>
            <p className="txt-ctx-1">Auto-saved 19:42 · last edit by agent</p>
            <p className="txt-ctx-2 mono">2 children · 1 component instance · 0 overrides</p>
            <p className="txt-ctx-3">Group · Footer (locked)</p>
          </div>
        </div>

        <div className="callout callout--info txt-note">
          <span className="mono">note</span>
          <span>
            Disabled (<code>--fg-3</code>) is for inactive controls and locked rows only.
            Reaching for it to make live body copy "calmer" is the one misuse the
            graphic-design-critic blocks — drop to <code>--fg-2</code> instead, it's the
            level built to stay readable.
          </span>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/colors-text</span>
          <span>fg · 4 levels · hue 250</span>
        </footer>
      </main>
    </>
  );
}
