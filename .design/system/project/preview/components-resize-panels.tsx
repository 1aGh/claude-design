/**
 * @canvas      components-resize-panels — resizable file-tree + main pane (the dev-server's anatomy).
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-resize-panels / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-resize-panels/
 * @handoff     bunx shadcn add file://./components-resize-panels.registry.json
 */
import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
import "./components-resize-panels.css";

export default function ComponentsResizePanels() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.components-resize-panels</span><span className="crumbs"><span>maude</span><span>design system</span><span>platform-desktop</span><span>resize</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Resize panels</h1><p className="lede">Two-pane split with a draggable gutter. The dev-server's left-tree + right-iframe anatomy. Tree uses Unicode disclosure glyphs (<code>▾</code> / <code>▸</code>) inline, selected={true} row carries the accent stamp.</p></section>
            <dl className="specimen-meta"><div><dt>Layout</dt><dd>260px / 6 / 1fr</dd></div><div><dt>Min/max</dt><dd>180-480 / 6 / open</dd></div></dl>

            <h2 data-no="01">File-tree + main pane</h2>
            <div className="split">
              <div className="pane">
                <div className="tree-row dir">▾ .design/</div>
                <div className="tree-row" style={{ paddingLeft: 'var(--space-6)' }}>README.md</div>
                <div className="tree-row" style={{ paddingLeft: 'var(--space-6)' }}>INDEX.md</div>
                <div className="tree-row" style={{ paddingLeft: 'var(--space-6)' }}>config.json</div>
                <div className="tree-row dir" style={{ paddingLeft: 'var(--space-6)' }}>▾ system/project/</div>
                <div className="tree-row" style={{ paddingLeft: 'var(--space-8)' }}>README.md</div>
                <div className="tree-row" style={{ paddingLeft: 'var(--space-8)' }}>SKILL.md</div>
                <div className="tree-row" style={{ paddingLeft: 'var(--space-8)' }}>colors_and_type.css</div>
                <div className="tree-row dir" style={{ paddingLeft: 'var(--space-8)' }}>▾ preview/</div>
                <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}>colors-text.html</div>
                <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}>colors-surfaces.html</div>
                <div className="tree-row sel" style={{ paddingLeft: 'var(--space-9)' }}>colors-accent.html</div>
                <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}>type-scale.html</div>
                <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}>spacing-scale.html</div>
                <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}>motion.html</div>
                <div className="tree-row dir" style={{ paddingLeft: 'var(--space-9)' }}>▸ components-*.html</div>
                <div className="tree-row dir" style={{ paddingLeft: 'var(--space-9)' }}>▸ foundations</div>
                <div className="tree-row dir" style={{ paddingLeft: 'var(--space-6)' }}>▸ ui/</div>
              </div>
              <div className="gutter" role="separator" aria-orientation="vertical"></div>
              <div className="body">
                <div className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>PREVIEW · MDCC-DSN/01.colors-accent</div>
                <p style={{ color: 'var(--fg-1)', margin: '0 0 var(--space-3)' }}>→ iframe would render here in the real dev-server.</p>
                <p style={{ color: 'var(--fg-2)', fontSize: 'var(--type-xs)', margin: '0' }}>resize the gutter ← / → to give the iframe more room. min tree width 180px, max 480px.</p>
              </div>
            </div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-resize-panels</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
