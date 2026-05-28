/**
 * @canvas      components-diff-view — diff view — added/removed/context gutters, color-mixed bg.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-diff-view / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-diff-view/
 * @handoff     bunx shadcn add file://./components-diff-view.registry.json
 */
import { ThemeToggle } from "./_specimen-controls";
import "./components-diff-view.css";

export default function ComponentsDiffView() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.components-diff-view</span><span className="crumbs"><span>maude</span><span>design system</span><span>dev</span><span>diff</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Diff view</h1><p className="lede">Added/removed gutter colored with the status family, bg tinted via <code>color-mix</code> at low alpha so the text stays readable. Mono everywhere. No fancy syntax in diffs. The change is the signal.</p></section>
            <dl className="specimen-meta"><div><dt>Tints</dt><dd>success (add) · error (del)</dd></div><div><dt>Mix</dt><dd>12% bg · 22% gutter</dd></div></dl>

            <h2 data-no="01">Token change</h2>
            <div className="diff">
              <div className="dh"><span>system/project/colors_and_type.css</span><span>+1 / -1</span></div>
              <div className="row"><div className="gut">42</div><div className="ln"><span style={{ color: 'var(--fg-2)' }}>  /* ─── Accent (one family) ───────────────── */</span></div></div>
              <div className="row del"><div className="gut">43</div><div className="ln">-  --accent: oklch(64% 0.180 35);</div></div>
              <div className="row add"><div className="gut">43</div><div className="ln">+  --accent: oklch(56% 0.170 50);</div></div>
              <div className="row"><div className="gut">44</div><div className="ln">  --accent-hover: oklch(from var(--accent) calc(l - 0.04) c h);</div></div>
            </div>

            <h2 data-no="02">Multi-line edit</h2>
            <div className="diff">
              <div className="dh"><span>preview/_layout.css · .specimen-hd</span><span>+3 / -2</span></div>
              <div className="row"><div className="gut">61</div><div className="ln">.specimen-hd {'{'}</div></div>
              <div className="row del"><div className="gut">62</div><div className="ln">-  padding: var(--space-3) var(--space-5);</div></div>
              <div className="row del"><div className="gut">63</div><div className="ln">-  font-size: var(--type-sm);</div></div>
              <div className="row add"><div className="gut">62</div><div className="ln">+  padding: var(--space-4) var(--space-6);</div></div>
              <div className="row add"><div className="gut">63</div><div className="ln">+  font-size: var(--type-xs);</div></div>
              <div className="row add"><div className="gut">64</div><div className="ln">+  letter-spacing: var(--tracking-sku);</div></div>
              <div className="row"><div className="gut">65</div><div className="ln">  border-bottom: var(--rule-strong);</div></div>
            </div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-diff-view</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
