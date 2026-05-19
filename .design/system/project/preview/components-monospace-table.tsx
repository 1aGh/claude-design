/**
 * @canvas      components-monospace-table — data-grade monospace table — tabular numerics, aligned columns.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-monospace-table / md-claude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-monospace-table/
 * @handoff     bunx shadcn add file://./components-monospace-table.registry.json
 */
import "./components-monospace-table.css";

export default function ComponentsMonospaceTable() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.components-monospace-table</span><span className="crumbs"><span>md-claude</span><span>design system</span><span>dev</span><span>mono-table</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Monospace table</h1><p className="lede">Pure data grid. Tabular numerics (<code>font-variant-numeric: tabular-nums</code>) so column rule lines up. Header rows split data into logical groups without a separator block.</p></section>
            <dl className="specimen-meta"><div><dt>Numerals</dt><dd>tabular-nums</dd></div><div><dt>Density</dt><dd>compact (--space-2 vertical)</dd></div></dl>

            <h2 data-no="01">Scaffold roster (excerpt)</h2>
            <table className="mono">
              <thead><tr><th>file</th><th>batch</th><th>deps</th><th className="num">loc</th><th>status</th></tr></thead>
              <tbody>
                <tr className="head"><td colSpan="5">Batch A · main agent · serial</td></tr>
                <tr><td className="id">colors_and_type.css</td><td>A</td><td>n/a</td><td className="num">156</td><td><span className="badge badge--success">written</span></td></tr>
                <tr><td className="id">preview/_layout.css</td><td>A</td><td>tokens, Q9</td><td className="num">232</td><td><span className="badge badge--success">written</span></td></tr>
                <tr><td className="id">preview/_components.css</td><td>A</td><td>tokens, Q9</td><td className="num">273</td><td><span className="badge badge--success">written</span></td></tr>
                <tr><td className="id">system/project/README.md</td><td>A</td><td>tokens</td><td className="num">165</td><td><span className="badge badge--success">written</span></td></tr>
                <tr className="head"><td colSpan="5">Batch B · token-only fan-out · parallel</td></tr>
                <tr><td className="id">preview/colors-text.html</td><td>B</td><td>tokens, chrome</td><td className="num">102</td><td><span className="badge badge--success">written</span></td></tr>
                <tr><td className="id">preview/colors-accent.html ★</td><td>B</td><td>tokens, chrome</td><td className="num">145</td><td><span className="badge badge--success">written</span></td></tr>
                <tr><td className="id">preview/type-scale.html</td><td>B</td><td>tokens, chrome</td><td className="num">96</td><td><span className="badge badge--success">written</span></td></tr>
                <tr><td className="id">preview/iconography.html</td><td>B</td><td>tokens, chrome, Q11</td><td className="num">114</td><td><span className="badge badge--success">written</span></td></tr>
                <tr className="head"><td colSpan="5">Batch C · template fan-out · parallel</td></tr>
                <tr><td className="id">preview/components-buttons.html</td><td>C</td><td>tokens, chrome, _comp, tpl</td><td className="num">88</td><td><span className="badge badge--success">written</span></td></tr>
                <tr><td className="id">preview/empty-state.html ★</td><td>C</td><td>tokens, chrome, _comp, tpl</td><td className="num">132</td><td><span className="badge badge--success">written</span></td></tr>
                <tr><td className="id">preview/logo.html ★</td><td>C</td><td>tokens, chrome, assets</td><td className="num">98</td><td><span className="badge badge--success">written</span></td></tr>
                <tr><td className="id">preview/ui_kits-desktop-showcase.html ★★</td><td>C</td><td>tokens, chrome, _comp, ALL</td><td className="num">n/a</td><td><span className="badge badge--warn">pending</span></td></tr>
              </tbody>
            </table>

            <h2 data-no="02">Why tabular numerics</h2>
            <p>Berkeley Mono ships with proportional numerics by default. Adding <code>font-variant-numeric: tabular-nums</code> forces every digit to the same advance, so "loc 145" and "loc 96" stack column-aligned without a fractional-pixel jitter.</p>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-monospace-table</span></div><div className="colo-block"><span>md-claude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
