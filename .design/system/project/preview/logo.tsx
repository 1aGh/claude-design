/**
 * @canvas      logo — SIGNATURE — wordmark + 4 domain-noun glyphs. Construction rules.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.logo / md-claude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/logo/
 * @handoff     bunx shadcn add file://./logo.registry.json
 */
import "./logo.css";

export default function Logo() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.logo</span><span className="crumbs"><span>md-claude</span><span>design system</span><span>brand</span><span>logo</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Wordmark &amp; glyphs</h1><p className="lede">The mark is a single typeset of <code>MD-CLAUDE</code> in Berkeley Mono with one amber-rust terminal block. That's the catalog stamp dot. No drawn icon. The wordmark IS the mark. Below: four domain-noun SVG glyphs for the marketplace + dev-server surface.</p></section>
            <dl className="specimen-meta"><div><dt>Files</dt><dd>1 wordmark · 4 glyphs</dd></div><div><dt>Construction</dt><dd>Berkeley Mono · 0.04em tracking · accent dot</dd></div><div><dt>Reusable</dt><dd>currentColor → host context tints</dd></div></dl>

            <h2 data-no="01">Wordmark</h2>
            <div className="stage">
              <img src="../assets/logos/wordmark.svg" alt="md-claude wordmark" />
            </div>

            <h2 data-no="02">Glyphs <span className="h2-aside">four domain nouns</span></h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: '0' }}>
              <div className="gly-card"><img src="../assets/glyphs/plugin.svg" alt="" /><strong>plugin</strong><code>assets/glyphs/plugin.svg</code></div>
              <div className="gly-card"><img src="../assets/glyphs/canvas.svg" alt="" /><strong>canvas</strong><code>assets/glyphs/canvas.svg</code></div>
              <div className="gly-card"><img src="../assets/glyphs/slash-command.svg" alt="" /><strong>slash-command</strong><code>assets/glyphs/slash-command.svg</code></div>
              <div className="gly-card"><img src="../assets/glyphs/file-tree.svg" alt="" /><strong>file-tree</strong><code>assets/glyphs/file-tree.svg</code></div>
            </div>

            <h2 data-no="03">Construction rules</h2>
            <div className="construct">
              <div className="card">
                <h3 className="card-title">Wordmark</h3>
                <ul>
                  <li>Always set in Berkeley Mono (or the same stack fallback)</li>
                  <li>Letter-spacing <code>0.04em</code>. Wider than body, tighter than SKU labels</li>
                  <li>The accent block is <code>--accent</code> at 6×6px relative to the 22px cap height</li>
                  <li>Don't render the wordmark smaller than 14px cap height. The block disappears</li>
                  <li>Don't recolor the block to anything other than <code>--accent</code></li>
                </ul>
              </div>
              <div className="card">
                <h3 className="card-title">Glyphs</h3>
                <ul>
                  <li>16×16 grid · 1px stroke · <code>stroke-linecap: square</code></li>
                  <li><code>fill="none"</code> by default. Fills only when the domain noun calls for solid (e.g. a filled play arrow)</li>
                  <li><code>stroke="currentColor"</code>. Host context tints</li>
                  <li>Dropped inline with mono text: <code>width: 16px; height: 16px; vertical-align: -3px;</code></li>
                  <li>New domain noun → new SVG file, added to <code>iconography.html</code></li>
                </ul>
              </div>
            </div>

            <h2 data-no="04">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't pair the wordmark with a separate icon mark. The wordmark IS the mark. Don't put a "circle-M monogram" next to it. That's a different brand.</p></div>
            <div className="pro"><p style={{ margin: '0' }}>When you need a square avatar / favicon, use the accent block alone at 16×16. It reads as "the dot from the wordmark", which is the only mark this DS has.</p></div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· logo · ★ signature</span></div><div className="colo-block"><span>md-claude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
