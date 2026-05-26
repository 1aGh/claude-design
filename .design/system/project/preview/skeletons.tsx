/**
 * @canvas      skeletons — skeleton loading placeholders — flat bg-2 blocks, no shimmer.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.skeletons / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/skeletons/
 * @handoff     bunx shadcn add file://./skeletons.registry.json
 */
import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
import "./skeletons.css";

export default function Skeletons() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.skeletons</span><span className="crumbs"><span>maude</span><span>design system</span><span>status</span><span>skeletons</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Skeletons</h1><p className="lede">Flat <code>--bg-2</code> rectangles with a hairline border. No shimmer animation. The catalog hard-NO on "animations beyond hover" applies. Skeletons say "loading", not "look at me".</p></section>
            <dl className="specimen-meta"><div><dt>Token</dt><dd>--bg-2 fill · --border-subtle outline</dd></div><div><dt>Animation</dt><dd>none. By design.</dd></div></dl>

            <h2 data-no="01">Tile skeleton</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: '0' }}>
              <div className="tile">
                <div className="tile-hd"><span className="skel" style={{ width: '80px' }}></span><span className="skel" style={{ width: '50px' }}></span></div>
                <div className="tile-bd">
                  <span className="skel skel-tall" style={{ width: '60%', marginBottom: 'var(--space-3)' }}></span>
                  <span className="skel" style={{ width: '90%', marginBottom: 'var(--space-2)' }}></span>
                  <span className="skel" style={{ width: '85%', marginBottom: 'var(--space-2)' }}></span>
                  <span className="skel" style={{ width: '70%' }}></span>
                </div>
                <div className="tile-ft"><span className="skel" style={{ width: '60px' }}></span><span className="skel" style={{ width: '80px' }}></span></div>
              </div>
              <div className="tile">
                <div className="tile-hd"><span className="skel" style={{ width: '80px' }}></span><span className="skel" style={{ width: '50px' }}></span></div>
                <div className="tile-bd">
                  <span className="skel skel-tall" style={{ width: '60%', marginBottom: 'var(--space-3)' }}></span>
                  <span className="skel" style={{ width: '90%', marginBottom: 'var(--space-2)' }}></span>
                  <span className="skel" style={{ width: '85%', marginBottom: 'var(--space-2)' }}></span>
                  <span className="skel" style={{ width: '70%' }}></span>
                </div>
                <div className="tile-ft"><span className="skel" style={{ width: '60px' }}></span><span className="skel" style={{ width: '80px' }}></span></div>
              </div>
            </div>

            <h2 data-no="02">Table skeleton</h2>
            <div style={{ border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 80px 100px', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-2)', borderBottom: '1px solid var(--border-strong)' }}>
                <span className="skel" style={{ width: '60px' }}></span><span className="skel" style={{ width: '120px' }}></span><span className="skel" style={{ width: '50px' }}></span><span className="skel" style={{ width: '50px' }}></span><span className="skel" style={{ width: '80px' }}></span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 80px 100px', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}><span className="skel"></span><span className="skel" style={{ width: '80%' }}></span><span className="skel"></span><span className="skel"></span><span className="skel"></span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 80px 100px', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}><span className="skel"></span><span className="skel" style={{ width: '70%' }}></span><span className="skel"></span><span className="skel"></span><span className="skel"></span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 80px 100px', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}><span className="skel"></span><span className="skel" style={{ width: '90%' }}></span><span className="skel"></span><span className="skel"></span><span className="skel"></span></div>
            </div>

            <h2 data-no="03">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't add a <code>@keyframes shimmer</code> on these blocks. The static rectangle is the answer. If something's loading slow enough to need a shimmer, surface the actual progress (badge: <code>fetching · 2.4s</code>).</p></div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· skeletons</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
