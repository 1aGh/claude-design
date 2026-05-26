/**
 * @canvas      components-tables — data table with compact mono-grid rhythm.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-tables / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-tables/
 * @handoff     bunx shadcn add file://./components-tables.registry.json
 */
import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
import "./components-tables.css";

export default function ComponentsTables() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.components-tables</span><span className="crumbs"><span>maude</span><span>design system</span><span>components</span><span>tables</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Tables</h1><p className="lede">A row is a catalog plate. SKU + name + version + status + published. Everything you'd scan in a marketplace listing. Compact padding, 1px row rules, no zebra-striping (the rules do the work).</p></section>
            <dl className="specimen-meta"><div><dt>Density</dt><dd>compact (--space-3 / --space-4)</dd></div><div><dt>Row rule</dt><dd>--border-subtle (1px)</dd></div></dl>

            <h2 data-no="01">Plugin catalog</h2>
            <table className="cat">
              <thead><tr><th>SKU</th><th>Plugin</th><th>Version</th><th>Status</th><th>Published</th><th className="num">Downloads</th></tr></thead>
              <tbody>
                <tr><td><span className="sku">MDCC-DSN/01</span></td><td><strong>design</strong> · canvas iteration on HTML mocks</td><td>v0.12.0</td><td><span className="badge badge--success">live</span></td><td>2026-05-14</td><td className="num">2,481</td></tr>
                <tr><td><span className="sku">MDCC-FLW/02</span></td><td><strong>flow</strong> · agentic workflow loop</td><td>v0.12.0</td><td><span className="badge badge--success">live</span></td><td>2026-05-14</td><td className="num">1,902</td></tr>
                <tr><td><span className="sku">MDCC-CLI/03</span></td><td><strong>mdcc</strong> · npm CLI helper</td><td>v0.12.0</td><td><span className="badge badge--success">live</span></td><td>2026-05-14</td><td className="num">3,116</td></tr>
                <tr><td><span className="sku">MDCC-DOC/04</span></td><td><strong>docs</strong> · README orchestration</td><td>v0.4.0</td><td><span className="badge badge--warn">beta</span></td><td>2026-04-22</td><td className="num">421</td></tr>
                <tr><td><span className="sku">MDCC-OBS/05</span></td><td><strong>observe</strong> · telemetry hooks</td><td>v0.2.1</td><td><span className="badge badge--warn">beta</span></td><td>2026-03-30</td><td className="num">183</td></tr>
                <tr><td><span className="sku">MDCC-???</span></td><td style={{ color: 'var(--fg-3)' }}>your plugin · submit a PR</td><td>n/a</td><td><span className="badge">draft</span></td><td>n/a</td><td className="num">n/a</td></tr>
              </tbody>
            </table>

            <h2 data-no="02">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't zebra-stripe the rows. The hairline between rows is the rhythm; striping doubles up and reads noisy. If you need stronger grouping, group with a sub-heading row, not a band.</p></div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-tables</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
