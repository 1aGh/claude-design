/**
 * @canvas      radii — hard-edges. Radii collapse to 0/2/4. No --radius-lg.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.radii / md-claude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/radii/
 * @handoff     bunx shadcn add file://./radii.registry.json
 */
export default function Radii() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.radii</span><span className="crumbs"><span>md-claude</span><span>design system</span><span>foundation</span><span>radii</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Radii</h1><p className="lede">Sharp corners. The radius scale has three meaningful values (0, 2, 4) and <code>--radius-lg / --radius-xl</code> clamp to 4 so nothing gets rounded over. If you find yourself reaching for 12 or 16, you're on the wrong DS.</p></section>
            <dl className="specimen-meta"><div><dt>Steps</dt><dd>3 unique (xs/sm/md)</dd></div><div><dt>Maximum</dt><dd>4px (--radius-md / lg / xl all clamp)</dd></div></dl>

            <h2 data-no="01">The ladder</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: '0' }}>
              <div style={{ padding: 'var(--space-5)', background: 'var(--bg-1)', border: '1px solid var(--border-default)', textAlign: 'center' }}><div style={{ width: '80px', height: '80px', background: 'var(--accent)', borderRadius: 'var(--radius-xs)', margin: '0 auto' }}></div><div className="eyebrow" style={{ marginTop: 'var(--space-3)' }}>--radius-xs · 0</div></div>
              <div style={{ padding: 'var(--space-5)', background: 'var(--bg-1)', border: '1px solid var(--border-default)', textAlign: 'center' }}><div style={{ width: '80px', height: '80px', background: 'var(--accent)', borderRadius: 'var(--radius-sm)', margin: '0 auto' }}></div><div className="eyebrow" style={{ marginTop: 'var(--space-3)' }}>--radius-sm · 2px</div></div>
              <div style={{ padding: 'var(--space-5)', background: 'var(--bg-1)', border: '1px solid var(--border-default)', textAlign: 'center' }}><div style={{ width: '80px', height: '80px', background: 'var(--accent)', borderRadius: 'var(--radius-md)', margin: '0 auto' }}></div><div className="eyebrow" style={{ marginTop: 'var(--space-3)' }}>--radius-md · 4px</div></div>
            </div>

            <h2 data-no="02">In context</h2>
            <div className="row">
              <button className="btn">--radius-sm</button>
              <input className="input" placeholder="--radius-sm" style={{ maxWidth: '200px' }} />
              <span className="badge badge--accent">badge · 0</span>
              <span className="sku">SKU · 0</span>
            </div>

            <h2 data-no="03">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't add <code>border-radius: 12px</code> or <code>16px</code> anywhere. The hard-edges family is the brand. Soft corners belong to other DSes.</p></div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· radii</span></div><div className="colo-block"><span>md-claude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
