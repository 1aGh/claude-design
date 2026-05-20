/**
 * @canvas      type-mono — code-grade monospace usage — every weight, italic, ligatures, ch grid.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.type-mono / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/type-mono/
 * @handoff     bunx shadcn add file://./type-mono.registry.json
 */
export default function TypeMono() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.type-mono</span><span className="crumbs"><span>maude</span><span>design system</span><span>type</span><span>mono</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Mono type</h1><p className="lede">Berkeley Mono everywhere isn't a code-specific token. It's the body family. This specimen demonstrates how mono renders prose, code, identifiers, and the character-grid rhythm specifically.</p></section>
            <dl className="specimen-meta"><div><dt>Stack</dt><dd>Berkeley Mono / JetBrains Mono / ui-monospace</dd></div><div><dt>Reading mode</dt><dd>prose + code share font</dd></div></dl>

            <h2 data-no="01">Weights + style</h2>
            <p style={{ fontWeight: '400' }}>Regular 400. The default={true} body weight. Pick a plugin. mdcc installs it. That's it.</p>
            <p style={{ fontWeight: '500' }}>Medium 500. Used for emphasis in body text where italic would shout too much.</p>
            <p style={{ fontWeight: '600' }}>Semibold 600. Section headings and SKU labels. The catalog spine.</p>
            <p style={{ fontWeight: '700' }}>Bold 700. Reserve for stamps and rare "this is the most important thing on the page" moments.</p>
            <p style={{ fontStyle: 'italic' }}>Italic. for true citations and book titles. Not for stylistic emphasis (use medium-weight instead).</p>

            <h2 data-no="02">Identifiers <span className="h2-aside">code, paths, tokens</span></h2>
            <p>Mono carries identifiers gracefully without the inline-code chip: <code>mdcc init</code>, <code>/design:edit</code>, <code>MDCC-DSN/01</code>, <code>--accent</code>, <code>oklch(56% 0.170 50)</code>. Use the chip (<code>&lt;code&gt;</code>) when an identifier sits inside a paragraph and needs to be unambiguous. Skip the chip when the surrounding text is already code-flavored.</p>

            <h2 data-no="03">Code block</h2>
            <pre>{`// .design/system/project/colors_and_type.css
:root,
.mdcc[data-theme="light"] {
  --bg-0: oklch(97.5% 0.008 78);  /* paper             */
  --bg-1: oklch(95.5% 0.010 78);  /* card              */
  --fg-0: oklch(20% 0.020 50);    /* ink               */
  --accent: oklch(56% 0.170 50);  /* catalog-stamp red */
  --font-display: 'Berkeley Mono', ...;
  --tracking-sku: 0.12em;
}`}</pre>

            <h2 data-no="04">Character grid <span className="h2-aside">ch units</span></h2>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--type-base)' }}>At 13px Berkeley Mono, 1 character ≈ 8.4px. Layouts that snap to <code>ch</code> units feel engineered:</p>
            <pre style={{ width: '60ch' }}>60ch ────────────────────────────────────────────────────
          The marketplace listing wraps at 60 characters per line
          to match the catalog spine. README rendering uses 72ch.
          Inspector panels use 40ch when they get docked.
          ────────────────────────────────────────────────────────</pre>

            <h2 data-no="05">Numeric tabular <span className="h2-aside">Berkeley is monospace by definition</span></h2>
            <table style={{ width: 'auto', border: '1px solid var(--border-default)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)' }}>
              <thead><tr style={{ background: 'var(--bg-2)' }}><th style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'right' }}>value</th><th style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'left', borderLeft: '1px solid var(--border-subtle)' }}>label</th></tr></thead>
              <tbody>
                <tr style={{ borderTop: '1px solid var(--border-subtle)' }}><td style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'right' }}>2,481</td><td style={{ padding: 'var(--space-2) var(--space-4)', borderLeft: '1px solid var(--border-subtle)', color: 'var(--fg-1)' }}>design downloads</td></tr>
                <tr style={{ borderTop: '1px solid var(--border-subtle)' }}><td style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'right' }}>1,902</td><td style={{ padding: 'var(--space-2) var(--space-4)', borderLeft: '1px solid var(--border-subtle)', color: 'var(--fg-1)' }}>flow downloads</td></tr>
                <tr style={{ borderTop: '1px solid var(--border-subtle)' }}><td style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'right' }}>3,116</td><td style={{ padding: 'var(--space-2) var(--space-4)', borderLeft: '1px solid var(--border-subtle)', color: 'var(--fg-1)' }}>mdcc CLI downloads</td></tr>
              </tbody>
            </table>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· type-mono</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
