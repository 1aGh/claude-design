/**
 * @canvas      colors-surfaces — surface ladder (--bg-0..--bg-4) + border tokens + how panels layer. Verifies depth-via-bg-shift (no shadows) reads in both paper and phosphor.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.colors-surfaces / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/colors-surfaces/
 * @handoff     bunx shadcn add file://./colors-surfaces.registry.json
 */

import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
export default function ColorsSurfaces() {
  return (
    <>
          <header className="specimen-hd">
            <span className="sku">MDCC-DSN/01.colors-surfaces</span>
            <span className="crumbs"><span>maude</span><span>design system</span><span>color</span><span>surfaces</span></span>
            <ThemeToggle />
          </header>
          <main className="specimen">
            <section className="specimen-title">
              <h1>Surface ladder</h1>
              <p className="lede">Five steps. <code>--bg-0</code> is the page. <code>--bg-4</code> is the deepest hover. Depth in this DS comes from 1px rules and bg-shifts. Never from drop-shadow. If you can't see the layer separation, fix the rule, not the shadow.</p>
            </section>
            <dl className="specimen-meta">
              <div><dt>Published</dt><dd>2026-05-14</dd></div>
              <div><dt>Family</dt><dd>Color · surface</dd></div>
              <div><dt>Tokens</dt><dd>5 bg · 3 border</dd></div>
              <div><dt>Shadows</dt><dd>None (by design)</dd></div>
            </dl>

            <h2 data-no="01">The rungs <span className="h2-aside">deepest → shallowest</span></h2>
            <div className="grid">
              <div className="swatch"><div className="chip" style={{ background: 'var(--bg-0)' }}></div><div className="meta"><strong>--bg-0</strong><span className="oklch">page</span></div></div>
              <div className="swatch"><div className="chip" style={{ background: 'var(--bg-1)' }}></div><div className="meta"><strong>--bg-1</strong><span className="oklch">card</span></div></div>
              <div className="swatch"><div className="chip" style={{ background: 'var(--bg-2)' }}></div><div className="meta"><strong>--bg-2</strong><span className="oklch">nested / popover</span></div></div>
              <div className="swatch"><div className="chip" style={{ background: 'var(--bg-3)' }}></div><div className="meta"><strong>--bg-3</strong><span className="oklch">input</span></div></div>
              <div className="swatch"><div className="chip" style={{ background: 'var(--bg-4)' }}></div><div className="meta"><strong>--bg-4</strong><span className="oklch">hover / pressed</span></div></div>
            </div>

            <h2 data-no="02">Borders <span className="h2-aside">hairlines do the depth work</span></h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              <div className="swatch" style={{ background: 'var(--bg-1)', padding: 'var(--space-5)', border: '1px solid var(--border-subtle)' }}>
                <div className="eyebrow">--border-subtle</div>
                <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--fg-1)', fontSize: 'var(--type-sm)' }}>The "barely there" hairline. Use between rows in a tight list.</p>
              </div>
              <div className="swatch" style={{ background: 'var(--bg-1)', padding: 'var(--space-5)', border: '1px solid var(--border-default)' }}>
                <div className="eyebrow">--border-default</div>
                <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--fg-1)', fontSize: 'var(--type-sm)' }}>The catalog hairline. Specimen frames, tile edges, input borders.</p>
              </div>
              <div className="swatch" style={{ background: 'var(--bg-1)', padding: 'var(--space-5)', border: '1px solid var(--border-strong)' }}>
                <div className="eyebrow">--border-strong</div>
                <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--fg-1)', fontSize: 'var(--type-sm)' }}>For section separators (h2 underline) and primary button edges.</p>
              </div>
            </div>

            <h2 data-no="03">In layers <span className="h2-aside">popover over card over page</span></h2>
            <div style={{ background: 'var(--bg-0)', padding: 'var(--space-7)', border: '1px solid var(--border-default)', position: 'relative', minHeight: '200px' }}>
              <div className="eyebrow">bg-0 · page</div>
              <div style={{ background: 'var(--bg-1)', padding: 'var(--space-5)', border: '1px solid var(--border-default)', margin: 'var(--space-3) 0', position: 'relative', width: '60%' }}>
                <div className="eyebrow">bg-1 · card</div>
                <p style={{ margin: 'var(--space-2) 0 0' }}>"Open file-tree" → "edit snapshot" → "save canvas". Three steps. Each its own surface.</p>
                <div style={{ background: 'var(--bg-2)', padding: 'var(--space-4)', border: '1px solid var(--border-default)', marginTop: 'var(--space-3)', position: 'absolute', right: 'var(--space-3)', top: 'var(--space-3)', width: '55%' }}>
                  <div className="eyebrow">bg-2 · popover</div>
                  <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>A floating menu that respects the catalog grid. No backdrop blur, no drop shadow.</p>
                </div>
              </div>
            </div>

            <h2 data-no="04">When not to use <span className="h2-aside">depth ≠ shadow</span></h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't add <code>box-shadow</code> to bump a card "above" the page. The bg-shift between <code>--bg-0</code> and <code>--bg-1</code> + the 1px rule does that already. Adding shadow is breaking the signature.</p></div>
            <div className="pro"><p style={{ margin: '0' }}>If a card needs more emphasis, increase the 1px rule to <code>--border-strong</code> or accent-tint a left border (<code>border-left: 4px solid var(--accent)</code>). The depth ladder is one step + 1px, repeat.</p></div>

            <footer className="specimen-ft">
              <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· colors-surfaces</span></div>
              <div className="colo-block"><span>Maude · v0.12.0</span></div>
            </footer>
          </main>
        </>
  );
}
