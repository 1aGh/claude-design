/**
 * @canvas      colors-accent — SIGNATURE — the single indigo accent in context.
 *              Demonstrates --accent / --accent-hover / --accent-active /
 *              --accent-fg / --accent-muted / --accent-tint, the studio hero
 *              (accent = primary action + selection + active tab), the
 *              "one job, never decoration" anti-pattern, and accent-tint selection.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/colors-accent — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./colors-accent.css";

const FAMILY = [
  { tok: "--accent", use: "primary action · selection · text", oklch: "0.68 0.18 268" },
  { tok: "--accent-hover", use: "hover (brighter, forward)", oklch: "0.73 0.17 268" },
  { tok: "--accent-active", use: "pressed", oklch: "0.63 0.18 268" },
  { tok: "--accent-fg", use: "dark navy — text on accent fills", oklch: "0.18 0.03 268" },
  { tok: "--accent-muted", use: "subtle border / chip", oklch: "0.46 0.11 268" },
];

export default function ColorsAccent() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/colors-accent</span>
        <span className="crumbs"><span>maude</span><span>color</span><span>accent</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Accent. One indigo.</h1>
          <p className="lede">
            The whole system runs on one accent. It is not a brand color you sprinkle
            — it is a <em>signal</em>: this is the primary action, this is what you selected,
            this is the active tab. If your eye lands on the accent before it finds the
            canvas, the chrome has overstepped. One job per surface, never decoration.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Family</dt><dd>Single (indigo)</dd></div>
          <div><dt>Dark OKLCH</dt><dd>0.68 0.18 268</dd></div>
          <div><dt>Light OKLCH</dt><dd>0.52 0.195 268</dd></div>
          <div><dt>On accent</dt><dd>dark navy · AA</dd></div>
        </dl>

        <h2 data-no>In the studio <span className="h2-aside">accent in context</span></h2>
        <p>
          One unified material frames a dotted canvas. The accent appears exactly three
          times: the <strong>primary action</strong> in the toolbar, the <strong>selected node</strong>
          on the canvas, and the <strong>active layer</strong> in the tree. Count them — three.
        </p>
        <div className="acc-studio" aria-label="Studio frame — accent in context">
          <div className="acc-toolbar">
            <span className="acc-title">untitled · canvas</span>
            <span className="seg" role="group" aria-label="Tool">
              <button aria-pressed={true}>move</button>
              <button aria-pressed={false}>frame</button>
              <button aria-pressed={false}>pen</button>
            </span>
            <span className="acc-spacer" />
            <span className="presence-dot presence-dot--agent" title="AI agent" />
            <button className="btn btn--sm">Share</button>
            <button className="btn btn--primary btn--sm">Hand off →</button>
          </div>

          <nav className="acc-layers" aria-label="Layers">
            <div className="tree-row">Frame · Hero</div>
            <div className="tree-row" aria-selected="true">Card · Pricing</div>
            <div className="tree-row">Text · Headline</div>
            <div className="tree-row">Group · Footer</div>
          </nav>

          <div className="acc-canvas">
            <div className="acc-readout">x 248 · y 96 · w 168</div>
            <div className="acc-node acc-node--sel">
              Card · Pricing
              <span className="acc-handle tl" /><span className="acc-handle tr" />
              <span className="acc-handle bl" /><span className="acc-handle br" />
            </div>
            <div className="acc-agent">
              <span className="presence-dot presence-dot--agent" />
              <span className="lbl">agent · drafting</span>
            </div>
          </div>

          <aside className="acc-insp" aria-label="Inspector">
            <div className="panel-hd" style={{ padding: 0, border: 0 }}>Properties</div>
            <div className="insp-row"><span className="insp-label">X</span><span className="insp-fields"><span className="field">248</span><span className="field">96</span></span></div>
            <div className="insp-row"><span className="insp-label">Size</span><span className="insp-fields"><span className="field">168</span><span className="field">116</span></span></div>
            <div className="insp-row"><span className="insp-label">Fill</span><span className="tag tag--accent">accent</span></div>
            <button className="btn btn--primary" style={{ marginTop: "var(--space-3)" }}>Apply</button>
          </aside>
        </div>

        <h2 data-no>The family <span className="h2-aside">five tokens, one hue</span></h2>
        <div className="grid acc-fam">
          {FAMILY.map((f) => (
            <div className="swatch" key={f.tok}>
              <div
                className="chip"
                style={{
                  background: `var(${f.tok})`,
                  // --accent-fg is near-white — show it framed so it reads on the card
                  border: f.tok === "--accent-fg" ? "1px solid var(--border-default)" : undefined,
                }}
              />
              <div className="meta">
                <strong>{f.tok}</strong>
                <span className="oklch">{f.oklch}</span>
                <span style={{ display: "block", marginTop: 4, color: "var(--fg-2)" }}>{f.use}</span>
              </div>
            </div>
          ))}
        </div>

        <h2 data-no>One job, never decoration <span className="h2-aside">good · wrong</span></h2>
        <div className="acc-vs">
          <figure className="ok">
            <div className="demo">
              <button className="btn btn--primary">Hand off</button>
              <button className="btn">Duplicate</button>
              <button className="btn btn--ghost">Rename</button>
              <span className="tag">draft</span>
            </div>
            <figcaption>✓ accent once — the eye knows the primary</figcaption>
          </figure>
          <figure className="no">
            <div className="demo">
              <button className="btn">Hand off</button>
              <button className="btn">Duplicate</button>
              <button className="btn">Rename</button>
              <span className="tag tag--accent">draft</span>
            </div>
            <figcaption>✕ accent everywhere — nothing leads</figcaption>
          </figure>
        </div>

        <h2 data-no>Selection &amp; presence <span className="h2-aside">accent-tint, never a fill</span></h2>
        <p>
          Selected rows use <code>--accent-tint</code> (a 16% wash) plus an inset accent
          bar — present, calm, legible. The agent gets its own presence hue so you always
          know who is touching the canvas.
        </p>
        <nav className="acc-layers" aria-label="Selection example" style={{ maxWidth: 320, border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--bg-1)" }}>
          <div className="tree-row">Untouched row</div>
          <div className="tree-row" aria-selected="true">Selected — accent-tint + inset bar</div>
          <div className="tree-row"><span className="presence-dot presence-dot--agent" /> agent is here</div>
        </nav>

        <footer className="specimen-ft">
          <span>MAUDE/colors-accent</span>
          <span>accent · single · indigo 268</span>
        </footer>
      </main>
    </>
  );
}
