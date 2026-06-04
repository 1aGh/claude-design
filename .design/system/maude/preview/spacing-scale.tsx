/**
 * @canvas      spacing-scale — the --space-0..8 dense 4px ladder: visual bars to
 *              scale, the role each step plays in a dense pro-tool, and one live
 *              inspector row composed entirely from the ladder.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/spacing-scale — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./spacing-scale.css";

/* The ladder. `px` is the resolved value (layout dimensions may be literal px —
 * see README hard rules); `role` is where it lands in dense studio chrome. */
const SCALE = [
  { tok: "0", px: 0, role: "reset · flush hairline seams" },
  { tok: "1", px: 2, role: "icon-to-icon · presence dots" },
  { tok: "2", px: 4, role: "field gaps · chip padding" },
  { tok: "3", px: 8, role: "control padding · tree-row inset" },
  { tok: "4", px: 12, role: "panel body · stack gap (default)" },
  { tok: "5", px: 16, role: "section gap · gutter" },
  { tok: "6", px: 24, role: "between sections · specimen pad" },
  { tok: "7", px: 32, role: "title block · page rhythm" },
  { tok: "8", px: 48, role: "hero · empty-state breathing room" },
] as const;

export default function SpacingScale() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/spacing-scale</span>
        <span className="crumbs"><span>maude</span><span>space</span><span>scale</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Spacing. Four-pixel grid.</h1>
          <p className="lede">
            Nine steps on a strict <strong>4px</strong> base, tight at the bottom and
            non-linear up top so section gutters stay legible. Dense by design — pro chrome
            packs more in, so the small steps (<code>--space-2/3</code>) do the most work.
            Inline gaps stay small; only sections earn the big ones.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Base</dt><dd>4px</dd></div>
          <div><dt>Steps</dt><dd>0 → 8 (nine)</dd></div>
          <div><dt>Density</dt><dd>dense</dd></div>
          <div><dt>Top end</dt><dd>24 · 32 · 48</dd></div>
        </dl>

        <h2 data-no>The ladder <span className="h2-aside">bar to scale · resolved px · role</span></h2>
        <p>
          Each bar is exactly its token wide — read the mono column for the resolved
          pixel value and where the step belongs in the chrome.
        </p>
        <div className="sp-ladder">
          {SCALE.map((s) => (
            <div className="sp-step" key={s.tok}>
              <span className="sp-tok">--space-{s.tok}</span>
              <span className="sp-bar-wrap">
                <span className="sp-bar" style={{ width: `var(--space-${s.tok})` }} />
              </span>
              <span className="sp-px">{s.px}px</span>
              <span className="sp-role">{s.role}</span>
            </div>
          ))}
        </div>

        <h2 data-no>Inline density <span className="h2-aside">--space-2 / --space-3 carry the chrome</span></h2>
        <p>
          Inside a row, gaps stay at <code>--space-2</code> or <code>--space-3</code> —
          enough air to separate, never enough to scatter. Watch the same toolbar at three
          steps: <code>--space-2</code> reads as one instrument; <code>--space-5</code>
          breaks it into loose parts.
        </p>
        <div className="sp-density">
          {(["2", "3", "5"] as const).map((g) => (
            <div className="sp-density-row" key={g}>
              <span className="sp-density-tag">gap --space-{g}</span>
              <div className="toolbar" style={{ gap: `var(--space-${g})` }}>
                <span className="toolbar-group" style={{ gap: `var(--space-${g})` }}>
                  <button className="btn btn--icon" aria-label="Move">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 1v12M1 7h12M7 1 4.5 3.5M7 1l2.5 2.5M7 13l-2.5-2.5M7 13l2.5-2.5M1 7l2.5-2.5M1 7l2.5 2.5M13 7l-2.5-2.5M13 7l-2.5 2.5" />
                    </svg>
                  </button>
                  <button className="btn btn--icon" aria-label="Frame">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
                      <path d="M3.5 1v12M10.5 1v12M1 3.5h12M1 10.5h12" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
                <span className="toolbar-sep" />
                <span className="chip">3 selected</span>
              </div>
            </div>
          ))}
        </div>

        <h2 data-no>In the inspector <span className="h2-aside">a panel built only from the ladder</span></h2>
        <p>
          A real property panel: body padding <code>--space-4</code>, row stacking
          <code>--space-3</code>, field gaps <code>--space-2</code>. No literal pixels —
          every gap is a rung on the ladder, which is why the whole chrome shares one rhythm.
        </p>
        <aside className="panel sp-insp" aria-label="Inspector — spacing demo">
          <div className="panel-hd">Properties <span className="sp-insp-sku">Card · Pricing</span></div>
          <div className="panel-bd">
            <div className="insp-row">
              <span className="insp-label">X · Y</span>
              <span className="insp-fields"><span className="field">248</span><span className="field">96</span></span>
            </div>
            <div className="insp-row">
              <span className="insp-label">Size</span>
              <span className="insp-fields"><span className="field">168</span><span className="field">116</span></span>
            </div>
            <div className="insp-row">
              <span className="insp-label">Radius</span>
              <span className="insp-fields"><span className="field">7</span></span>
            </div>
            <div className="divider" style={{ margin: "var(--space-4) 0" }} />
            <button className="btn btn--primary" style={{ width: "100%" }}>Apply</button>
          </div>
        </aside>

        <footer className="specimen-ft">
          <span>MAUDE/spacing-scale</span>
          <span>4px base · dense · 0 → 48</span>
        </footer>
      </main>
    </>
  );
}
