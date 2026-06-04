/**
 * @canvas      components-dialogs — modal · confirm · side panel, all in the ONE
 *              panel material over a scrim of oklch(0 0 0 / .6). A modal interrupts
 *              for input; a confirm gates a consequential action ("Hand off to
 *              production?"); a side panel slides in node properties without taking
 *              the whole screen. Each reveals via .motion-route — bounded, compositor
 *              only, reduced-motion-safe. The confirm carries a focus-trap diagram.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/components-dialogs — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN (from template): modal / sheet / alert — each with title, body, primary
 * + secondary actions. Modal blocks the page; sheet slides from an edge; the
 * confirm/alert gates an irreversible action. Always pair primary with a clear cancel.
 * Title asks the consequential question; body explains the outcome; confirm is a verb.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-dialogs.css";

export default function ComponentsDialogs() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-dialogs</span>
        <span className="crumbs"><span>maude</span><span>component</span><span>dialogs</span></span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Dialogs. Interrupt only when it matters.</h1>
          <p className="lede">
            A modal interrupts the canvas for input you can't proceed without. A confirm
            gates a consequential, hard-to-undo action. A side panel slides in node
            properties without stealing the whole surface. All three are the same panel
            material over a scrim, and all three reveal with <code>.motion-route</code> —
            bounded, transform-and-opacity only.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Material</dt><dd>panel · shadow-lg</dd></div>
          <div><dt>Scrim</dt><dd>oklch(0 0 0 / .6)</dd></div>
          <div><dt>Reveal</dt><dd>route · 280ms · scale+fade</dd></div>
          <div><dt>Focus</dt><dd>trapped · Esc closes</dd></div>
        </dl>

        {/* ── Modal — input you can't skip ── */}
        <h2 data-no>Modal <span className="h2-aside">blocks the canvas for input</span></h2>
        <p>Centered over a scrim. The canvas keeps dotting through the veil so you never lose your place; the dialog earns full focus.</p>
        <div className="dlg-stage" aria-hidden="true">
          <div className="dlg-scrim" />
          <div className="panel dlg dlg--modal motion-route" role="dialog" aria-modal="true" aria-labelledby="m-title">
            <div className="panel-hd"><span>New canvas</span><button className="dlg-x" aria-label="Close" tabIndex={-1}><XGlyph /></button></div>
            <div className="panel-bd">
              <h3 className="dlg-title" id="m-title">Name this canvas</h3>
              <p className="dlg-body">It lands in the project tree. You can rename it from the layers panel later.</p>
              <label className="dlg-field-label" htmlFor="m-name">Canvas name</label>
              <input id="m-name" className="input" defaultValue="Scout Radar · v3" tabIndex={-1} />
              <div className="dlg-actions">
                <button className="btn" tabIndex={-1}>Cancel</button>
                <button className="btn btn--primary" tabIndex={-1}>Create canvas</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Confirm — the consequential gate, with a focus-trap diagram ── */}
        <h2 data-no>Confirm <span className="h2-aside">consequential · focus-trapped</span></h2>
        <p>
          The title asks the question, the body states the outcome, the confirm is a verb.
          Tab is trapped between the two actions and Esc cancels — diagrammed below in mono.
        </p>
        <div className="dlg-stage dlg-stage--tall" aria-hidden="true">
          <div className="dlg-scrim" />
          <div className="panel dlg dlg--confirm motion-route" role="alertdialog" aria-labelledby="c-title" aria-describedby="c-body">
            <div className="panel-bd">
              <span className="dlg-glyph dlg-glyph--warn"><HandoffGlyph /></span>
              <h3 className="dlg-title" id="c-title">Hand off to production?</h3>
              <p className="dlg-body" id="c-body">
                This freezes the canvas and emits a production-ready registry item. The agent
                stops iterating on it. You can fork a new draft, but this snapshot is final.
              </p>
              <div className="dlg-actions">
                <button className="btn" data-trap="1">Keep iterating</button>
                <button className="btn btn--primary" data-trap="2">Hand off</button>
              </div>
            </div>

            {/* focus-trap annotation — the tab cycle, drawn in mono */}
            <ol className="dlg-trap" aria-hidden="true">
              <li><span className="kbd">Tab</span> cycles 1 → 2 → 1, never escapes</li>
              <li><span className="kbd">Esc</span> = Keep iterating (the safe default)</li>
              <li><span className="kbd">↵</span> fires the focused action only</li>
            </ol>
          </div>
        </div>

        {/* ── Side panel — properties without stealing the surface ── */}
        <h2 data-no>Side panel <span className="h2-aside">slides from the edge · keeps the canvas</span></h2>
        <p>For node properties and inspectors that ride alongside the work. A lighter scrim — you can still see the canvas it belongs to.</p>
        <div className="dlg-stage dlg-stage--sheet" aria-hidden="true">
          <div className="dlg-scrim dlg-scrim--soft" />
          <div className="dlg-canvas-peek mono">x 248 · y 96 · selected</div>
          <aside className="panel dlg dlg--sheet motion-route" role="dialog" aria-labelledby="s-title">
            <div className="panel-hd"><span>Properties</span><button className="dlg-x" aria-label="Close panel" tabIndex={-1}><XGlyph /></button></div>
            <div className="panel-bd dlg-sheet-bd">
              <h3 className="dlg-title" id="s-title">Card · Pricing</h3>
              <div className="insp-row"><span className="insp-label">X</span><span className="insp-fields"><span className="field">248</span><span className="field">96</span></span></div>
              <div className="insp-row"><span className="insp-label">Size</span><span className="insp-fields"><span className="field">168</span><span className="field">116</span></span></div>
              <div className="insp-row"><span className="insp-label">Radius</span><span className="insp-fields"><span className="field">7</span></span></div>
              <div className="insp-row"><span className="insp-label">Fill</span><span className="tag tag--accent">accent</span></div>
              <div className="dlg-actions dlg-actions--start">
                <button className="btn btn--ghost btn--sm" tabIndex={-1}>Reset</button>
                <button className="btn btn--primary btn--sm" tabIndex={-1}>Apply</button>
              </div>
            </div>
          </aside>
        </div>

        <div className="callout callout--warn dlg-legend">
          <span className="mono">!</span>
          <p style={{ margin: 0 }}>
            Title asks the consequential question — <em>"Hand off to production?"</em>, not
            <em> "Confirm hand off"</em>. Body explains the outcome, not the question. The
            confirm button is the verb — <em>"Hand off"</em>, never <em>"OK"</em>. Pair every
            primary with a clear cancel, and make Esc the safe path.
          </p>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-dialogs</span>
          <span>modal · confirm · side panel · scrim oklch(0 0 0 / .6)</span>
        </footer>
      </main>
    </>
  );
}

/* ── 1px-stroke geometric glyphs (no emoji — IDE heritage) ── */
function XGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" />
    </svg>
  );
}
function HandoffGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <rect x="2.5" y="3.5" width="7" height="7" rx="1.5" />
      <path d="M9 7 L15 7 M12.5 4.5 L15 7 L12.5 9.5" />
      <path d="M2.5 13.5 L15.5 13.5" strokeDasharray="1 2" />
    </svg>
  );
}
