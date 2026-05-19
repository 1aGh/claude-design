/**
 * @canvas      colors-status — status color family — success / warn / error / info.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.colors-status / md-claude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/colors-status/
 * @handoff     bunx shadcn add file://./colors-status.registry.json
 */
export default function ColorsStatus() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.colors-status</span><span className="crumbs"><span>md-claude</span><span>design system</span><span>color</span><span>status</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Status family</h1><p className="lede">Four semantic colors. Distinct from <code>--accent</code> (which is brand, not status). The amber-warn is hue-shifted from accent so they can co-exist without bleeding into each other.</p></section>
            <dl className="specimen-meta"><div><dt>Tokens</dt><dd>4 · success/warn/error/info</dd></div><div><dt>Hue separation</dt><dd>warn-accent ≥ 35° tilt</dd></div></dl>

            <h2 data-no="01">Swatches</h2>
            <div className="grid">
              <div className="swatch"><div className="chip" style={{ background: 'var(--status-success)', height: '88px' }}></div><div className="meta"><strong>--status-success</strong><span className="oklch">L 48 / 72 · H 145</span></div><div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)' }}>install ok · validation pass · published live</div></div>
              <div className="swatch"><div className="chip" style={{ background: 'var(--status-warn)', height: '88px' }}></div><div className="meta"><strong>--status-warn</strong><span className="oklch">L 64 / 80 · H 88</span></div><div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)' }}>beta · deprecated · "we should look at this"</div></div>
              <div className="swatch"><div className="chip" style={{ background: 'var(--status-error)', height: '88px' }}></div><div className="meta"><strong>--status-error</strong><span className="oklch">L 50 / 68 · H 25</span></div><div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)' }}>install failed · validation block · 500</div></div>
              <div className="swatch"><div className="chip" style={{ background: 'var(--status-info)', height: '88px' }}></div><div className="meta"><strong>--status-info</strong><span className="oklch">L 50 / 72 · H 230</span></div><div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--type-xs)', color: 'var(--fg-2)' }}>tip · neutral notice · "fyi"</div></div>
            </div>

            <h2 data-no="02">In context</h2>
            <div className="row">
              <span className="badge badge--success">live</span>
              <span className="badge badge--warn">beta</span>
              <span className="badge badge--error">failed</span>
              <span className="badge badge--info">tip</span>
              <span className="badge badge--accent">featured</span>
            </div>
            <div className="row">
              <span className="dot dot--success"></span><span>installed</span>
              <span className="dot dot--warn"></span><span>update available</span>
              <span className="dot dot--error"></span><span>install failed</span>
              <span className="dot dot--info"></span><span>pinned</span>
            </div>

            <h2 data-no="03">Why hue-shift the warn</h2>
            <p>The accent is amber-rust (H 50). The warn is shifted to amber-yellow (H 88). Close enough to feel "in the same family" of warm hues, but distinct enough that a status pill never reads as a brand stamp. If they were the same H, every warning would look like a feature.</p>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· colors-status</span></div><div className="colo-block"><span>md-claude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
