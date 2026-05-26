/**
 * @canvas      logo — SIGNATURE — wordmark + 4 domain-noun glyphs. Construction rules.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.logo / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/logo/
 * @handoff     bunx shadcn add file://./logo.registry.json
 */
import "../colors_and_type.css";
import "./_layout.css";
import "./logo.css";
import { ThemeToggle } from "./_specimen-controls";

/**
 * Inline SVG primitives — sibling .svg files in `assets/` cannot be referenced
 * via `<img src="../assets/...">` because the dev-server's `_canvas-shell.html`
 * resolves relative URLs against the SHELL's location, not the canvas file
 * location (closes D-4 in the imprint-bootstrap retro, codified by Phase 3.7's
 * RELATIVE-URL SAFETY rule). Inlining keeps the specimen self-contained and
 * lets the host context tint via `currentColor`.
 */
const GLYPH_VIEWBOX = "0 0 16 16";
const glyphProps = {
  width: 16,
  height: 16,
  viewBox: GLYPH_VIEWBOX,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1,
  strokeLinecap: "square" as const,
} as const;

function GlyphPlugin() {
  return (
    <svg {...glyphProps} role="img" aria-label="plugin">
      <rect x="3" y="5" width="10" height="8" />
      <line x1="5" y1="5" x2="5" y2="2" />
      <line x1="11" y1="5" x2="11" y2="2" />
      <line x1="6.5" y1="13" x2="6.5" y2="15" />
      <line x1="9.5" y1="13" x2="9.5" y2="15" />
    </svg>
  );
}
function GlyphCanvas() {
  return (
    <svg {...glyphProps} role="img" aria-label="canvas">
      <rect x="2" y="3" width="12" height="10" />
      <line x1="2" y1="6" x2="14" y2="6" />
      <circle cx="4" cy="4.5" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="6" cy="4.5" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="8" cy="4.5" r="0.4" fill="currentColor" stroke="none" />
      <rect x="4" y="8" width="4" height="3" />
    </svg>
  );
}
function GlyphSlashCommand() {
  return (
    <svg {...glyphProps} role="img" aria-label="slash-command">
      <rect x="1.5" y="3.5" width="13" height="9" />
      <text
        x="3.5"
        y="11"
        fontFamily="'Berkeley Mono','JetBrains Mono',ui-monospace,monospace"
        fontSize="8"
        fontWeight={700}
        fill="currentColor"
        stroke="none"
      >
        /_
      </text>
    </svg>
  );
}
function GlyphFileTree() {
  return (
    <svg {...glyphProps} role="img" aria-label="file-tree">
      <line x1="3" y1="2.5" x2="3" y2="13.5" />
      <line x1="3" y1="5.5" x2="6" y2="5.5" />
      <line x1="3" y1="8.5" x2="6" y2="8.5" />
      <line x1="3" y1="11.5" x2="6" y2="11.5" />
      <line x1="6.5" y1="4.5" x2="13" y2="4.5" />
      <line x1="6.5" y1="7.5" x2="13" y2="7.5" />
      <line x1="6.5" y1="10.5" x2="13" y2="10.5" />
    </svg>
  );
}

function Wordmark() {
  // 240×32 viewBox, Berkeley-mono uppercase set, accent terminal dot. Uses
  // currentColor for the wordmark text + var(--accent) for the dot, so the
  // mark inherits host context fg + the stamp identity from tokens.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 32"
      width="240"
      height="32"
      role="img"
      aria-label="maude"
    >
      <g>
        <text
          x="0"
          y="24"
          fontFamily="'Berkeley Mono','JetBrains Mono','IBM Plex Mono',ui-monospace,monospace"
          fontSize={22}
          fontWeight={700}
          letterSpacing="0.04em"
          fill="currentColor"
        >
          MD-CLAUDE
        </text>
        <rect x="218" y="20" width="6" height="6" fill="var(--accent, oklch(56% 0.170 50))" />
      </g>
    </svg>
  );
}

export default function Logo() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.logo</span><span className="crumbs"><span>maude</span><span>design system</span><span>brand</span><span>logo</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Wordmark &amp; glyphs</h1><p className="lede">The mark is a single typeset of <code>MD-CLAUDE</code> in Berkeley Mono with one amber-rust terminal block. That's the catalog stamp dot. No drawn icon. The wordmark IS the mark. Below: four domain-noun SVG glyphs for the marketplace + dev-server surface.</p></section>
            <dl className="specimen-meta"><div><dt>Files</dt><dd>1 wordmark · 4 glyphs</dd></div><div><dt>Construction</dt><dd>Berkeley Mono · 0.04em tracking · accent dot</dd></div><div><dt>Reusable</dt><dd>currentColor → host context tints</dd></div></dl>

            <h2 data-no="01">Wordmark</h2>
            <div className="stage">
              <Wordmark />
            </div>

            <h2 data-no="02">Glyphs <span className="h2-aside">four domain nouns</span></h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: '0' }}>
              <div className="gly-card"><GlyphPlugin /><strong>plugin</strong><code>assets/glyphs/plugin.svg</code></div>
              <div className="gly-card"><GlyphCanvas /><strong>canvas</strong><code>assets/glyphs/canvas.svg</code></div>
              <div className="gly-card"><GlyphSlashCommand /><strong>slash-command</strong><code>assets/glyphs/slash-command.svg</code></div>
              <div className="gly-card"><GlyphFileTree /><strong>file-tree</strong><code>assets/glyphs/file-tree.svg</code></div>
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

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· logo · ★ signature</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
