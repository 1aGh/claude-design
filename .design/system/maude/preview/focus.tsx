/**
 * @canvas      focus — the maude focus ring: one shape everywhere, a 2px
 *              accent outline plus a soft accent-tint halo, applied via
 *              :focus-visible only. Live keyboard reachability across .btn /
 *              .input / .seg / .tree-row, a "why outline not inset box-shadow"
 *              teardown, and a contrast block that labels the ring sample on
 *              every --bg-* level with token names + OKLCH (no fabricated ratios).
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/focus — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN: foundations-focus
 * DEMONSTRATES: --accent as the focus ring, outline + outline-offset + accent-tint
 *               halo, :focus-visible vs :focus.
 * NOTES: Ring is `outline: 2px solid var(--accent); outline-offset: 2px` + an
 *        accent-tint box-shadow halo — NOT a bare inset box-shadow (which masks
 *        the border and clips under overflow:hidden). :focus-visible only so a
 *        mouse click never paints a ring. Contrast claims are NOT asserted — the
 *        block labels token pairs + OKLCH, it does not state a computed ratio.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./focus.css";

/* The accent ring is drawn on every surface level so a keyboard user can locate
 * focus no matter how deep the chrome nests. Token names + OKLCH only — the
 * computed contrast ratio is intentionally NOT asserted here (it must be measured
 * on theme switch, not hardcoded). */
const SURFACES = [
  { tok: "--bg-0", oklch: "0.165 .012 255", role: "canvas" },
  { tok: "--bg-1", oklch: "0.198 .012 255", role: "panel" },
  { tok: "--bg-2", oklch: "0.232 .013 255", role: "inspector" },
  { tok: "--bg-3", oklch: "0.270 .013 252", role: "input" },
  { tok: "--bg-4", oklch: "0.310 .014 252", role: "pressed" },
] as const;

