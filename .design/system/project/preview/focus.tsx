/**
 * @canvas      focus — focus ring + keyboard focus on every interactive element.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.focus / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/focus/
 * @handoff     bunx shadcn add file://./focus.registry.json
 */

import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
export default function Focus() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.focus</span><span className="crumbs"><span>maude</span><span>design system</span><span>foundation</span><span>focus</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Focus ring</h1><p className="lede">2px solid accent. Same color, same thickness, every focusable thing. Buttons, inputs, links, toggles, switches, tabs. Press <kbd>Tab</kbd>. You can see where you are.</p></section>
            <dl className="specimen-meta"><div><dt>Token</dt><dd>--shadow-focus · 0 0 0 2px var(--accent)</dd></div><div><dt>Trigger</dt><dd>:focus-visible</dd></div></dl>

            <h2 data-no="01">Try it</h2>
            <p style={{ color: 'var(--fg-2)', fontSize: 'var(--type-sm)' }}>Press <kbd>Tab</kbd> repeatedly. Every stop is the same ring.</p>
            <div className="row">
              <button className="btn btn--primary">Install</button>
              <button className="btn">Inspect</button>
              <button className="btn btn--ghost">Cancel</button>
              <a href="#" style={{ color: 'var(--fg-0)', textDecoration: 'underline', textDecorationColor: 'var(--accent)', textUnderlineOffset: '3px' }}>A link</a>
              <input className="input" placeholder="An input" style={{ maxWidth: '200px' }} />
              <span className="switch" tabIndex="0" role="switch" aria-checked="false"></span>
              <span className="switch" tabIndex="0" role="switch" aria-checked="true"></span>
              <input type="checkbox" className="check" checked={true} />
              <input type="radio" className="radio" name="r" checked={true} />
            </div>

            <h2 data-no="02">Why the accent <span className="h2-aside">contrast over hue</span></h2>
            <p>The amber-rust accent has high contrast against both paper and phosphor surfaces, so the ring stays visible in both themes without per-theme overrides. The 2px width is the WCAG floor (3:1 against the surface it sits over).</p>

            <h2 data-no="03">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't replace <code>:focus-visible</code> with <code>:focus</code>. That lights up the ring on every mouse click. <code>:focus-visible</code> only shows the ring when the user is keyboarding, which is what they actually need.</p></div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· focus</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
