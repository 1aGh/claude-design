/**
 * @canvas      iconography — ASCII / Unicode-glyph icons + 4 domain-noun SVGs in assets/glyphs/.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.iconography / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/iconography/
 * @handoff     bunx shadcn add file://./iconography.registry.json
 */
import "./iconography.css";

export default function Iconography() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.iconography</span><span className="crumbs"><span>maude</span><span>design system</span><span>foundation</span><span>iconography</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Iconography</h1><p className="lede">ASCII / Unicode-glyph icons first. Characters do the work, inherit the mono baseline automatically. SVG glyphs for domain nouns that need their own mark live under <code>assets/glyphs/</code>. No emoji, ever.</p></section>
            <dl className="specimen-meta"><div><dt>Family</dt><dd>industry-specific</dd></div><div><dt>Unicode glyphs</dt><dd>20+</dd></div><div><dt>SVG glyphs</dt><dd>4 (plugin · canvas · slash-command · file-tree)</dd></div></dl>

            <h2 data-no="01">Unicode glyphs <span className="h2-aside">disclosure / state / direction</span></h2>
            <div className="glyph-grid">
              <div className="gly"><div className="gly-char">▸</div><div className="gly-name">collapsed</div></div>
              <div className="gly"><div className="gly-char">▾</div><div className="gly-name">expanded</div></div>
              <div className="gly"><div className="gly-char">▴</div><div className="gly-name">up</div></div>
              <div className="gly"><div className="gly-char">▹</div><div className="gly-name">step</div></div>
              <div className="gly"><div className="gly-char">●</div><div className="gly-name">on</div></div>
              <div className="gly"><div className="gly-char">○</div><div className="gly-name">off</div></div>
              <div className="gly"><div className="gly-char">■</div><div className="gly-name">check-on</div></div>
              <div className="gly"><div className="gly-char">□</div><div className="gly-name">check-off</div></div>
              <div className="gly"><div className="gly-char">→</div><div className="gly-name">next</div></div>
              <div className="gly"><div className="gly-char">←</div><div className="gly-name">prev</div></div>
              <div className="gly"><div className="gly-char">↑</div><div className="gly-name">up</div></div>
              <div className="gly"><div className="gly-char">↓</div><div className="gly-name">down</div></div>
              <div className="gly"><div className="gly-char">✓</div><div className="gly-name">ok</div></div>
              <div className="gly"><div className="gly-char">✗</div><div className="gly-name">fail</div></div>
              <div className="gly"><div className="gly-char">·</div><div className="gly-name">sep</div></div>
              <div className="gly"><div className="gly-char">⌘</div><div className="gly-name">cmd</div></div>
              <div className="gly"><div className="gly-char">⇧</div><div className="gly-name">shift</div></div>
              <div className="gly"><div className="gly-char">⏎</div><div className="gly-name">enter</div></div>
              <div className="gly"><div className="gly-char">⎋</div><div className="gly-name">esc</div></div>
              <div className="gly"><div className="gly-char">⋯</div><div className="gly-name">more</div></div>
            </div>

            <h2 data-no="02">Box-drawing <span className="h2-aside">file-tree / diagrams</span></h2>
            <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)', background: 'var(--bg-1)', border: '1px solid var(--border-default)', padding: 'var(--space-5)', margin: 'var(--space-4) 0' }}>
          .design/
          ├── README.md
          ├── INDEX.md
          ├── config.json
          ├── _history/
          │   └── _system/
          │       └── project-000-scaffold-roster.yaml
          └── system/
              └── project/
                  ├── README.md
                  ├── SKILL.md
                  ├── colors_and_type.css
                  └── preview/
                      ├── _layout.css
                      ├── _components.css
                      └── *.html
          </pre>

            <h2 data-no="03">SVG glyphs <span className="h2-aside">domain nouns</span></h2>
            <div className="glyph-grid">
              <div className="gly"><img className="gly-svg" src="../assets/glyphs/plugin.svg" alt="" /><div className="gly-name">plugin</div></div>
              <div className="gly"><img className="gly-svg" src="../assets/glyphs/canvas.svg" alt="" /><div className="gly-name">canvas</div></div>
              <div className="gly"><img className="gly-svg" src="../assets/glyphs/slash-command.svg" alt="" /><div className="gly-name">slash-command</div></div>
              <div className="gly"><img className="gly-svg" src="../assets/glyphs/file-tree.svg" alt="" /><div className="gly-name">file-tree</div></div>
            </div>
            <p style={{ marginTop: 'var(--space-4)', color: 'var(--fg-2)', fontSize: 'var(--type-sm)' }}>Each glyph: 16×16 grid, 1px stroke, <code>currentColor</code> so the host context tints it. Drop new ones into <code>assets/glyphs/</code> and add a row above when new nouns enter the DS.</p>

            <h2 data-no="04">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't introduce an emoji ("🚀 Launch", no). Don't pull from Heroicons/Lucide for chrome. The DS commits to characters first, SVG only when domain nouns demand their own mark.</p></div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· iconography</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
