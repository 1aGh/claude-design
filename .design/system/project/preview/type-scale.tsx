/**
 * @canvas      type-scale — Berkeley-forward 8-step type ladder. Mono everywhere. Show each step at its --type-N / --lh-N pairing + the tracking ladder.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.type-scale / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/type-scale/
 * @handoff     bunx shadcn add file://./type-scale.registry.json
 */
import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
import "./type-scale.css";

export default function TypeScale() {
  return (
    <>
          <header className="specimen-hd">
            <span className="sku">MDCC-DSN/01.type-scale</span>
            <span className="crumbs"><span>maude</span><span>design system</span><span>type</span><span>scale</span></span>
            <ThemeToggle />
          </header>
          <main className="specimen">
            <section className="specimen-title">
              <h1>Type ladder</h1>
              <p className="lede">Eight steps, all Berkeley Mono. If a section feels tight, the answer is line-height or tracking. Never a sans escape hatch. Mono is the commitment, not the fallback.</p>
            </section>
            <dl className="specimen-meta">
              <div><dt>Family</dt><dd>Berkeley Mono · ui-monospace fallback</dd></div>
              <div><dt>Steps</dt><dd>8</dd></div>
              <div><dt>Base</dt><dd>13px / 20px lh</dd></div>
            </dl>

            <h2 data-no="01">Size ladder <span className="h2-aside">--type-xs → --type-3xl</span></h2>
            <div className="type-row"><span className="label">--type-3xl</span><span className="specimen-line" style={{ fontSize: 'var(--type-3xl)', lineHeight: 'var(--lh-3xl)', letterSpacing: 'var(--tracking-tight)', fontWeight: '600' }}>A plugin marketplace</span><span className="meta">40 / 48</span></div>
            <div className="type-row"><span className="label">--type-2xl</span><span className="specimen-line" style={{ fontSize: 'var(--type-2xl)', lineHeight: 'var(--lh-2xl)', fontWeight: '600' }}>Install with mdcc</span><span className="meta">28 / 36</span></div>
            <div className="type-row"><span className="label">--type-xl</span><span className="specimen-line" style={{ fontSize: 'var(--type-xl)', lineHeight: 'var(--lh-xl)', fontWeight: '600' }}>Canvas-first iteration</span><span className="meta">22 / 30</span></div>
            <div className="type-row"><span className="label">--type-lg</span><span className="specimen-line" style={{ fontSize: 'var(--type-lg)', lineHeight: 'var(--lh-lg)' }}>Section heading or callout</span><span className="meta">18 / 28</span></div>
            <div className="type-row"><span className="label">--type-md</span><span className="specimen-line" style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--lh-md)' }}>Lede paragraph. The line right under the h1</span><span className="meta">15 / 24</span></div>
            <div className="type-row"><span className="label">--type-base</span><span className="specimen-line" style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--lh-base)' }}>Body copy. mdcc init scaffolds .ai/ into the current project. Fails loud if not a git repo.</span><span className="meta">13 / 20</span></div>
            <div className="type-row"><span className="label">--type-sm</span><span className="specimen-line" style={{ fontSize: 'var(--type-sm)', lineHeight: 'var(--lh-sm)' }}>Compact body, captions, table cells</span><span className="meta">12 / 18</span></div>
            <div className="type-row"><span className="label">--type-xs</span><span className="specimen-line" style={{ fontSize: 'var(--type-xs)', lineHeight: 'var(--lh-xs)', letterSpacing: 'var(--tracking-sku)', textTransform: 'uppercase' }}>SKU LABEL · EYEBROW</span><span className="meta">11 / 16</span></div>

            <h2 data-no="02">Tracking ladder <span className="h2-aside">five steps</span></h2>
            <div className="track-row"><span className="label" style={{ letterSpacing: 'var(--tracking-sku)' }}>--tracking-tight</span><span style={{ letterSpacing: 'var(--tracking-tight)', color: 'var(--fg-0)', fontSize: 'var(--type-xl)' }}>Heading. -0.01em.</span></div>
            <div className="track-row"><span className="label" style={{ letterSpacing: 'var(--tracking-sku)' }}>--tracking-normal</span><span style={{ letterSpacing: 'var(--tracking-normal)', color: 'var(--fg-0)' }}>Body copy default. 0em.</span></div>
            <div className="track-row"><span className="label" style={{ letterSpacing: 'var(--tracking-sku)' }}>--tracking-wide</span><span style={{ letterSpacing: 'var(--tracking-wide)', color: 'var(--fg-0)', textTransform: 'uppercase' }}>META · ROW · LABEL</span></div>
            <div className="track-row"><span className="label" style={{ letterSpacing: 'var(--tracking-sku)' }}>--tracking-sku</span><span style={{ letterSpacing: 'var(--tracking-sku)', color: 'var(--fg-0)', textTransform: 'uppercase' }}>MDCC-DSN/01 · SKU FRAMING</span></div>
            <div className="track-row"><span className="label" style={{ letterSpacing: 'var(--tracking-sku)' }}>--tracking-eyebrow</span><span style={{ letterSpacing: 'var(--tracking-eyebrow)', color: 'var(--fg-0)', textTransform: 'uppercase' }}>EYEBROW · PUBLISHED · 2026-05-14</span></div>

            <h2 data-no="03">Real prose <span className="h2-aside">demonstration paragraph</span></h2>
            <p>mdcc design serve boots a canvas browser at port 4399 (or whatever you ask for). It scans <code>.design/system/&lt;ds&gt;/preview/</code>, builds a file-tree, and lets you tab between iframe previews. The element inspector overlay attaches itself with <kbd>Cmd</kbd>+<kbd>Click</kbd>. Pick a node, the active selection writes itself to <code>_active.json</code>, and <code>/design:edit "&lt;feedback&gt;"</code> scopes its edit to the picked element. Zero dependencies, zero npm install scratchpad. It's a Node script. It will outlive you.</p>

            <h2 data-no="04">When not to use <span className="h2-aside">don't reach for a sans</span></h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't introduce <code>font-family: Inter</code> or any humanist sans into a Maude canvas. If the result feels claustrophobic, the fix is line-height or letter-spacing. Never a font swap. Mono everywhere is the commitment.</p></div>
            <div className="pro"><p style={{ margin: '0' }}>If a body paragraph feels dense, bump <code>line-height</code> by 4px or apply <code>letter-spacing: 0.01em</code>. Berkeley Mono at 13/22 with 0.01em tracking reads as comfortably as any sans body. The trick is the rhythm, not the family.</p></div>

            <footer className="specimen-ft">
              <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· type-scale</span></div>
              <div className="colo-block"><span>Maude · v0.12.0</span></div>
            </footer>
          </main>
        </>
  );
}