export default function Focus() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/focus</span>
        <span className="crumbs"><span>maude</span><span>focus</span><span>keyboard reach</span></span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Focus. One ring, every control.</h1>
          <p className="lede">
            The ring is a single shape across the whole studio: a{" "}
            <code>2px</code> accent <code>outline</code> at <code>2px</code> offset, wrapped
            in a soft <code>--accent-tint</code> halo so it reads against any surface level.
            Applied via <code>:focus-visible</code> only — a mouse click never paints a ring,
            a <kbd className="kbd">Tab</kbd> always does. Reach for it on every focusable: the
            toolbar, the inspector field, the segmented tool, the layer row.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Ring</dt><dd>2px outline + tint halo</dd></div>
          <div><dt>Offset</dt><dd>2px (outset)</dd></div>
          <div><dt>Trigger</dt><dd>:focus-visible only</dd></div>
          <div><dt>Color</dt><dd>--accent · indigo</dd></div>
        </dl>

        <h2 data-no>The ring <span className="h2-aside">named — shown always-on so you see it without tabbing</span></h2>
        <p>
          One anatomy. The outline draws the hard 2px edge outside the layout box; the tint halo
          softens it onto the dark ground. The offset keeps the ring from touching the control's
          own border so the accent never muddies against the hairline.
        </p>
        <div className="fo-anatomy">
          <div className="fo-spec">
            <span className="fo-spec__cap">outline · the hard edge</span>
            <span className="fo-chip" style={{ boxShadow: "none" }} />
            <code>outline: 2px solid var(--accent)</code>
          </div>
          <div className="fo-spec">
            <span className="fo-spec__cap">+ tint halo · the soft read</span>
            <span className="fo-chip" />
            <code>+ 0 0 0 5px var(--accent-tint)</code>
          </div>
          <div className="fo-spec">
            <span className="fo-spec__cap">offset · clears the border</span>
            <span className="fo-chip" style={{ outlineOffset: "2px", boxShadow: "none" }} />
            <code>outline-offset: 2px</code>
          </div>
        </div>

        <h2 data-no>Reachability <span className="h2-aside">Tab through real chrome — every stop rings</span></h2>
        <p>
          Press <kbd className="kbd">Tab</kbd> and walk the chrome. Buttons, inputs, the
          segmented tool and the layer tree all answer with the same ring — the keyboard path
          covers every interactive surface, with no dead stops and no silent focus.
        </p>
        <div className="fo-bench">
          <div className="fo-line">
            <span className="fo-line__lbl">.btn</span>
            <button className="btn btn--primary">Hand off</button>
            <button className="btn">Duplicate</button>
            <button className="btn btn--ghost">Rename</button>
            <button className="btn btn--icon" aria-label="More options">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" /><circle cx="11" cy="7" r="1.2" />
              </svg>
            </button>
          </div>

          <div className="fo-line">
            <span className="fo-line__lbl">.input</span>
            <input className="input" type="text" placeholder="Rename frame…" style={{ maxWidth: 220 }} />
            <span className="insp-fields">
              <input className="field" defaultValue="248" aria-label="X" />
              <input className="field" defaultValue="96" aria-label="Y" />
            </span>
          </div>

          <div className="fo-line">
            <span className="fo-line__lbl">.seg</span>
            <span className="seg" role="group" aria-label="Tool">
              <button aria-pressed={true}>move</button>
              <button aria-pressed={false}>frame</button>
              <button aria-pressed={false}>pen</button>
            </span>
            <input className="switch" type="checkbox" role="switch" aria-label="Snap to grid" defaultChecked />
          </div>

          <div className="fo-line" style={{ alignItems: "flex-start" }}>
            <span className="fo-line__lbl">.tree-row</span>
            <div className="fo-tree" role="tree" aria-label="Layers">
              <div className="tree-row" role="treeitem" tabIndex={0}>Frame · Hero</div>
              <div className="tree-row" role="treeitem" tabIndex={0} aria-selected="true">Card · Pricing</div>
              <div className="tree-row" role="treeitem" tabIndex={0}>Text · Headline</div>
              <div className="tree-row" role="treeitem" tabIndex={0}>Group · Footer</div>
            </div>
          </div>

          <span className="fo-hint">
            <kbd className="kbd">Tab</kbd> next · <kbd className="kbd">⇧ Tab</kbd> back · ring shows only on keyboard focus
          </span>
        </div>

        <h2 data-no>Outline, not inset shadow <span className="h2-aside">why the ring lives outside the box</span></h2>
        <p>
          An outline sits outside the layout box, so it never shifts adjacent chrome and never
          gets clipped by a parent <code>overflow: hidden</code> — and the studio clips a lot
          of surfaces. An inset box-shadow masks the control's own border and is eaten the moment
          it sits inside a rounded, clipped panel.
        </p>
        <div className="fo-vs">
          <figure className="ok">
            <div className="demo"><span className="fo-chip" /></div>
            <figcaption>✓ outline + halo — outside the box, never clips</figcaption>
          </figure>
          <figure className="no">
            <div className="demo"><span className="fo-clip" /></div>
            <figcaption>✕ inset shadow — masks the border, clips on overflow</figcaption>
          </figure>
        </div>

        <h2 data-no>Across surfaces <span className="h2-aside">the ring on every --bg level · token names, not ratios</span></h2>
        <p>
          The accent ring must stay locatable on every surface a control can sit on, from the
          deep canvas to a pressed control. Each tile draws the ring on one level and labels the
          pair with its token and OKLCH. The actual contrast must be <em>measured</em> on theme
          switch — it is deliberately not asserted as a number here.
        </p>
        <div className="fo-contrast">
          {SURFACES.map((s) => (
            <div className="fo-pair" key={s.tok}>
              <div className="fo-pair__on" style={{ background: `var(${s.tok})` }} />
              <div className="fo-pair__meta">
                <strong>{s.tok}</strong>
                <span>{s.oklch}</span>
                <span style={{ color: "var(--fg-2)" }}>{s.role}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="callout callout--info">
          <p style={{ margin: 0 }}>
            Verify on theme switch: the accent outline against every adjacent <code>--bg-*</code>{" "}
            level. The ring is a non-text UI indicator, so it is measured against WCAG's 3:1
            non-text-contrast minimum with a contrast tool — never eyeballed, never hardcoded.
          </p>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/focus</span>
          <span>2px outline · tint halo · :focus-visible</span>
        </footer>
      </main>
    </>
  );
}
