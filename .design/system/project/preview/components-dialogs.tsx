/**
 * @canvas      components-dialogs — modal dialog + side drawer. Static representation (no JS).
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-dialogs / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-dialogs/
 * @handoff     bunx shadcn add file://./components-dialogs.registry.json
 */
import "./components-dialogs.css";

export default function ComponentsDialogs() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.components-dialogs</span><span className="crumbs"><span>maude</span><span>design system</span><span>components</span><span>dialogs</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Dialogs</h1><p className="lede">Modal dialog + side drawer. SKU header, sectioned body, action footer. Scrim is a flat 0.6 alpha. No backdrop blur, no frosted-glass.</p></section>
            <dl className="specimen-meta"><div><dt>Variants</dt><dd>modal · drawer</dd></div><div><dt>Scrim</dt><dd>rgba(0,0,0,0.6). No blur.</dd></div></dl>

            <h2 data-no="01">Modal</h2>
            <div className="scrim">
              <div className="dlg">
                <div className="dlg-hd"><span className="sku">MDCC-DSN/01 · CONFIRM</span><span className="badge badge--warn">UNSAVED</span></div>
                <div className="dlg-bd">
                  <h3 style={{ margin: '0 0 var(--space-3)' }}>Discard canvas changes?</h3>
                  <p style={{ margin: '0', color: 'var(--fg-1)' }}>You've edited <code>colors-accent.html</code> since the last snapshot. Closing this tab discards those edits.</p>
                </div>
                <div className="dlg-ft">
                  <button className="btn btn--quiet">Keep editing</button>
                  <button className="btn btn--ghost">Snapshot &amp; close</button>
                  <button className="btn btn--primary">Discard</button>
                </div>
              </div>
            </div>

            <h2 data-no="02">Drawer</h2>
            <div className="drawer">
              <div className="drawer-hd"><span className="eyebrow">INSPECTOR · MDCC-DSN/01.colors-accent</span></div>
              <div className="drawer-bd">
                <div className="field"><label className="field-label">Selected</label><input className="input input--mono" value=".stamp .stamp-headline" readOnly={true} /></div>
                <div className="field"><label className="field-label">Tokens used</label><pre style={{ margin: '0', fontSize: 'var(--type-xs)', background: 'var(--bg-2)', border: '1px solid var(--border-default)', padding: 'var(--space-3)' }}>font-family: var(--font-display)
          font-size: var(--type-2xl)
          color: var(--fg-0)
          margin: var(--space-3) 0</pre></div>
              </div>
              <div className="drawer-ft"><button className="btn btn--quiet">Close</button><button className="btn btn--primary" style={{ marginLeft: 'auto' }}>Apply</button></div>
            </div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-dialogs</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
