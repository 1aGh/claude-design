/**
 * @canvas      colors-text — ink ladder — primary/secondary/tertiary/disabled text on each surface from --bg-0..--bg-4. Verifies WCAG contrast in BOTH themes.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.colors-text / md-claude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/colors-text/
 * @handoff     bunx shadcn add file://./colors-text.registry.json
 */
export default function ColorsText() {
  return (
    <>
          <header className="specimen-hd">
              <span className="sku">MDCC-DSN/01.colors-text</span>
              <span className="crumbs"><span>md-claude</span><span>design system</span><span>color</span><span>text</span></span>
              <span className="theme-toggle" role="tablist" aria-label="Theme">
                <button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button>
              </span>
            </header>
            <main className="specimen">
              <section className="specimen-title">
                <h1>Ink ladder</h1>
                <p className="lede">Four text tokens. <code>--fg-0</code> through <code>--fg-3</code>. They drop in legibility, never in temperature. Each rung pairs with a surface so you don't have to guess if it'll pass contrast on phosphor.</p>
              </section>
              <dl className="specimen-meta">
                <div><dt>Published</dt><dd>2026-05-14</dd></div>
                <div><dt>Family</dt><dd>Color · text</dd></div>
                <div><dt>Themes</dt><dd>Paper + Phosphor</dd></div>
                <div><dt>Tokens</dt><dd>4</dd></div>
              </dl>

              <h2 data-no="01">The rungs <span className="h2-aside">primary → disabled</span></h2>
              <div className="grid">
                <div className="swatch">
                  <div className="chip" style={{ background: 'var(--fg-0)', height: '88px' }}></div>
                  <div className="meta"><strong>--fg-0</strong><span className="oklch">L 20 / 94</span></div>
                  <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-sm)', color: 'var(--fg-0)' }}>Primary ink. Body copy, headings, the README you actually read. Carries the catalog spine.</div>
                </div>
                <div className="swatch">
                  <div className="chip" style={{ background: 'var(--fg-1)', height: '88px' }}></div>
                  <div className="meta"><strong>--fg-1</strong><span className="oklch">L 38 / 78</span></div>
                  <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>Secondary. Captions, ledes, the second line of a tile. The "this is context" register.</div>
                </div>
                <div className="swatch">
                  <div className="chip" style={{ background: 'var(--fg-2)', height: '88px' }}></div>
                  <div className="meta"><strong>--fg-2</strong><span className="oklch">L 52 / 60</span></div>
                  <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-sm)', color: 'var(--fg-2)' }}>Tertiary. Eyebrows, SKU labels, footnotes. Anything that should be present but not loud.</div>
                </div>
                <div className="swatch">
                  <div className="chip" style={{ background: 'var(--fg-3)', height: '88px' }}></div>
                  <div className="meta"><strong>--fg-3</strong><span className="oklch">L 68 / 44</span></div>
                  <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-sm)', color: 'var(--fg-3)' }}>Disabled / placeholder. Not for normal reading; only for "this control exists but isn't reachable right now".</div>
                </div>
              </div>

              <h2 data-no="02">In context <span className="h2-aside">prose at each rung</span></h2>
              <div className="card">
                <p style={{ color: 'var(--fg-0)', margin: '0 0 var(--space-3)' }}><strong>fg-0. Primary.</strong> <code>mdcc init</code> scaffolds the .ai/ workspace into the current project. Run it once. The README will reflect the convention.</p>
                <p style={{ color: 'var(--fg-1)', margin: '0 0 var(--space-3)' }}><strong>fg-1. Secondary.</strong> If you re-run it, mdcc will detect the existing workspace and refuse to overwrite without <code>--force</code>. Yes, even when you really want it to. The rule isn't "we make this hard", it's "the templates already moved on".</p>
                <p style={{ color: 'var(--fg-2)', margin: '0 0 var(--space-3)' }}><strong>fg-2. Tertiary.</strong> See also: <code>mdcc design serve</code>, which boots the canvas browser at 4399 unless you say otherwise.</p>
                <p style={{ color: 'var(--fg-3)', margin: '0' }}><strong>fg-3. Disabled.</strong> Not reachable until a design system exists. Run <code>/design:setup-ds</code> first.</p>
              </div>

              <h2 data-no="03">Pair check <span className="h2-aside">fg over every surface</span></h2>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
                <div className="swatch" style={{ background: 'var(--bg-0)' }}>
                  <div style={{ padding: 'var(--space-4)', minHeight: '124px' }}><div className="eyebrow">bg-0 · page</div><p style={{ color: 'var(--fg-0)', margin: 'var(--space-2) 0 var(--space-1)', fontWeight: '600' }}>md-claude</p><p style={{ color: 'var(--fg-1)', fontSize: 'var(--type-xs)', margin: '0' }}>A marketplace of plugins. A canvas of HTML.</p></div>
                </div>
                <div className="swatch" style={{ background: 'var(--bg-1)' }}>
                  <div style={{ padding: 'var(--space-4)', minHeight: '124px' }}><div className="eyebrow">bg-1 · card</div><p style={{ color: 'var(--fg-0)', margin: 'var(--space-2) 0 var(--space-1)', fontWeight: '600' }}>md-claude</p><p style={{ color: 'var(--fg-1)', fontSize: 'var(--type-xs)', margin: '0' }}>A marketplace of plugins. A canvas of HTML.</p></div>
                </div>
                <div className="swatch" style={{ background: 'var(--bg-2)' }}>
                  <div style={{ padding: 'var(--space-4)', minHeight: '124px' }}><div className="eyebrow">bg-2 · panel</div><p style={{ color: 'var(--fg-0)', margin: 'var(--space-2) 0 var(--space-1)', fontWeight: '600' }}>md-claude</p><p style={{ color: 'var(--fg-1)', fontSize: 'var(--type-xs)', margin: '0' }}>A marketplace of plugins. A canvas of HTML.</p></div>
                </div>
                <div className="swatch" style={{ background: 'var(--bg-3)' }}>
                  <div style={{ padding: 'var(--space-4)', minHeight: '124px' }}><div className="eyebrow">bg-3 · input</div><p style={{ color: 'var(--fg-0)', margin: 'var(--space-2) 0 var(--space-1)', fontWeight: '600' }}>md-claude</p><p style={{ color: 'var(--fg-1)', fontSize: 'var(--type-xs)', margin: '0' }}>A marketplace of plugins. A canvas of HTML.</p></div>
                </div>
                <div className="swatch" style={{ background: 'var(--bg-4)' }}>
                  <div style={{ padding: 'var(--space-4)', minHeight: '124px' }}><div className="eyebrow">bg-4 · pressed</div><p style={{ color: 'var(--fg-0)', margin: 'var(--space-2) 0 var(--space-1)', fontWeight: '600' }}>md-claude</p><p style={{ color: 'var(--fg-1)', fontSize: 'var(--type-xs)', margin: '0' }}>A marketplace of plugins. A canvas of HTML.</p></div>
                </div>
              </div>

              <h2 data-no="04">When not to use <span className="h2-aside">fg-3 ≠ "subtle text"</span></h2>
              <div className="anti">
                <p style={{ margin: '0' }}>Don't reach for <code>--fg-3</code> when you want "quiet emphasis". That's <code>--fg-2</code>'s job. <code>--fg-3</code> is reserved for disabled={true} / unavailable controls. If a sighted reader doesn't know "this is currently off", you've used the wrong rung.</p>
              </div>
              <div className="pro">
                <p style={{ margin: '0' }}>Pair <code>--fg-2</code> with <code>--tracking-eyebrow</code> + uppercase for inline metadata ("PUBLISHED · 2026-05-14"). The catalog-eyebrow is the canonical "secondary but present" treatment in this DS.</p>
              </div>

              <footer className="specimen-ft">
                <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· colors-text · paper+phosphor</span></div>
                <div className="colo-block"><span>md-claude · v0.12.0</span></div>
              </footer>
            </main>
        </>
  );
}
