/**
 * @canvas      colors-accent — SIGNATURE — the accent family (amber-rust catalog stamp). Demonstrates --accent / --accent-hover / --accent-active / --accent-fg / --accent-tint, the brand-spotlight stamp composition, anti-pattern ca
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.colors-accent / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/colors-accent/
 * @handoff     bunx shadcn add file://./colors-accent.registry.json
 */
import "./colors-accent.css";

export default function ColorsAccent() {
  return (
    <>
          <header className="specimen-hd">
            <span className="sku">MDCC-DSN/01.colors-accent</span>
            <span className="crumbs"><span>maude</span><span>design system</span><span>color</span><span>accent</span></span>
            <span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span>
          </header>
          <main className="specimen">
            <section className="specimen-title">
              <h1>Accent. Amber-rust.</h1>
              <p className="lede">One color. Five tokens. The accent never carries identity by itself. It joins the mono spine and the 1px hairlines to do the work. If your eye lands on the accent before the typography, the typography lost.</p>
            </section>
            <dl className="specimen-meta">
              <div><dt>Published</dt><dd>2026-05-14</dd></div>
              <div><dt>Family</dt><dd>Accent (one)</dd></div>
              <div><dt>Light OKLCH</dt><dd>56% 0.170 50</dd></div>
              <div><dt>Dark OKLCH</dt><dd>72% 0.160 55</dd></div>
            </dl>

            <h2 data-no="01">The stamp <span className="h2-aside">brand-spotlight</span></h2>
            <p>This is the accent at its loudest: the catalog stamp. Use it once per page. Opening a plugin page, anchoring a marketplace hero, marking the "this is the thing" moment in a showcase. (Twice is already an argument.)</p>
            <div className="stamp">
              <div className="stamp-eyebrow">MDCC-DSN/01 · PUBLISHED 2026-05-14</div>
              <h3 className="stamp-headline">maude design system</h3>
              <p className="stamp-body">A catalog-disciplined, mono-everywhere DS for the marketplace and the dev-server canvas. Berkeley-forward, hard-edges, paper-and-phosphor. The accent is a stamp, not a fill.</p>
              <div className="stamp-meta">
                <span><strong>Mood</strong> Industrial Catalogue</span>
                <span><strong>Voice</strong> htmx-grain</span>
                <span><strong>Density</strong> Balanced</span>
              </div>
            </div>

            <h2 data-no="02">The family <span className="h2-aside">five tokens, one hue</span></h2>
            <div className="grid">
              <div className="swatch">
                <div className="chip" style={{ background: 'var(--accent)', height: '96px' }}></div>
                <div className="meta"><strong>--accent</strong><span className="oklch">56/0.170/50</span></div>
                <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', borderTop: '1px solid var(--border-subtle)' }}>Primary buttons. The stamp. Active tab indicators.</div>
              </div>
              <div className="swatch">
                <div className="chip" style={{ background: 'var(--accent-hover)', height: '96px' }}></div>
                <div className="meta"><strong>--accent-hover</strong><span className="oklch">−4 L</span></div>
                <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', borderTop: '1px solid var(--border-subtle)' }}>Hover state of <code>--accent</code>.</div>
              </div>
              <div className="swatch">
                <div className="chip" style={{ background: 'var(--accent-active)', height: '96px' }}></div>
                <div className="meta"><strong>--accent-active</strong><span className="oklch">−8 L</span></div>
                <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', borderTop: '1px solid var(--border-subtle)' }}>Pressed / armed state.</div>
              </div>
              <div className="swatch">
                <div className="chip" style={{ background: 'var(--accent-fg)', height: '96px', borderBottom: '1px solid var(--border-default)' }}></div>
                <div className="meta"><strong>--accent-fg</strong><span className="oklch">paper</span></div>
                <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', borderTop: '1px solid var(--border-subtle)' }}>Foreground over <code>--accent</code> (button labels, stamp text).</div>
              </div>
              <div className="swatch">
                <div className="chip" style={{ background: 'var(--accent-tint)', height: '96px' }}></div>
                <div className="meta"><strong>--accent-tint</strong><span className="oklch">low-sat wash</span></div>
                <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)', borderTop: '1px solid var(--border-subtle)' }}>Cell highlight (selected file-tree row), focus-bg under inputs.</div>
              </div>
            </div>

            <h2 data-no="03">In context <span className="h2-aside">buttons / links / tile-accent</span></h2>
            <div className="accent-row">
              <button className="btn btn--primary">Install plugin</button>
              <button className="btn btn--primary"><span>Open canvas</span><span className="kbd">⌘O</span></button>
              <button className="btn">Cancel</button>
              <a href="#" style={{ color: 'var(--fg-0)', textDecoration: 'underline', textDecorationColor: 'var(--accent)', textUnderlineOffset: '4px' }}>A link with accent underline</a>
            </div>
            <div className="accent-row">
              <span className="badge badge--accent">MDCC-DSN/01</span>
              <span className="badge badge--accent badge--solid">v0.12.0</span>
              <span className="sku">MDCC-FLW/02</span>
              <span className="sku sku--accent">FEATURED</span>
            </div>
            <div className="tile tile--accent" style={{ maxWidth: '480px' }}>
              <div className="tile-hd"><span className="sku">MDCC-DSN/01</span><span>v0.12.0</span></div>
              <div className="tile-bd">
                <h3>design</h3>
                <p>Canvas-first iteration on HTML mocks. Zero-dep dev-server. Cmd+Click inspector. Snapshot stack per canvas.</p>
              </div>
              <div className="tile-ft"><span>FEATURED</span><span>·</span><span>Published 2026-05</span></div>
            </div>

            <h2 data-no="04">When NOT to use <span className="h2-aside">accent is a stamp, not a fill</span></h2>
            <div className="anti">
              <p style={{ margin: '0 0 var(--space-2)' }}><strong>Don't fill page bgs or hero panels with accent.</strong> The stamp metaphor only works because the accent is rare. Fill a whole page with it and it becomes the chrome, not the signal.</p>
              <p style={{ margin: '0' }}>Don't introduce a second accent ("but we need a status-accent for warnings!"). Status has its own family (<code>--status-warn</code>). The accent is the brand. Keep it singular.</p>
            </div>
            <div className="pro">
              <p style={{ margin: '0' }}><strong>Do use accent as the underline color for body links</strong> (with <code>text-decoration-color: var(--accent)</code>). The link text stays <code>--fg-0</code>; the accent reads as a margin note rather than a fill. This is the canonical "accent in long-form" treatment.</p>
            </div>

            <h2 data-no="05">Per-theme variance <span className="h2-aside">brighter on dark, deeper on paper</span></h2>
            <p>The accent shifts L between themes so it stays readable but never glares. Paper (L 56) reads as deep amber-rust ink. Phosphor (L 72) reads as a brighter sodium-amber that doesn't get lost on dark canvas. Hue tilts very slightly (50 to 55). Same family, calibrated for the surface.</p>

            <footer className="specimen-ft">
              <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· colors-accent · ★ signature</span></div>
              <div className="colo-block"><span>Maude · v0.12.0</span></div>
            </footer>
          </main>
        </>
  );
}
