/**
 * @canvas      borders — 1px hairline catalog — three border tokens, the depth-via-rules method.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.borders / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/borders/
 * @handoff     bunx shadcn add file://./borders.registry.json
 */

import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
export default function Borders() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.borders</span><span className="crumbs"><span>maude</span><span>design system</span><span>foundation</span><span>borders</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Borders</h1><p className="lede">1px hairlines do the depth work. No shadows, no glow. Three weights cover everything from "barely there" row separators to "this is the page section" h2 underlines.</p></section>
            <dl className="specimen-meta"><div><dt>Tokens</dt><dd>3</dd></div><div><dt>Width</dt><dd>1px (default) · 2px (--border-width-strong)</dd></div></dl>

            <h2 data-no="01">Three weights</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: '0' }}>
              <div style={{ padding: 'var(--space-5)', background: 'var(--bg-1)', border: '1px solid var(--border-subtle)' }}><div className="eyebrow">--border-subtle</div><p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>Row dividers in dense lists. Easy to miss. That's the point.</p></div>
              <div style={{ padding: 'var(--space-5)', background: 'var(--bg-1)', border: '1px solid var(--border-default)' }}><div className="eyebrow">--border-default</div><p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>The catalog hairline. Tile edges, input borders, table cells.</p></div>
              <div style={{ padding: 'var(--space-5)', background: 'var(--bg-1)', border: '1px solid var(--border-strong)' }}><div className="eyebrow">--border-strong</div><p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>h2 underlines, primary button edges, .specimen-hd bottom.</p></div>
            </div>

            <h2 data-no="02">Overlapping-border grid <span className="h2-aside">the catalog trick</span></h2>
            <p>Use <code>border: 1px solid var(--border-default); margin: -1px 0 0 -1px;</code> on grid children so adjacent edges collapse into a single 1px rule. No doubled lines.</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: '0', border: '1px solid var(--border-default)' }}>
              <div style={{ background: 'var(--bg-1)', padding: 'var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', border: '1px solid var(--border-default)', margin: '-1px 0 0 -1px' }}>cell 01</div>
              <div style={{ background: 'var(--bg-1)', padding: 'var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', border: '1px solid var(--border-default)', margin: '-1px 0 0 -1px' }}>cell 02</div>
              <div style={{ background: 'var(--bg-1)', padding: 'var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', border: '1px solid var(--border-default)', margin: '-1px 0 0 -1px' }}>cell 03</div>
              <div style={{ background: 'var(--bg-1)', padding: 'var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', border: '1px solid var(--border-default)', margin: '-1px 0 0 -1px' }}>cell 04</div>
              <div style={{ background: 'var(--bg-1)', padding: 'var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', border: '1px solid var(--border-default)', margin: '-1px 0 0 -1px' }}>cell 05</div>
              <div style={{ background: 'var(--bg-1)', padding: 'var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', border: '1px solid var(--border-default)', margin: '-1px 0 0 -1px' }}>cell 06</div>
              <div style={{ background: 'var(--bg-1)', padding: 'var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', border: '1px solid var(--border-default)', margin: '-1px 0 0 -1px' }}>cell 07</div>
              <div style={{ background: 'var(--bg-1)', padding: 'var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', border: '1px solid var(--border-default)', margin: '-1px 0 0 -1px' }}>cell 08</div>
            </div>

            <h2 data-no="03">Accent border <span className="h2-aside">left-edge stamp</span></h2>
            <div className="tile tile--accent" style={{ maxWidth: '480px' }}>
              <div className="tile-hd"><span className="sku">MDCC-DSN/01</span><span>v0.12.0</span></div>
              <div className="tile-bd"><h3>Featured plugin</h3><p>4px left border = "this is the one we're spotlighting". Subtle, no fanfare.</p></div>
            </div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· borders</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
