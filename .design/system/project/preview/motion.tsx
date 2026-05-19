/**
 * @canvas      motion — motion tokens. Hover-only; --dur-route is 1ms (instant).
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.motion / md-claude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/motion/
 * @handoff     bunx shadcn add file://./motion.registry.json
 */
import "./motion.css";

export default function Motion() {
  return (
    <>
          <header className="specimen-hd">
            <span className="sku">MDCC-DSN/01.motion</span>
            <span className="crumbs"><span>md-claude</span><span>design system</span><span>motion</span></span>
            <span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span>
          </header>
          <main className="specimen">
            <section className="specimen-title">
              <h1>Motion</h1>
              <p className="lede">Four durations, two easings. <code>--dur-route</code> is 1ms. Route changes in this DS are <em>instant</em>. That's not an oversight; pixel-pushers borrowed enough screen-time from your users already.</p>
            </section>
            <dl className="specimen-meta">
              <div><dt>Durations</dt><dd>4</dd></div>
              <div><dt>Easings</dt><dd>out · in-out</dd></div>
              <div><dt>Reduced motion</dt><dd>All durations clamp to 1ms</dd></div>
            </dl>

            <h2 data-no="01">Durations <span className="h2-aside">hover demo each</span></h2>
            <div className="motion-row"><span className="label">--dur-flip</span><span style={{ color: 'var(--fg-1)' }}>Button press / link hover. The "I noticed your click" twitch.</span><button className="demo-btn demo-flip">90ms · hover me</button></div>
            <div className="motion-row"><span className="label">--dur-panel</span><span style={{ color: 'var(--fg-1)' }}>Hover transitions on chrome. Tile hover, row hover.</span><button className="demo-btn demo-panel">140ms · hover me</button></div>
            <div className="motion-row"><span className="label">--dur-soft</span><span style={{ color: 'var(--fg-1)' }}>Tooltips, popovers, soft fades. The reduced-motion-safe ceiling.</span><button className="demo-btn demo-soft">180ms · hover me</button></div>
            <div className="motion-row"><span className="label">--dur-route</span><span style={{ color: 'var(--fg-1)' }}>Route changes. <strong>Instant.</strong> No "fade between pages" theatre.</span><button className="demo-btn demo-route">1ms · hover me</button></div>

            <h2 data-no="02">Easings <span className="h2-aside">two curves</span></h2>
            <p><code>--ease-out</code> · <code>cubic-bezier(0.22, 1, 0.36, 1)</code>. The default. Almost everything uses this. Fast start, gentle settle.</p>
            <p><code>--ease-in-out</code> · <code>cubic-bezier(0.65, 0, 0.35, 1)</code>. Symmetric, for the rare bidirectional motion (sheet slide-in-out where the same curve plays both ways).</p>

            <h2 data-no="03">Hard rules <span className="h2-aside">what motion is NOT</span></h2>
            <div className="anti">
              <p style={{ margin: '0 0 var(--space-2)' }}><strong>No animations beyond hover.</strong> No scroll-jacking. No parallax. No "ambient drift" on hero sections. No auto-play marquees.</p>
              <p style={{ margin: '0 0 var(--space-2)' }}><strong>No transitions on chrome.</strong> .specimen-hd doesn't animate in. .specimen-title doesn't fade up. The page is just <em>there</em>.</p>
              <p style={{ margin: '0' }}><strong>Route changes are 1ms.</strong> If you want a "what changed" affordance, use a brief content-area fade. Never a full-page fade.</p>
            </div>
            <div className="pro"><p style={{ margin: '0' }}><strong>Hover micro-interactions are encouraged</strong> at <code>--dur-flip</code> / <code>--dur-panel</code> + <code>--ease-out</code>. Bg-swap, border-swap, color-swap. All good. Anything that signals "I'm interactive" is the only motion this DS welcomes.</p></div>

            <footer className="specimen-ft">
              <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· motion</span></div>
              <div className="colo-block"><span>md-claude · v0.12.0</span></div>
            </footer>
          </main>
        </>
  );
}
