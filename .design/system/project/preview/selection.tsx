/**
 * @canvas      selection — text + element selection styling. Accent bg, accent-fg ink.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.selection / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/selection/
 * @handoff     bunx shadcn add file://./selection.registry.json
 */
export default function Selection() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.selection</span><span className="crumbs"><span>maude</span><span>design system</span><span>foundation</span><span>selection</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Selection</h1><p className="lede">Highlight a sentence below. The accent fills the bg, accent-fg becomes the ink. No prefab "hide the system default" tricks. Selection is a real interaction. The DS makes it readable.</p></section>
            <dl className="specimen-meta"><div><dt>Token</dt><dd>--accent / --accent-fg</dd></div><div><dt>Hook</dt><dd>::selection (global, set in _layout.css)</dd></div></dl>

            <h2 data-no="01">Try it</h2>
            <p>Select me. The amber-rust catalog stamp claims the highlight. mdcc init scaffolds .ai/ into the current project. Fails loud if not a git repo.</p>
            <p>Or this code: <code>/design:edit "make the accent rust deeper"</code>.</p>
            <pre>$ mdcc design serve --port 4399
          &gt; canvas browser at <span style={{ color: 'var(--accent)' }}>http://localhost:4399</span></pre>

            <h2 data-no="02">In file-tree (selected row)</h2>
            <div style={{ border: '1px solid var(--border-default)', background: 'var(--bg-1)', padding: 'var(--space-3) 0', maxWidth: '340px' }}>
              <div style={{ padding: '4px var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>▸ colors_and_type.css</div>
              <div style={{ padding: '4px var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)', background: 'var(--accent)', color: 'var(--accent-fg)' }}>▾ preview/</div>
              <div style={{ padding: '4px var(--space-6)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>└─ colors-accent.html</div>
              <div style={{ padding: '4px var(--space-6)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>└─ empty-state.html</div>
            </div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· selection</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
