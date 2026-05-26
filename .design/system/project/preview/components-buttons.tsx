/**
 * @canvas      components-buttons — button variants — primary / default / ghost / quiet + sizes + kbd hints.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-buttons / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-buttons/
 * @handoff     bunx shadcn add file://./components-buttons.registry.json
 */

import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
export default function ComponentsButtons() {
  return (
    <>
          <header className="specimen-hd">
            <span className="sku">MDCC-DSN/01.components-buttons</span>
            <span className="crumbs"><span>maude</span><span>design system</span><span>components</span><span>buttons</span></span>
            <ThemeToggle />
          </header>
          <main className="specimen">
            <section className="specimen-title">
              <h1>Buttons</h1>
              <p className="lede">Four variants. Three sizes. One accent. The primary is amber-rust on hover-friendly transition. The default={true} carries the catalog-edge feel. Ghost and quiet are for "yes but don't bother me".</p>
            </section>
            <dl className="specimen-meta">
              <div><dt>Variants</dt><dd>primary · default={true} · ghost · quiet</dd></div>
              <div><dt>Sizes</dt><dd>sm · md · lg</dd></div>
              <div><dt>States</dt><dd>idle · hover · active · disabled={true} · focus</dd></div>
            </dl>

            <h2 data-no="01">Variants</h2>
            <div className="row">
              <button className="btn btn--primary">Install plugin</button>
              <button className="btn">Inspect canvas</button>
              <button className="btn btn--ghost">Cancel</button>
              <button className="btn btn--quiet">Skip</button>
            </div>

            <h2 data-no="02">With kbd hints</h2>
            <div className="row">
              <button className="btn btn--primary"><span>Open canvas</span><span className="kbd">⌘O</span></button>
              <button className="btn"><span>Run critic</span><span className="kbd">⌘⇧K</span></button>
              <button className="btn btn--ghost"><span>Reset</span><span className="kbd">esc</span></button>
            </div>

            <h2 data-no="03">Sizes</h2>
            <div className="row">
              <button className="btn btn--sm">small</button>
              <button className="btn">medium · default</button>
              <button className="btn btn--lg">large</button>
            </div>

            <h2 data-no="04">States</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: 'var(--space-4) 0' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border-strong)' }}><th style={{ textAlign: 'left', padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', letterSpacing: 'var(--tracking-sku)', textTransform: 'uppercase', color: 'var(--fg-2)' }}>State</th><th style={{ textAlign: 'left', padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', letterSpacing: 'var(--tracking-sku)', textTransform: 'uppercase', color: 'var(--fg-2)' }}>Primary</th><th style={{ textAlign: 'left', padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', letterSpacing: 'var(--tracking-sku)', textTransform: 'uppercase', color: 'var(--fg-2)' }}>Default</th></tr></thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><td style={{ padding: 'var(--space-3)', color: 'var(--fg-2)', fontSize: 'var(--type-sm)' }}>idle</td><td style={{ padding: 'var(--space-3)' }}><button className="btn btn--primary">Install</button></td><td style={{ padding: 'var(--space-3)' }}><button className="btn">Inspect</button></td></tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}><td style={{ padding: 'var(--space-3)', color: 'var(--fg-2)', fontSize: 'var(--type-sm)' }}>disabled</td><td style={{ padding: 'var(--space-3)' }}><button className="btn btn--primary" disabled={true}>Install</button></td><td style={{ padding: 'var(--space-3)' }}><button className="btn" disabled={true}>Inspect</button></td></tr>
              </tbody>
            </table>

            <h2 data-no="05">Icon-only</h2>
            <div className="row">
              <button className="btn btn--icon" aria-label="open file-tree">▸</button>
              <button className="btn btn--icon btn--primary" aria-label="snapshot">●</button>
              <button className="btn btn--icon btn--ghost" aria-label="settings">⚙</button>
              <button className="btn btn--icon btn--quiet" aria-label="close">✗</button>
            </div>

            <h2 data-no="06">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't pair two primaries in the same flow. The amber-rust is the "main action of this page" stamp. Two competing primaries means the page doesn't know what it's for.</p></div>

            <footer className="specimen-ft">
              <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-buttons</span></div>
              <div className="colo-block"><span>Maude · v0.12.0</span></div>
            </footer>
          </main>
        </>
  );
}
