/**
 * @canvas      grid — layout grid — 12-col on desktop, mono-friendly.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.grid / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/grid/
 * @handoff     bunx shadcn add file://./grid.registry.json
 */
import "./grid.css";

export default function Grid() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.grid</span><span className="crumbs"><span>maude</span><span>design system</span><span>foundation</span><span>grid</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Grid</h1><p className="lede">12 columns on desktop. <code>--layout-max-w</code> 1240px. <code>--layout-prose</code> 72ch for long-form. The dev-server canvas tightens further with <code>auto-fill minmax(220px, 1fr)</code> tile grids.</p></section>
            <dl className="specimen-meta"><div><dt>Columns</dt><dd>12 · desktop</dd></div><div><dt>Max width</dt><dd>1240px</dd></div><div><dt>Prose</dt><dd>72ch</dd></div></dl>

            <h2 data-no="01">12-col</h2>
            <div className="twelve">
              <div>1</div><div>2</div><div>3</div><div>4</div><div>5</div><div>6</div><div>7</div><div>8</div><div>9</div><div>10</div><div>11</div><div>12</div>
            </div>

            <h2 data-no="02">Auto-fill tile grid <span className="h2-aside">marketplace catalog row</span></h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '0' }}>
              <div className="tile"><div className="tile-hd"><span className="sku">MDCC-DSN/01</span><span>v0.12</span></div><div className="tile-bd"><h3>design</h3><p style={{ fontSize: 'var(--type-sm)', margin: '0' }}>Canvas iteration.</p></div></div>
              <div className="tile"><div className="tile-hd"><span className="sku">MDCC-FLW/02</span><span>v0.12</span></div><div className="tile-bd"><h3>flow</h3><p style={{ fontSize: 'var(--type-sm)', margin: '0' }}>Agentic workflow.</p></div></div>
              <div className="tile"><div className="tile-hd"><span className="sku">MDCC-CLI/03</span><span>v0.12</span></div><div className="tile-bd"><h3>mdcc</h3><p style={{ fontSize: 'var(--type-sm)', margin: '0' }}>npm CLI helper.</p></div></div>
              <div className="tile"><div className="tile-hd"><span className="sku">MDCC-???</span><span>?</span></div><div className="tile-bd"><h3 style={{ color: 'var(--fg-3)' }}>your plugin</h3><p style={{ fontSize: 'var(--type-sm)', margin: '0', color: 'var(--fg-2)' }}>Submit a PR.</p></div></div>
            </div>

            <h2 data-no="03">Prose measure <span className="h2-aside">72ch</span></h2>
            <p>This paragraph wraps at 72ch (about 60-72 characters per line). mdcc design serve renders this with the file-tree on the left and the canvas browser on the right; both panels respect the prose measure so README rendering doesn't sprawl across an ultrawide monitor.</p>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· grid</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
