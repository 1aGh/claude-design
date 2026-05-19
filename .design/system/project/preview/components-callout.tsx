/**
 * @canvas      components-callout — callout blocks — info / warning / error / success / note.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-callout / md-claude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-callout/
 * @handoff     bunx shadcn add file://./components-callout.registry.json
 */
import "./components-callout.css";

export default function ComponentsCallout() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.components-callout</span><span className="crumbs"><span>md-claude</span><span>design system</span><span>components</span><span>callout</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Callouts</h1><p className="lede">Five flavors. Left-border in the semantic color, eyebrow in the same color, body in <code>--fg-1</code>. No icons by default. The rule + eyebrow do the work.</p></section>
            <dl className="specimen-meta"><div><dt>Flavors</dt><dd>info · warn · err · ok · note</dd></div><div><dt>Pattern</dt><dd>4px left rule + matching eyebrow</dd></div></dl>

            <h2 data-no="01">Five flavors</h2>
            <div className="call info"><div className="eyebrow">Info</div><p><code>mdcc design serve</code> picks a free port automatically. Override with <code>--port 4399</code> if you want a stable URL.</p></div>
            <div className="call warn"><div className="eyebrow">Warning</div><p>This canvas declares a <code>wordmark</code> claim in its README but <code>assets/logos/wordmark.svg</code> is missing. The completeness-critic V20 will flag it. Generate a placeholder or strip the claim.</p></div>
            <div className="call warn"><div className="eyebrow">Warning</div><p>Generation failed. Falling back to direct mode. The fact is in the final print. No silent downgrade.</p></div>
            <div className="call err"><div className="eyebrow">Error</div><p><code>mdcc init</code> refused to scaffold: <code>.ai/</code> already exists. Pass <code>--force</code> to overwrite. The templates have moved on.</p></div>
            <div className="call ok"><div className="eyebrow">Success</div><p>Bootstrapped <code>system/project/</code> with 36 specimens. Aesthetic critic panel passed at 4.1/5. Browse with <code>mdcc design serve</code>.</p></div>
            <div className="call note"><div className="eyebrow">Note</div><p>The amber-rust accent inherits a slight L shift between themes (56 to 72). Don't override per-theme. The OKLCH ramp is the canonical handling.</p></div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-callout</span></div><div className="colo-block"><span>md-claude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
