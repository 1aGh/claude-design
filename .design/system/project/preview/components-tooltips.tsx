/**
 * @canvas      components-tooltips — tooltip — pure positioned chip, no gradient or blur bg.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-tooltips / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-tooltips/
 * @handoff     bunx shadcn add file://./components-tooltips.registry.json
 */

import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
export default function ComponentsTooltips() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.components-tooltips</span><span className="crumbs"><span>maude</span><span>design system</span><span>components</span><span>tooltips</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Tooltips</h1><p className="lede">Inverted-ink chip on hover/focus. Solid bg, no backdrop blur. <code>--dur-soft</code> opacity fade only. Reduced-motion users get an instant chip.</p></section>
            <dl className="specimen-meta"><div><dt>Trigger</dt><dd>hover · focus-visible</dd></div><div><dt>Duration</dt><dd>--dur-soft (180ms)</dd></div></dl>

            <h2 data-no="01">Hover the buttons</h2>
            <div className="row" style={{ marginTop: 'var(--space-7)' }}>
              <span className="tooltip"><button className="btn">Install</button><span className="tip">mdcc install MDCC-DSN/01</span></span>
              <span className="tooltip"><button className="btn">Inspect</button><span className="tip">Cmd+Click to pick an element</span></span>
              <span className="tooltip"><button className="btn btn--primary">Snapshot</button><span className="tip">Saves to _history/&lt;slug&gt;/</span></span>
              <span className="tooltip"><button className="btn btn--icon" aria-label="settings">⚙</button><span className="tip">/design:setup-docs · scaffolds a docs site. (Yes, this one too.)</span></span>
            </div>

            <h2 data-no="02">On inline elements</h2>
            <p>Hover the <span className="tooltip" style={{ borderBottom: '1px dotted var(--accent)', cursor: 'help' }}><span>SKU</span><span className="tip">MDCC-DSN/01 · design system</span></span> label in any catalog row to see the canonical part-number framing.</p>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-tooltips</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
