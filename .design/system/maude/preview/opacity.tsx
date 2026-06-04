/**
 * @canvas      opacity — the short, calm opacity ladder and the three things
 *              it builds: the accent-tint wash (selection / active row), the
 *              disabled state (fg-3 + reduced opacity, never a grey token), and
 *              overlay scrims (the dialog veil over the canvas). Opacity is a
 *              value, not a token — the ladder exists to keep usage consistent.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/opacity — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./opacity.css";

const RAMP = [
  { o: 0.08, role: "hairline wash", use: "ghost separators, the faintest hover" },
  { o: 0.16, role: "accent-tint", use: "selection, active row — the --accent-tint mix" },
  { o: 0.4, role: "light scrim", use: "soft dim over an inactive region" },
  { o: 0.6, role: "veil", use: "dialog / command-palette backdrop" },
  { o: 1.0, role: "opaque", use: "the default — no transparency" },
];

export default function Opacity() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/opacity</span>
        <span className="crumbs"><span>maude</span><span>foundation</span><span>opacity</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Opacity. A calm ladder.</h1>
          <p className="lede">
            Opacity is a value, not a token — so this is a short, disciplined ladder rather than a
            palette. It builds three things, each once: the accent-tint wash behind a selection,
            the disabled state, and the scrim that dims the canvas under a dialog. Used sparingly,
            it stays calm; sprinkled everywhere, it turns the chrome murky.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Status</dt><dd>value, not a token</dd></div>
          <div><dt>Ladder</dt><dd>0.08 · 0.16 · 0.4 · 0.6 · 1.0</dd></div>
          <div><dt>Tint mix</dt><dd>--accent-tint (≈16% accent)</dd></div>
          <div><dt>Disabled</dt><dd>--fg-3 · never a grey token</dd></div>
        </dl>

        <h2 data-no>The ramp <span className="h2-aside">accent over the dotted canvas</span></h2>
        <p>
          The accent at five steps, laid over the canvas so the dots read through the lighter
          stops — exactly how a tint behaves in the product. The two low stops are the working
          range; 0.4–0.6 are scrims; 1.0 is the rare opaque fill.
        </p>
        <div className="op-ramp">
          {RAMP.map((r) => (
            <div className="op-chip" key={r.o}>
              <div className="op-chip-fill" style={{ opacity: r.o }} />
              <div className="op-chip-meta">
                <strong className="mono">{r.o.toFixed(2)}</strong>
                <span className="op-role">{r.role}</span>
                <span className="op-use">{r.use}</span>
              </div>
            </div>
          ))}
        </div>

        <h2 data-no>Accent-tint, never a fill <span className="h2-aside">selection · active row</span></h2>
        <p>
          Selection is a tint, not a solid block. <code>--accent-tint</code> mixes the accent at
          ~16% into the surface — present and legible, never a heavy slab. Pair it with an inset
          accent bar and the row reads as <em>current</em> without shouting.
        </p>
        <div className="op-tint-demo">
          <div className="op-layers panel">
            <div className="panel-hd" style={{ padding: "var(--space-3) var(--space-4)" }}>Layers</div>
            <div className="panel-bd" style={{ padding: "var(--space-2)" }}>
              <div className="tree-row">Frame · Hero</div>
              <div className="tree-row" aria-selected="true">Card · Pricing — tint + inset bar</div>
              <div className="tree-row">Text · Headline</div>
              <div className="tree-row">Group · Footer</div>
            </div>
          </div>
          <div className="op-tint-note">
            <span className="op-swatch op-swatch--tint" />
            <div>
              <strong>--accent-tint</strong>
              <p className="mono">color-mix(in oklab, var(--accent) 16%, transparent)</p>
              <p className="op-use">One wash for both text selection and the active list row.</p>
            </div>
          </div>
        </div>

        <h2 data-no>Disabled <span className="h2-aside">fg-3, not a grey token</span></h2>
        <p>
          A disabled control drops to <code>--fg-3</code> and refuses pointer events — it does not
          get its own muted color. Same shape, same border, lower-contrast text. The eye skips it
          without a separate palette entry to maintain.
        </p>
        <div className="row">
          <button className="btn btn--primary">Hand off</button>
          <button className="btn btn--primary" disabled>Hand off</button>
          <span className="op-divider" />
          <button className="btn">Duplicate</button>
          <button className="btn" disabled>Duplicate</button>
        </div>

        <h2 data-no>Scrims <span className="h2-aside">dimming the canvas under a dialog</span></h2>
        <p>
          A modal drops a scrim over the canvas — <code>oklch(0 0 0 / 0.6)</code> — so focus moves
          to the surface on top. The dialog keeps the shared chrome material; the scrim is the only
          new ink, and it dims rather than recolors.
        </p>
        <div className="op-scrim-stage canvas">
          <div className="op-scrim-content" aria-hidden="true">
            <div className="op-ghost-node" /><div className="op-ghost-node op-ghost-node--b" />
          </div>
          <div className="op-scrim" />
          <div className="op-dialog panel">
            <div className="panel-hd" style={{ padding: "var(--space-3) var(--space-4)" }}>Hand off to code</div>
            <div className="panel-bd">
              <p style={{ margin: "0 0 var(--space-4)", color: "var(--fg-1)" }}>
                Export the selected frame as a production component.
              </p>
              <div className="row" style={{ margin: 0, justifyContent: "flex-end" }}>
                <button className="btn btn--ghost">Cancel</button>
                <button className="btn btn--primary">Hand off →</button>
              </div>
            </div>
          </div>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/opacity</span>
          <span>value not token · tint · disabled fg-3 · scrim 0.6</span>
        </footer>
      </main>
    </>
  );
}
