/**
 * @canvas      skeletons — loading placeholders in the unified panel material. A
 *              calm compositor-only shimmer (opacity/transform, bounded), the
 *              skeleton-vs-spinner choice, and reduced-motion safety via the
 *              token-level --dur-* collapse.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/skeletons — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./skeletons.css";

export default function Skeletons() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/skeletons</span>
        <span className="crumbs"><span>maude</span><span>status</span><span>skeletons</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Loading, calmly.</h1>
          <p className="lede">
            When the shape of the content is known — a layer tree, a property panel, an
            artboard thumbnail — draw its silhouette and let it breathe. A skeleton is a
            promise about what&apos;s coming. Use a spinner only when you genuinely
            don&apos;t know the dimensions yet. Both are quiet; the chrome must not
            out-shout the canvas, least of all while it waits.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Animates</dt><dd>opacity (compositor)</dd></div>
          <div><dt>Tempo</dt><dd>--dur-route · bounded</dd></div>
          <div><dt>Material</dt><dd>--bg-3 on panel</dd></div>
          <div><dt>Reduced-motion</dt><dd>holds at 0.7</dd></div>
        </dl>

        <h2 data-no>Layer tree skeleton <span className="h2-aside">predictable rows</span></h2>
        <p>
          The layers panel mid-load. The shimmer is a slow opacity pulse — never a moving
          highlight that drags the eye across the screen.
        </p>
        <aside className="panel sk-panel" aria-label="Layers — loading" aria-busy="true">
          <div className="panel-hd">Layers <span className="sk-dim">loading…</span></div>
          <div className="panel-bd sk-tree">
            {[64, 48, 72, 40, 56].map((w, i) => (
              <div className="sk-tree-row" key={i}>
                <span className="skel sk-glyph" />
                <span className="skel sk-line" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </aside>

        <h2 data-no>Inspector &amp; thumbnail <span className="h2-aside">the panel, pre-paint</span></h2>
        <p>
          Two more silhouettes in the same material: a property inspector and an artboard
          preview. The placeholder fields keep the inspector&apos;s exact grid so nothing
          jumps when real values land.
        </p>
        <div className="sk-duo">
          <aside className="panel sk-panel" aria-label="Inspector — loading" aria-busy="true">
            <div className="panel-hd">Properties</div>
            <div className="panel-bd sk-insp">
              {["X · Y", "Size", "Fill", "Radius"].map((label) => (
                <div className="insp-row" key={label}>
                  <span className="insp-label">{label}</span>
                  <span className="insp-fields">
                    <span className="skel sk-field" />
                    {label === "Fill" ? null : <span className="skel sk-field" />}
                  </span>
                </div>
              ))}
            </div>
          </aside>
          <figure className="panel sk-panel sk-thumb-card" aria-label="Artboard — loading" aria-busy="true">
            <div className="panel-hd">Artboard <span className="sk-dim mono">1440 × 900</span></div>
            <div className="panel-bd">
              <span className="skel sk-thumb" />
              <span className="skel sk-line" style={{ width: "52%", marginTop: "var(--space-3)" }} />
            </div>
          </figure>
        </div>

        <h2 data-no>Skeleton vs spinner <span className="h2-aside">known shape vs unknown</span></h2>
        <p>
          The rule of thumb: if you can draw the shape, draw it. The spinner is reserved
          for indeterminate work where the result has no predictable footprint — an export
          render, an upload, the agent thinking.
        </p>
        <div className="sk-vs">
          <figure className="sk-vs-card ok">
            <div className="sk-vs-body">
              <span className="skel sk-line" style={{ width: "70%", height: 12 }} />
              <span className="skel sk-line" style={{ width: "94%" }} />
              <span className="skel sk-line" style={{ width: "60%" }} />
              <span className="skel sk-btn" />
            </div>
            <figcaption>✓ skeleton — shape is known</figcaption>
          </figure>
          <figure className="sk-vs-card">
            <div className="sk-vs-body sk-vs-center">
              <span className="sk-spinner" role="status" aria-label="Rendering export" />
              <span className="sk-spinner-lbl">Rendering export…</span>
            </div>
            <figcaption>spinner — dimensions unknown</figcaption>
          </figure>
        </div>

        <div className="callout callout--info sk-note">
          <span className="mono sk-note-tag">a11y</span>
          <p style={{ margin: 0 }}>
            Both surfaces animate <code>opacity</code> only — compositor-cheap, no layout
            churn. Tempo is the <code>--dur-route</code> token, which collapses to 1ms under
            <code>prefers-reduced-motion: reduce</code>; the skeletons then hold at a steady
            0.7 and the spinner stops entirely. Bounded loops, never a runaway highlight.
          </p>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/skeletons</span>
          <span>opacity pulse · bounded · reduced-motion safe</span>
        </footer>
      </main>
    </>
  );
}
