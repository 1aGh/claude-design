/**
 * @canvas      opacity — opacity ladder for disabled / pressed / overlay scrim.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.opacity / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/opacity/
 * @handoff     bunx shadcn add file://./opacity.registry.json
 */

import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
export default function Opacity() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.opacity</span><span className="crumbs"><span>maude</span><span>design system</span><span>foundation</span><span>opacity</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Opacity</h1><p className="lede">Disabled is 0.5. Press-armed is 0.7. Scrim is 0.6. That's it. No graduated alpha-fog for "atmosphere".</p></section>
            <dl className="specimen-meta"><div><dt>Levels</dt><dd>4</dd></div><div><dt>Use</dt><dd>state, not decoration</dd></div></dl>

            <h2 data-no="01">Levels</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: '0' }}>
              <div style={{ padding: 'var(--space-5)', background: 'var(--bg-1)', border: '1px solid var(--border-default)', textAlign: 'center' }}><div className="eyebrow">1.0</div><p style={{ margin: 'var(--space-3) 0 0', color: 'var(--fg-0)' }}>Default</p></div>
              <div style={{ padding: 'var(--space-5)', background: 'var(--bg-1)', border: '1px solid var(--border-default)', textAlign: 'center' }}><div className="eyebrow">0.7</div><p style={{ margin: 'var(--space-3) 0 0', color: 'var(--fg-0)', opacity: '0.7' }}>Press-armed</p></div>
              <div style={{ padding: 'var(--space-5)', background: 'var(--bg-1)', border: '1px solid var(--border-default)', textAlign: 'center' }}><div className="eyebrow">0.5</div><p style={{ margin: 'var(--space-3) 0 0', color: 'var(--fg-0)', opacity: '0.5' }}>Disabled</p></div>
              <div style={{ padding: 'var(--space-5)', background: 'var(--bg-1)', border: '1px solid var(--border-default)', textAlign: 'center' }}><div className="eyebrow">0.6 scrim</div><p style={{ margin: 'var(--space-3) 0 0', color: 'var(--fg-0)' }}>Behind a dialog</p></div>
            </div>

            <h2 data-no="02">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't use opacity for "ambient" texture. Fading a hero bg to 0.4 to "soften" it is decoration, and the catalog aesthetic doesn't soften anything.</p></div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· opacity</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
