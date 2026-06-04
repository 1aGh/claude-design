/**
 * @canvas      elevation — the maude shadow ladder: --shadow-sm/md/lg, kept
 *              deliberately subtle on dark because the 1px hairline does most of
 *              the separation. Shows the three levels + an explicit zero, a
 *              "hairlines + bg-step" proof for stationary chrome, and a context
 *              frame where a popover floats just enough over a flat node.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/elevation — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN: foundations-elevation
 * DEMONSTRATES: --shadow-sm/md/lg + an explicit no-shadow baseline.
 * NOTES: Shadow is reserved for FLOATING UI (popover, menu, dialog). Stationary
 *        cards separate by border + a brighter surface step, never shadow — that
 *        misuse is the #1 visual-noise tell on a dark cool-neutral ladder.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./elevation.css";

const LEVELS = [
  { tok: null,         label: "flat",         use: "stationary node", px: "border + bg-step" },
  { tok: "--shadow-sm", label: "--shadow-sm", use: "panel · resting card", px: "0 1px 2px / .40" },
  { tok: "--shadow-md", label: "--shadow-md", use: "popover · menu",   px: "0 4px 14px / .46" },
  { tok: "--shadow-lg", label: "--shadow-lg", use: "dialog · sheet",   px: "0 14px 38px / .56" },
] as const;

export default function Elevation() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/elevation</span>
        <span className="crumbs"><span>maude</span><span>elevation</span><span>hairline-first</span></span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Elevation. Hairlines first.</h1>
          <p className="lede">
            On a dark cool-neutral ladder a heavy shadow reads as smudge, not depth — so the
            <strong> 1px hairline does the separating</strong> and shadow is a whisper held in
            reserve. Three levels plus an explicit zero. A surface earns a shadow only when it
            genuinely <em>floats</em>: a popover, a menu, a dialog. A stationary node separates
            by border and a brighter surface step — never by shadow.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Levels</dt><dd>3 + explicit zero</dd></div>
          <div><dt>Strategy</dt><dd>soft · hairline carries</dd></div>
          <div><dt>Shadow is for</dt><dd>floating UI only</dd></div>
          <div><dt>Stationary</dt><dd>border + bg-step</dd></div>
        </dl>

        <h2 data-no>The levels <span className="h2-aside">on the dotted canvas, where you'd actually see them</span></h2>
        <p>
          Shown on the canvas surface so the shadow reads against the same dotted ground the
          studio runs on. Note how little separates <code>sm</code> from <code>md</code> — that
          restraint is the point.
        </p>
        <div className="el-grid">
          {LEVELS.map((l) => (
            <div className="el-card" key={l.label} data-flat={l.tok === null ? "true" : undefined} style={l.tok ? { boxShadow: `var(${l.tok})` } : undefined}>
              <strong>{l.label}</strong>
              <span className="el-use">{l.use}</span>
              <span className="el-px">{l.px}</span>
            </div>
          ))}
        </div>

        <h2 data-no>Hairlines do the work <span className="h2-aside">stationary separation without a single shadow</span></h2>
        <p>
          Two ways to separate three stacked rows. Both are shadow-free; both read cleanly. The
          studio defaults to the right one — a 1px hairline plus one surface step per layer keeps
          dense chrome legible without a stack of overlapping shadows fighting the canvas.
        </p>
        <div className="el-stack">
          <div className="el-proof">
            <div className="el-proof__hd">border + bg-step <span className="ok">✓ default</span></div>
            <div className="el-proof__bd">
              <div className="el-row s1">Frame · Hero</div>
              <div className="el-row s2">Card · Pricing</div>
              <div className="el-row s3">Text · Headline</div>
            </div>
          </div>
          <div className="el-proof">
            <div className="el-proof__hd">a shadow on every row <span className="no">✕ smudge</span></div>
            <div className="el-proof__bd">
              <div className="el-row s1" style={{ boxShadow: "var(--shadow-md)" }}>Frame · Hero</div>
              <div className="el-row s1" style={{ boxShadow: "var(--shadow-md)" }}>Card · Pricing</div>
              <div className="el-row s1" style={{ boxShadow: "var(--shadow-md)" }}>Text · Headline</div>
            </div>
          </div>
        </div>

        <h2 data-no>In context <span className="h2-aside">a flat node, a floating popover, side by side</span></h2>
        <p>
          The node sits <em>on</em> the canvas — it does not float, so it carries no shadow, only
          a border and a brighter fill. The layer popover floats <em>above</em> the canvas, so it
          earns <code>--shadow-md</code>. Same frame, two truthful answers to "does this float?"
        </p>
        <div className="el-context" aria-label="Elevation in context — flat node vs floating popover">
          <div className="el-node">
            <span className="el-tag">flat · no shadow</span>
            Card · Pricing
          </div>
          <div className="el-popover">
            <div className="el-popover__hd">Layers · floating · shadow-md</div>
            <div style={{ padding: "var(--space-2)" }}>
              <div className="tree-row">Frame · Hero</div>
              <div className="tree-row" aria-selected="true">Card · Pricing</div>
              <div className="tree-row">Group · Footer</div>
            </div>
          </div>
        </div>

        <div className="callout callout--info">
          <p style={{ margin: 0 }}>
            Rule of thumb: if a surface sits on the page and never moves, no shadow. Shadow means
            "floats above" — reach for it only when that is literally true, and reach for the
            lightest level that reads.
          </p>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/elevation</span>
          <span>soft · hairline-first · float-only</span>
        </footer>
      </main>
    </>
  );
}
