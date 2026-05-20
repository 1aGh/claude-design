/**
 * @canvas      spacing-scale — 4px-base spacing scale (--space-0..--space-9) with usage notes.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.spacing-scale / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/spacing-scale/
 * @handoff     bunx shadcn add file://./spacing-scale.registry.json
 */
import "./spacing-scale.css";

export default function SpacingScale() {
  return (
    <>
          <header className="specimen-hd">
            <span className="sku">MDCC-DSN/01.spacing-scale</span>
            <span className="crumbs"><span>maude</span><span>design system</span><span>spacing</span><span>scale</span></span>
            <span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span>
          </header>
          <main className="specimen">
            <section className="specimen-title">
              <h1>Spacing</h1>
              <p className="lede">4px base, ten steps. Balanced-docs density means chrome lives on <code>--space-3</code> / <code>--space-4</code> (8 / 12px). If you reach for an in-between value, the answer is the nearest token, not a new one.</p>
            </section>
            <dl className="specimen-meta">
              <div><dt>Base</dt><dd>4px</dd></div>
              <div><dt>Steps</dt><dd>10</dd></div>
              <div><dt>Density</dt><dd>Balanced</dd></div>
            </dl>

            <h2 data-no="01">The scale <span className="h2-aside">--space-0 → --space-9</span></h2>
            <div className="space-row"><span className="label">--space-0</span><span className="px">0px</span><span></span><span className="use">Reset. Margin/padding zeroing.</span></div>
            <div className="space-row"><span className="label">--space-1</span><span className="px">2px</span><span className="bar" style={{ width: '2px' }}></span><span className="use">Inline gap inside a chip (badge text + dot).</span></div>
            <div className="space-row"><span className="label">--space-2</span><span className="px">4px</span><span className="bar" style={{ width: '4px' }}></span><span className="use">Tile-hd row gap, badge padding.</span></div>
            <div className="space-row"><span className="label">--space-3</span><span className="px">8px</span><span className="bar" style={{ width: '8px' }}></span><span className="use">Chrome padding default. Card row gap, button vertical padding.</span></div>
            <div className="space-row"><span className="label">--space-4</span><span className="px">12px</span><span className="bar" style={{ width: '12px' }}></span><span className="use">Tile-bd padding, input padding, h3 → body gap.</span></div>
            <div className="space-row"><span className="label">--space-5</span><span className="px">16px</span><span className="bar" style={{ width: '16px' }}></span><span className="use">Card padding, button horizontal padding, meta-row gap.</span></div>
            <div className="space-row"><span className="label">--space-6</span><span className="px">24px</span><span className="bar" style={{ width: '24px' }}></span><span className="use">Specimen gutter (left/right), .specimen padding-top.</span></div>
            <div className="space-row"><span className="label">--space-7</span><span className="px">32px</span><span className="bar" style={{ width: '32px' }}></span><span className="use">h2 section margin-top (rhythm beat).</span></div>
            <div className="space-row"><span className="label">--space-8</span><span className="px">48px</span><span className="bar" style={{ width: '48px' }}></span><span className="use">Hero/stamp inner padding, long-form section break.</span></div>
            <div className="space-row"><span className="label">--space-9</span><span className="px">64px</span><span className="bar" style={{ width: '64px' }}></span><span className="use">Specimen-bottom, footer separation. The "we're done" pause.</span></div>

            <h2 data-no="02">In a tile <span className="h2-aside">balanced-docs anatomy</span></h2>
            <div className="tile" style={{ maxWidth: '420px' }}>
              <div className="tile-hd"><span className="sku">MDCC-DSN/01</span><span>v0.12.0</span></div>
              <div className="tile-bd">
                <h3>design</h3>
                <p>Canvas-first iteration on HTML mocks. Auto-runs the critic panel after every edit.</p>
                <ul style={{ margin: '0', paddingLeft: 'var(--space-5)', fontSize: 'var(--type-sm)' }}>
                  <li>zero-dep dev-server</li>
                  <li>Cmd+Click inspector overlay</li>
                  <li>snapshot stack per canvas</li>
                </ul>
              </div>
              <div className="tile-ft"><span>FEATURED</span><span>Published 2026-05</span></div>
            </div>
            <p style={{ marginTop: 'var(--space-3)', color: 'var(--fg-2)', fontSize: 'var(--type-xs)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>tile-hd padding · space-3/space-4 · tile-bd · space-4/space-5 · tile-ft · space-3/space-4</p>

            <h2 data-no="03">When not to use <span className="h2-aside">no in-between values</span></h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't write <code>padding: 10px</code> because "12 is too much, 8 is too little". Pick the surrounding context's rhythm. Chrome at space-3/4, content at space-4/5. The ladder is 4px-stepped on purpose.</p></div>

            <footer className="specimen-ft">
              <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· spacing-scale</span></div>
              <div className="colo-block"><span>Maude · v0.12.0</span></div>
            </footer>
          </main>
        </>
  );
}
