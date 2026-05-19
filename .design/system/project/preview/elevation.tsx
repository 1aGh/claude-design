/**
 * @canvas      elevation — depth-via-rules, not depth-via-shadow. --shadow-* are deliberately none.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.elevation / md-claude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/elevation/
 * @handoff     bunx shadcn add file://./elevation.registry.json
 */
export default function Elevation() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.elevation</span><span className="crumbs"><span>md-claude</span><span>design system</span><span>foundation</span><span>elevation</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Elevation</h1><p className="lede">There isn't a shadow ladder. <code>--shadow-sm/md/lg</code> are all <code>none</code>. Depth in this DS is bg-shift + 1px rule, repeated. The only blur in the system is <code>--shadow-focus</code>. That's the focus ring.</p></section>
            <dl className="specimen-meta"><div><dt>Shadow tokens</dt><dd>none / none / none / focus-ring only</dd></div><div><dt>Depth method</dt><dd>bg-shift + hairline</dd></div></dl>

            <h2 data-no="01">The ladder <span className="h2-aside">bg-shift counts as elevation</span></h2>
            <div style={{ background: 'var(--bg-0)', padding: 'var(--space-7)', border: '1px solid var(--border-strong)' }}>
              <div className="eyebrow">depth 0 · --bg-0 · page</div>
              <div style={{ background: 'var(--bg-1)', padding: 'var(--space-5)', border: '1px solid var(--border-default)', margin: 'var(--space-4) 0' }}>
                <div className="eyebrow">depth 1 · --bg-1 · card on page</div>
                <div style={{ background: 'var(--bg-2)', padding: 'var(--space-4)', border: '1px solid var(--border-default)', margin: 'var(--space-3) 0' }}>
                  <div className="eyebrow">depth 2 · --bg-2 · popover/menu over card</div>
                  <div style={{ background: 'var(--bg-3)', padding: 'var(--space-3)', border: '1px solid var(--border-default)', margin: 'var(--space-2) 0' }}>
                    <div className="eyebrow">depth 3 · --bg-3 · input over popover</div>
                    <div style={{ background: 'var(--bg-4)', padding: 'var(--space-3)', border: '1px solid var(--border-default)', margin: 'var(--space-2) 0', color: 'var(--fg-1)', fontSize: 'var(--type-sm)' }}>depth 4 · --bg-4 · pressed state</div>
                  </div>
                </div>
              </div>
            </div>

            <h2 data-no="02">Focus ring <span className="h2-aside">the only blur in the DS</span></h2>
            <div className="row">
              <button className="btn btn--primary" autofocus={true}>Focused primary</button>
              <input className="input" placeholder="Tab here to see the ring" style={{ maxWidth: '280px' }} />
            </div>

            <h2 data-no="03">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't add <code>box-shadow: 0 4px 12px rgba(0,0,0,0.2)</code> to any tile, card, or panel. The bg-shift + 1px rule does the job. Shadow breaks the signature and the critic panel will block it.</p></div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· elevation</span></div><div className="colo-block"><span>md-claude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
