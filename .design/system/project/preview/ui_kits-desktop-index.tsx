/**
 * @canvas      ui_kits-desktop-index — catalog launcher — index of every peer specimen. Written LAST.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01 / Maude · catalog index
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/ui-kits-desktop-index/
 * @handoff     bunx shadcn add file://./ui_kits-desktop-index.registry.json
 */
import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
import "./ui_kits-desktop-index.css";

export default function UiKitsDesktopIndex() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01 · INDEX</span><span className="crumbs"><span>maude</span><span>design system</span><span>desktop</span><span>index</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title">
              <h1>Catalog index</h1>
              <p className="lede">Every specimen in MDCC-DSN/01, grouped by family. Click a card to open={true} the canvas. Signature pieces (★) carry an accent left edge. The showcase (★★) is the highest-leverage "DS in use" composition. (Start there if it's your first visit.)</p>
            </section>
            <dl className="specimen-meta">
              <div><dt>Specimens</dt><dd>36</dd></div>
              <div><dt>Signature</dt><dd>4 (colors-accent · empty-state · logo · ui_kits-desktop-showcase)</dd></div>
              <div><dt>Audience</dt><dd>developer tool</dd></div>
            </dl>

            <section className="group">
              <h2 data-no="00">Showcase <span className="h2-aside">DS in use</span></h2>
              <div className="cat-grid">
                <a className="cat-card signature" href="./ui_kits-desktop-showcase.html">
                  <div className="hd"><span className="sku-bit">MDCC-DSN/01.SHOWCASE</span><span className="star">★★</span></div>
                  <div className="name">Desktop showcase</div>
                  <p className="desc">Full mdcc-design-server mock: titlebar + file-tree + tabbed iframe + inspector pins + status bar. Accent picker.</p>
                </a>
              </div>
            </section>

            <section className="group">
              <h2 data-no="01">Tokens · color</h2>
              <div className="cat-grid">
                <a className="cat-card" href="./colors-text.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.COLORS-TEXT</span></div><div className="name">Ink ladder</div><p className="desc">--fg-0..--fg-3 on every surface. Pair checks.</p></a>
                <a className="cat-card" href="./colors-surfaces.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.COLORS-SURFACES</span></div><div className="name">Surface ladder</div><p className="desc">--bg-0..--bg-4 + borders. Depth-via-rules.</p></a>
                <a className="cat-card signature" href="./colors-accent.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.COLORS-ACCENT</span><span className="star">★</span></div><div className="name">Accent. Amber-rust.</div><p className="desc">One color, five tokens, the catalog stamp.</p></a>
                <a className="cat-card" href="./colors-status.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.COLORS-STATUS</span></div><div className="name">Status family</div><p className="desc">success / warn / error / info.</p></a>
                <a className="cat-card" href="./colors-themes-side-by-side.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.COLORS-THEMES</span></div><div className="name">Paper vs phosphor</div><p className="desc">Both themes, same content, side-by-side.</p></a>
              </div>
            </section>

            <section className="group">
              <h2 data-no="02">Tokens · type / space / motion</h2>
              <div className="cat-grid">
                <a className="cat-card" href="./type-scale.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.TYPE-SCALE</span></div><div className="name">Type ladder</div><p className="desc">8-step Berkeley Mono + tracking ladder.</p></a>
                <a className="cat-card" href="./type-mono.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.TYPE-MONO</span></div><div className="name">Mono type</div><p className="desc">Weights, identifiers, ch grid, tabular nums.</p></a>
                <a className="cat-card" href="./spacing-scale.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.SPACING-SCALE</span></div><div className="name">Spacing</div><p className="desc">10 steps, 4px base.</p></a>
                <a className="cat-card" href="./motion.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.MOTION</span></div><div className="name">Motion</div><p className="desc">4 durations, hover-only. Route = 1ms.</p></a>
              </div>
            </section>

            <section className="group">
              <h2 data-no="03">Foundations</h2>
              <div className="cat-grid">
                <a className="cat-card" href="./borders.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.BORDERS</span></div><div className="name">Borders</div><p className="desc">1px hairlines · 3 weights.</p></a>
                <a className="cat-card" href="./elevation.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.ELEVATION</span></div><div className="name">Elevation</div><p className="desc">No shadow ladder. Bg-shift only.</p></a>
                <a className="cat-card" href="./focus.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.FOCUS</span></div><div className="name">Focus ring</div><p className="desc">2px accent on :focus-visible.</p></a>
                <a className="cat-card" href="./grid.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.GRID</span></div><div className="name">Grid</div><p className="desc">12-col + auto-fill tile grid.</p></a>
                <a className="cat-card" href="./iconography.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.ICONOGRAPHY</span></div><div className="name">Iconography</div><p className="desc">20+ Unicode glyphs + 4 SVG noun glyphs.</p></a>
                <a className="cat-card" href="./opacity.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.OPACITY</span></div><div className="name">Opacity</div><p className="desc">4 levels: default={true} / armed / disabled={true} / scrim.</p></a>
                <a className="cat-card" href="./radii.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.RADII</span></div><div className="name">Radii</div><p className="desc">Hard-edges. 0 / 2 / 4 only.</p></a>
                <a className="cat-card" href="./selection.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.SELECTION</span></div><div className="name">Selection</div><p className="desc">::selection in accent + file-tree row.</p></a>
              </div>
            </section>

            <section className="group">
              <h2 data-no="04">Components · universal</h2>
              <div className="cat-grid">
                <a className="cat-card" href="./components-buttons.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.BUTTONS</span></div><div className="name">Buttons</div><p className="desc">4 variants · 3 sizes · kbd hints.</p></a>
                <a className="cat-card" href="./components-cards.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.CARDS</span></div><div className="name">Cards &amp; tiles</div><p className="desc">Catalog SKU tiles + plain cards.</p></a>
                <a className="cat-card" href="./components-inputs.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.INPUTS</span></div><div className="name">Inputs</div><p className="desc">Field anatomy + states.</p></a>
                <a className="cat-card" href="./components-toggles.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.TOGGLES</span></div><div className="name">Toggles</div><p className="desc">Switch · check · radio · segmented.</p></a>
                <a className="cat-card" href="./components-dialogs.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.DIALOGS</span></div><div className="name">Dialogs</div><p className="desc">Modal + side drawer.</p></a>
                <a className="cat-card" href="./components-tooltips.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.TOOLTIPS</span></div><div className="name">Tooltips</div><p className="desc">Inverted chip, no blur.</p></a>
                <a className="cat-card" href="./components-tables.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.TABLES</span></div><div className="name">Tables</div><p className="desc">Plugin catalog row anatomy.</p></a>
                <a className="cat-card" href="./components-callout.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.CALLOUT</span></div><div className="name">Callouts</div><p className="desc">5 flavors · 4px left rule.</p></a>
                <a className="cat-card signature" href="./empty-state.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.EMPTY-STATE</span><span className="star">★</span></div><div className="name">Empty states</div><p className="desc">Voice "keep or kill" + 6 variants.</p></a>
                <a className="cat-card signature" href="./logo.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.LOGO</span><span className="star">★</span></div><div className="name">Wordmark + glyphs</div><p className="desc">Mark anatomy + 4 SVG domain glyphs.</p></a>
              </div>
            </section>

            <section className="group">
              <h2 data-no="05">Status family</h2>
              <div className="cat-grid">
                <a className="cat-card" href="./components-status.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.COMPONENTS-STATUS</span></div><div className="name">Status indicators</div><p className="desc">Pills · dots · inline state rows.</p></a>
                <a className="cat-card" href="./skeletons.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.SKELETONS</span></div><div className="name">Skeletons</div><p className="desc">Flat rectangles. No shimmer.</p></a>
              </div>
            </section>

            <section className="group">
              <h2 data-no="06">Audience · developer</h2>
              <div className="cat-grid">
                <a className="cat-card" href="./components-code-block.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.CODE-BLOCK</span></div><div className="name">Code block</div><p className="desc">Header + line-rail + syntax tints.</p></a>
                <a className="cat-card" href="./components-diff-view.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.DIFF-VIEW</span></div><div className="name">Diff view</div><p className="desc">Add/del gutters, color-mix tint.</p></a>
                <a className="cat-card" href="./components-log-stream.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.LOG-STREAM</span></div><div className="name">Log stream</div><p className="desc">timestamp · level · message · tags.</p></a>
                <a className="cat-card" href="./components-monospace-table.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.MONO-TABLE</span></div><div className="name">Mono table</div><p className="desc">Tabular-nums data grid.</p></a>
                <a className="cat-card" href="./components-terminal-pane.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.TERMINAL-PANE</span></div><div className="name">Terminal pane</div><p className="desc">Prompt + cursor (solid, not blinking).</p></a>
              </div>
            </section>

            <section className="group">
              <h2 data-no="07">Platform · desktop</h2>
              <div className="cat-grid">
                <a className="cat-card" href="./components-resize-panels.html"><div className="hd"><span className="sku-bit">MDCC-DSN/01.RESIZE-PANELS</span></div><div className="name">Resize panels</div><p className="desc">Tree + main split. Draggable gutter.</p></a>
              </div>
            </section>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· ui_kits-desktop-index · 36 specimens</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
