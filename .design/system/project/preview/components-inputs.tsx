/**
 * @canvas      components-inputs — text input, mono input, select, textarea + field anatomy.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-inputs / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-inputs/
 * @handoff     bunx shadcn add file://./components-inputs.registry.json
 */

import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
export default function ComponentsInputs() {
  return (
    <>
          <header className="specimen-hd">
            <span className="sku">MDCC-DSN/01.components-inputs</span>
            <span className="crumbs"><span>maude</span><span>design system</span><span>components</span><span>inputs</span></span>
            <ThemeToggle />
          </header>
          <main className="specimen">
            <section className="specimen-title">
              <h1>Inputs</h1>
              <p className="lede">Recessed-bg fields, hairline borders. On focus the accent reaches in via a 2px tint glow. The only place "glow" appears in the system. It's the focus ring talking.</p>
            </section>
            <dl className="specimen-meta">
              <div><dt>Variants</dt><dd>input · input--mono · select · textarea</dd></div>
              <div><dt>States</dt><dd>idle · hover · focus · disabled={true} · error</dd></div>
            </dl>

            <h2 data-no="01">Standard field</h2>
            <div style={{ maxWidth: '480px' }}>
              <div className="field">
                <label className="field-label" htmlFor="i1">Plugin name<span className="hint">required</span></label>
                <input id="i1" className="input" placeholder="maude/design" />
                <p className="field-help">Use the form <code>owner/repo</code>.</p>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="i2">SKU<span className="hint">auto-generated</span></label>
                <input id="i2" className="input input--mono" value="MDCC-DSN/01" readOnly={true} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="i3">Version</label>
                <select id="i3" className="select">
                  <option>v0.12.0 (current)</option>
                  <option>v0.11.0</option>
                  <option>v0.10.0</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="i4">Description</label>
                <textarea id="i4" className="textarea" rows="4">Canvas-first iteration on HTML mocks. Zero-dep Node dev-server. Cmd+Click element inspector. Snapshot stack per canvas.</textarea>
              </div>
            </div>

            <h2 data-no="02">States</h2>
            <div style={{ maxWidth: '480px' }}>
              <div className="field">
                <label className="field-label">Hover (mouse over)</label>
                <input className="input" value="maude/design" style={{ borderColor: 'var(--border-strong)' }} />
              </div>
              <div className="field">
                <label className="field-label">Focus</label>
                <input className="input" value="maude/design" autofocus={true} />
              </div>
              <div className="field">
                <label className="field-label">Disabled</label>
                <input className="input" value="maude/design" disabled={true} />
              </div>
              <div className="field">
                <label className="field-label">Error</label>
                <input className="input" value="maude/design space" aria-invalid="true" />
                <p className="field-err">Plugin names cannot contain spaces.</p>
              </div>
            </div>

            <h2 data-no="03">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't replace the inset bg (<code>--bg-3</code>) with a pure-white card-bg. The recessed feel is what tells the user "type here" without an extra label. White-on-white = lost field.</p></div>

            <footer className="specimen-ft">
              <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-inputs</span></div>
              <div className="colo-block"><span>Maude · v0.12.0</span></div>
            </footer>
          </main>
        </>
  );
}
