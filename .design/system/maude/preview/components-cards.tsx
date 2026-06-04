/**
 * SPECIMEN: components-cards
 * DEMONSTRATES: .panel, .panel-hd, .panel-bd material as cards; .insp-row, .field,
 *   .tag/.tag--accent, .chip, .presence-dot; --bg-1/2, --border-subtle/default/strong,
 *   --radius-md, --shadow-sm/md, --dur-soft, --ease-out
 * COMPOSITION: the ONE panel material reused as three studio cards — a node/artboard
 *   card (with a live dotted-canvas thumbnail), a properties card, a hand-off card.
 *   Hierarchy from hairline + bg step, never shadow alone. Hover lift is transform-only.
 * COPY VOICE: real studio nouns — artboard, frame, node, inspector, hand off — terse.
 * WHEN SCAFFOLDED: always (Core)
 * NOTES: cards are stationary → flat (--shadow-sm). The popover card floats → --shadow-md.
 *   Hover lift animates translateY only (compositor-safe); reduced-motion collapses --dur-*.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-cards.css";

export default function ComponentsCards() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-cards</span>
        <span className="crumbs"><span>maude</span><span>components</span><span>cards</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Cards. One material, three jobs.</h1>
          <p className="lede">
            A card is just the panel material at a different scale — same hairline,
            same radius, same elevation. Hierarchy comes from the border-plus-surface
            step, not from stacking shadows. Stationary cards stay flat; only things
            that genuinely float earn a shadow.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Material</dt><dd>.panel — shared</dd></div>
          <div><dt>Elevation</dt><dd>flat · hover-lift · float</dd></div>
          <div><dt>Radius</dt><dd>--radius-md</dd></div>
          <div><dt>Accent</dt><dd>selection only</dd></div>
        </dl>

        <h2 data-no>The node card <span className="h2-aside">artboard · selectable</span></h2>
        <p>
          The workhorse: a frame on the canvas, surfaced as a card. The thumbnail is
          the real dotted surface in miniature. Hover lifts it one step on the
          z-axis — a <code>translateY</code>, nothing more. Selection is the only place
          the accent appears.
        </p>
        <div className="card-rail">
          <article className="panel node-card is-selected" aria-label="Pricing frame — selected">
            <div className="node-thumb" aria-hidden="true">
              <span className="thumb-block tb-a" />
              <span className="thumb-block tb-b" />
              <span className="thumb-block tb-c" />
            </div>
            <div className="panel-bd node-meta">
              <div className="node-row">
                <span className="node-name">Frame · Pricing</span>
                <span className="tag tag--accent">selected</span>
              </div>
              <span className="node-sub">320 × 540 · edited 4m ago</span>
            </div>
          </article>

          <article className="panel node-card" aria-label="Hero frame">
            <div className="node-thumb node-thumb--hero" aria-hidden="true">
              <span className="thumb-bar" /><span className="thumb-wide" />
            </div>
            <div className="panel-bd node-meta">
              <div className="node-row">
                <span className="node-name">Frame · Hero</span>
                <span className="chip">synced</span>
              </div>
              <span className="node-sub">1440 × 720 · 6 nodes</span>
            </div>
          </article>

          <article className="panel node-card node-card--new" aria-label="New artboard">
            <button className="new-art" type="button">
              <svg className="g" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4v8M4 8h8" /></svg>
              New artboard
            </button>
          </article>
        </div>

        <h2 data-no>Two specialised cards <span className="h2-aside">properties · hand off</span></h2>
        <p>
          The same material adapts to dense data. The properties card packs the
          inspector&apos;s tabular fields; the hand-off card carries the single primary
          action. Both share the toolbar&apos;s hairlines exactly — that sameness is the
          whole point.
        </p>
        <div className="card-pair">
          <section className="panel props-card" aria-label="Properties">
            <div className="panel-hd">Properties<span className="presence-dot presence-dot--agent" title="agent is editing" /></div>
            <div className="panel-bd">
              <div className="insp-row"><span className="insp-label">Pos</span><span className="insp-fields"><span className="field">248</span><span className="field">96</span></span></div>
              <div className="insp-row"><span className="insp-label">Size</span><span className="insp-fields"><span className="field">320</span><span className="field">540</span></span></div>
              <div className="insp-row"><span className="insp-label">Radius</span><span className="insp-fields"><span className="field">7</span></span></div>
              <div className="insp-row"><span className="insp-label">Fill</span><span className="insp-fields"><span className="field">bg-1</span></span></div>
              <div className="props-foot">
                <button className="btn btn--sm">Reset</button>
                <button className="btn btn--primary btn--sm">Apply</button>
              </div>
            </div>
          </section>

          <section className="panel handoff-card" aria-label="Hand off">
            <div className="panel-hd">Hand off<span className="hd-meta">checkout · v3</span></div>
            <div className="panel-bd">
              <p className="handoff-lede">
                Ship the selected frame to production as a typed component drop —
                tokens, props and the inspector readout travel with it.
              </p>
              <ul className="handoff-list">
                <li><svg className="g" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-8" /></svg>3 frames · 1 token set</li>
                <li><svg className="g" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-8" /></svg>registry-item.json sidecar</li>
              </ul>
              <button className="btn btn--primary handoff-cta">
                Hand off
                <svg className="g" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M9 5l3 3-3 3" /></svg>
              </button>
            </div>
          </section>
        </div>

        <h2 data-no>Elevation is a signal <span className="h2-aside">flat vs. floating</span></h2>
        <p>
          Reserve the shadow for things that genuinely sit above the page. A stationary
          card stays flat — the hairline already separates it. A popover earns
          <code> --shadow-md</code> because it interrupts.
        </p>
        <div className="elev-vs">
          <figure className="ok">
            <div className="panel elev-flat"><div className="panel-bd">Stationary node card — flat, hairline only</div></div>
            <figcaption>✓ shadow reserved for floats</figcaption>
          </figure>
          <figure className="no">
            <div className="panel elev-float"><div className="panel-bd">Same card, drop-shadowed — now everything floats</div></div>
            <figcaption>✕ shadow as decoration — depth goes flat</figcaption>
          </figure>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-cards</span>
          <span>one panel material · hairline hierarchy</span>
        </footer>
      </main>
    </>
  );
}
