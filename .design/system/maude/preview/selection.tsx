/**
 * @canvas      selection — one selection language across three surfaces. Text
 *              selection (::selection = accent-tint), the selected layer row
 *              (accent-tint + inset accent bar), and the canvas marquee
 *              (accent-tint fill + 1px accent stroke + handles). In maude
 *              the accent-tint wash is THE selection signal everywhere — text,
 *              row, and node read as one idea, the way the chrome stays unified.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/selection — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./selection.css";

const LAYERS = [
  { name: "Frame · Hero", depth: 0, sel: false },
  { name: "Card · Pricing", depth: 1, sel: true },
  { name: "Text · Headline", depth: 1, sel: true },
  { name: "Image · Avatar", depth: 1, sel: false },
  { name: "Group · Footer", depth: 0, sel: false },
];

export default function Selection() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/selection</span>
        <span className="crumbs"><span>maude</span><span>foundation</span><span>selection</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Selection. One tint, three surfaces.</h1>
          <p className="lede">
            Text, layer row, canvas node — all three say "selected" with the same
            <code> --accent-tint</code> wash. That single language is the point: a maude user
            never relearns what selection looks like moving from the inspector to the canvas. The
            accent stays a tint (never a heavy fill), backed by a 1px accent edge so it reads as
            current, calmly.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Signal</dt><dd>--accent-tint (≈16% wash)</dd></div>
          <div><dt>Text</dt><dd>::selection = tint, fg-0 kept</dd></div>
          <div><dt>Row</dt><dd>tint + inset accent bar</dd></div>
          <div><dt>Node</dt><dd>tint fill + 1px accent stroke</dd></div>
        </dl>

        <h2 data-no>Text selection <span className="h2-aside">drag-select this</span></h2>
        <p>
          The <code>::selection</code> pseudo paints the accent-tint behind the glyphs and keeps
          <code> --fg-0</code> on top, so highlighted prose stays fully legible in both themes —
          OKLCH carries the mix cleanly across dark and light without per-theme tuning.
        </p>
        <div className="sel-text">
          <p>
            Drag across this paragraph to select it. The highlight is the same indigo tint that
            marks a selected layer or a node on the canvas — one signal, learned once. Selection
            spans line breaks and never drops the foreground contrast, because the tint is a wash
            over the surface, not a solid block that swallows the text underneath it.
          </p>
        </div>

        <h2 data-no>Layer rows <span className="h2-aside">tint + inset accent bar</span></h2>
        <p>
          A selected row gets the tint plus a 2px inset accent bar on its leading edge — present
          and scannable down a dense tree. Multi-select shares the language: every row in the set
          carries the same wash, so a range reads as one selection, not five highlights.
        </p>
        <nav className="sel-layers" aria-label="Layers — multi-select">
          {LAYERS.map((l) => (
            <div
              className="tree-row sel-row"
              key={l.name}
              aria-selected={l.sel || undefined}
              style={{ paddingLeft: `calc(var(--space-3) + ${l.depth} * var(--space-5))` }}
            >
              <span className="sel-disc" aria-hidden="true" />
              {l.name}
            </div>
          ))}
        </nav>
        <p className="sel-aside mono">2 selected · ⇧-click extends · Esc clears</p>

        <h2 data-no>Canvas marquee <span className="h2-aside">drag-box on the dotted canvas</span></h2>
        <p>
          On the canvas, a drag-box is the marquee: an accent-tint fill bounded by a 1px accent
          stroke, with corner handles once the drag settles. Nodes caught inside pick up the same
          selected edge — the marquee and the node share the tint, so the gesture and its result
          look like one thing.
        </p>
        <div className="canvas sel-canvas" aria-label="Canvas with a marquee selection">
          <div className="sel-node sel-node--a">
            <span className="sel-node-tag mono">card · pricing</span>
            <span className="sel-handle tl" /><span className="sel-handle tr" />
            <span className="sel-handle bl" /><span className="sel-handle br" />
          </div>
          <div className="sel-node sel-node--b">
            <span className="sel-node-tag mono">text · headline</span>
            <span className="sel-handle tl" /><span className="sel-handle tr" />
            <span className="sel-handle bl" /><span className="sel-handle br" />
          </div>
          <div className="sel-node sel-node--out"><span className="sel-node-tag mono">image · avatar</span></div>
          <div className="sel-marquee" aria-hidden="true">
            <span className="sel-marquee-readout mono">2 selected · 312 × 188</span>
          </div>
        </div>

        <h2 data-no>The rule <span className="h2-aside">tint signals, fill commits</span></h2>
        <p>
          Selection is always a <em>tint</em>. A solid accent fill is reserved for a committed
          action — the primary button, a toggled-on control. If selecting something filled it
          solid, the eye could not tell "I have this highlighted" from "this is doing something."
          The tint holds that line.
        </p>
        <div className="sel-vs">
          <div className="sel-vs-card">
            <span className="sel-vs-swatch" style={{ background: "var(--accent-tint)" }} />
            <div><strong>tint → selected</strong><span className="sel-use">highlighted, not yet acting</span></div>
          </div>
          <div className="sel-vs-card">
            <span className="sel-vs-swatch" style={{ background: "var(--accent)" }} />
            <div><strong>fill → committed</strong><span className="sel-use">primary action / toggled on</span></div>
          </div>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/selection</span>
          <span>one tint · text · row · marquee · fill = commit</span>
        </footer>
      </main>
    </>
  );
}
