/**
 * @canvas      components-cards — tile (catalog SKU card) + plain card variants.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-cards / md-claude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-cards/
 * @handoff     bunx shadcn add file://./components-cards.registry.json
 */
export default function ComponentsCards() {
  return (
    <>
          <header className="specimen-hd">
            <span className="sku">MDCC-DSN/01.components-cards</span>
            <span className="crumbs"><span>md-claude</span><span>design system</span><span>components</span><span>cards</span></span>
            <span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span>
          </header>
          <main className="specimen">
            <section className="specimen-title">
              <h1>Cards &amp; tiles</h1>
              <p className="lede">A plugin is a catalog product. A canvas is a plate in the catalog. Both get a tile. SKU at the top-left, version at the top-right, body in the middle, footnote at the bottom. Plain cards (no part-number bar) are for everything else.</p>
            </section>
            <dl className="specimen-meta">
              <div><dt>Variants</dt><dd>tile · tile--accent · card · card--inset</dd></div>
              <div><dt>Used for</dt><dd>plugins · canvas previews · spec callouts</dd></div>
            </dl>

            <h2 data-no="01">Tile (catalog SKU)</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: '0' }}>
              <div className="tile">
                <div className="tile-hd"><span className="sku">MDCC-DSN/01</span><span>v0.12.0</span></div>
                <div className="tile-bd">
                  <h3>design</h3>
                  <p>Canvas-first iteration on HTML/JSX mocks under <code>.design/</code>. Zero-dep Node dev-server. Cmd+Click element inspector. Snapshot stack per canvas.</p>
                  <ul>
                    <li>10+ slash commands (/design:edit, /design:new, /design:critic, ...)</li>
                    <li>auto-iterating critic panel</li>
                    <li>file-tree + iframe preview browser</li>
                  </ul>
                </div>
                <div className="tile-ft"><span>FEATURED</span><span>Published 2026-05</span></div>
              </div>
              <div className="tile tile--accent">
                <div className="tile-hd"><span className="sku">MDCC-FLW/02</span><span>v0.12.0</span></div>
                <div className="tile-bd">
                  <h3>flow</h3>
                  <p>Generic agentic workflow loop={true} with the second-brain <code>.ai/</code> workspace. Project-agnostic via <code>&lt;project&gt;</code> placeholders + per-repo <code>workflows.config.json</code>.</p>
                  <ul>
                    <li>plan → execute → done lifecycle</li>
                    <li>cross-platform scenario runner</li>
                    <li>a11y + design-system guards</li>
                  </ul>
                </div>
                <div className="tile-ft"><span>NEW</span><span>Published 2026-05</span></div>
              </div>
            </div>

            <h2 data-no="02">Plain card</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: '0' }}>
              <div className="card">
                <h3 className="card-title">What you get</h3>
                <p>The marketplace is a static index plus a CLI. Install once with <code>mdcc init</code>, then <code>/plugin install</code> from inside Claude Code.</p>
              </div>
              <div className="card card--inset">
                <h3 className="card-title">What it costs</h3>
                <p>Free. Open={true} source. Bring your own Claude Code. (No, there's no enterprise tier. Stop asking.)</p>
              </div>
            </div>

            <h2 data-no="03">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't add <code>box-shadow</code> to make a tile "float". The 1px hairlines + the SKU-bar's <code>--bg-2</code> already separate it from the page. Shadow breaks the signature.</p></div>

            <footer className="specimen-ft">
              <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-cards</span></div>
              <div className="colo-block"><span>md-claude · v0.12.0</span></div>
            </footer>
          </main>
        </>
  );
}
