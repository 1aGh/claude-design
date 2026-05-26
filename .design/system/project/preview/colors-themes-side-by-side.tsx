/**
 * @canvas      colors-themes-side-by-side — paper-light and phosphor-dark rendered side-by-side. Each column is a wrapped .mdcc with explicit data-theme. Same components on both sides.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.colors-themes-side-by-side / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/colors-themes-side-by-side/
 * @handoff     bunx shadcn add file://./colors-themes-side-by-side.registry.json
 */
import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
import "./colors-themes-side-by-side.css";

export default function ColorsThemesSideBySide() {
  return (
    <>
          <header className="specimen-hd">
            <span className="sku">MDCC-DSN/01.colors-themes-side-by-side</span>
            <span className="crumbs"><span>maude</span><span>design system</span><span>color</span><span>themes</span></span>
            <ThemeToggle />
          </header>
          <main className="specimen">
            <section className="specimen-title">
              <h1>Two themes, one identity</h1>
              <p className="lede">Marketplace landing leans paper-light; the dev-server canvas leans phosphor-dark. Both are first-class. Same SKU framing, same hairlines, same Berkeley Mono. Only the surfaces and ink swap.</p>
            </section>
            <dl className="specimen-meta">
              <div><dt>Default</dt><dd>Light (paper)</dd></div>
              <div><dt>Equal-status</dt><dd>Dark (phosphor)</dd></div>
              <div><dt>Toggle</dt><dd>data-theme on .mdcc root</dd></div>
            </dl>

            <h2 data-no="01">Direct comparison <span className="h2-aside">same components, both themes</span></h2>
            <div className="pair">
              <div className="col mdcc" data-theme="light" style={{ background: 'var(--bg-0)', color: 'var(--fg-0)' }}>
                <div className="col-eyebrow">PAPER · MARKETPLACE LANDING MODE</div>
                <h3>maude</h3>
                <p style={{ color: 'var(--fg-1)', margin: '0 0 var(--space-4)' }}>A catalog of Claude Code plugins, rendered as spec sheets.</p>
                <div className="tile" style={{ background: 'var(--bg-1)', marginBottom: 'var(--space-4)' }}>
                  <div className="tile-hd"><span className="sku">MDCC-DSN/01</span><span>v0.12.0</span></div>
                  <div className="tile-bd">
                    <h3 style={{ margin: '0 0 var(--space-2)' }}>design</h3>
                    <p style={{ color: 'var(--fg-1)', margin: '0', fontSize: 'var(--type-sm)' }}>Canvas-first iteration on HTML mocks.</p>
                  </div>
                  <div className="tile-ft"><span>FEATURED</span><span>Published 2026-05</span></div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                  <button className="btn btn--primary">Install</button>
                  <button className="btn">Inspect</button>
                </div>
                <div className="field">
                  <label className="field-label">Plugin SKU<span className="hint">required</span></label>
                  <input className="input input--mono" value="MDCC-DSN/01" readOnly={true} />
                </div>
                <pre style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', padding: 'var(--space-3)', fontSize: 'var(--type-xs)', margin: '0' }}>$ mdcc install <span style={{ color: 'var(--accent)' }}>MDCC-DSN/01</span></pre>
              </div>
              <div className="col mdcc" data-theme="dark" style={{ background: 'var(--bg-0)', color: 'var(--fg-0)' }}>
                <div className="col-eyebrow">PHOSPHOR · DEV-SERVER CANVAS MODE</div>
                <h3>maude</h3>
                <p style={{ color: 'var(--fg-1)', margin: '0 0 var(--space-4)' }}>A catalog of Claude Code plugins, rendered as spec sheets.</p>
                <div className="tile" style={{ background: 'var(--bg-1)', marginBottom: 'var(--space-4)' }}>
                  <div className="tile-hd"><span className="sku">MDCC-DSN/01</span><span>v0.12.0</span></div>
                  <div className="tile-bd">
                    <h3 style={{ margin: '0 0 var(--space-2)' }}>design</h3>
                    <p style={{ color: 'var(--fg-1)', margin: '0', fontSize: 'var(--type-sm)' }}>Canvas-first iteration on HTML mocks.</p>
                  </div>
                  <div className="tile-ft"><span>FEATURED</span><span>Published 2026-05</span></div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                  <button className="btn btn--primary">Install</button>
                  <button className="btn">Inspect</button>
                </div>
                <div className="field">
                  <label className="field-label">Plugin SKU<span className="hint">required</span></label>
                  <input className="input input--mono" value="MDCC-DSN/01" readOnly={true} />
                </div>
                <pre style={{ background: 'var(--bg-2)', border: '1px solid var(--border-default)', padding: 'var(--space-3)', fontSize: 'var(--type-xs)', margin: '0' }}>$ mdcc install <span style={{ color: 'var(--accent)' }}>MDCC-DSN/01</span></pre>
              </div>
            </div>

            <h2 data-no="02">What changed <span className="h2-aside">what didn't</span></h2>
            <p><strong>Surfaces inverted</strong> (cream → phosphor). <strong>Ink inverted</strong> (near-black warm → cream warm). <strong>Accent</strong> shifted lighter on dark (L 56 → L 72) to maintain stamp visibility on phosphor. <strong>Hairlines</strong> stay 1px but track to the appropriate L for the surface.</p>
            <p><strong>SKU framing</strong> unchanged. <strong>Type ladder</strong> unchanged. <strong>Spacing</strong> unchanged. The brand is the layout, not the colors. Themes are surfaces.</p>

            <footer className="specimen-ft">
              <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· colors-themes-side-by-side</span></div>
              <div className="colo-block"><span>Maude · v0.12.0</span></div>
            </footer>
          </main>
        </>
  );
}
