/**
 * @canvas      state-system — chrome-state family. 404 / success / loading / empty cross-ref. Empty has its own dedicated specimen (empty-state.html); this file is the index of the other three states + a one-line pointer back to e
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.state-system / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/state-system/
 * @handoff     bunx shadcn add file://./state-system.registry.json
 */
import "./state-system.css";

export default function StateSystem() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.state-system</span><span className="crumbs"><span>maude</span><span>design system</span><span>universal</span><span>state-system</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>State system</h1><p className="lede">Chrome-state family. Four sections, four moments where the UI has to talk: 404, success, loading, and empty. Each one earns its copy the same way. Specific nouns, real commands, no filler.</p></section>
            <dl className="specimen-meta"><div><dt>Status</dt><dd>published</dd></div><div><dt>Family</dt><dd>chrome states</dd></div><div><dt>Sections</dt><dd>4</dd></div><div><dt>Density</dt><dd>balanced-docs</dd></div></dl>

            <h2 data-no="01">404</h2>
            <div className="state">
              <div className="code-404">404</div>
              <div className="eyebrow">ROUTE · NOT FOUND</div>
              <h3>That path doesn't exist. Or it used to and got renamed.</h3>
              <p><code>/docs</code> has a map.</p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
                <a className="btn btn--primary" href="/docs">Open the map</a>
                <a href="/" style={{ fontSize: 'var(--type-sm)', color: 'var(--fg-1)', alignSelf: 'center', textDecoration: 'underline', textDecorationColor: 'var(--accent)', textUnderlineOffset: '4px' }}>or start over at the root</a>
              </div>
            </div>

            <h2 data-no="02">Success</h2>
            <p>Toast lands after a long-running command finishes. It states the fact, gives a number, and stops.</p>
            <div style={{ textAlign: 'center', padding: 'var(--space-5) 0' }}>
              <div className="toast">
                <div>
                  <div className="eyebrow">Success</div>
                  <p>Bootstrapped <code>system/project/</code> with 36 specimens. Aesthetic critic gave it 4.1/5 (which is the highest it gives anything, so, solid).</p>
                </div>
              </div>
            </div>

            <h2 data-no="03">Loading</h2>
            <p>Skeleton shell with a single-line status. No spinner. No "please wait". The shape of the content is the loading affordance; the copy just sets expectation.</p>
            <div className="skeleton-shell" aria-busy="true" aria-live="polite">
              <div className="skeleton-bar w-60"></div>
              <div className="skeleton-bar w-80"></div>
              <div className="skeleton-bar w-40"></div>
              <div className="skeleton-meta">Booting. (Usually about 800ms.)</div>
            </div>

            <h2 data-no="04">Empty <span className="h2-aside">cross-reference</span></h2>
            <div className="xref">
              <p style={{ margin: '0', color: 'var(--fg-1)' }}>The empty state has its own dedicated specimen with six common cases and a voice keep-or-kill panel.</p>
              <a href="./empty-state.html">empty-state.html →</a>
            </div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· state-system</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
