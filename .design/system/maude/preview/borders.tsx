/**
 * @canvas      borders — the hairline-mono separation system. Three weights
 *              (--border-subtle / default / strong) plus the accent + error
 *              role borders. The thesis: on a dark cool-neutral surface,
 *              1px crisp hairlines carry separation — not heavy fills, not
 *              shadows. Demonstrates the ladder, the seam grid that frames a
 *              studio (panel · canvas · inspector with hairline gutters), and
 *              the input border states.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/borders — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./borders.css";

const WEIGHTS = [
  { tok: "--border-subtle", role: "ambient seam", use: "gutters between regions, panel dividers, footers", oklch: "0.29 0.012 255" },
  { tok: "--border-default", role: "standard outline", use: "panels, inputs, toolbars, the shared chrome material", oklch: "0.36 0.013 252" },
  { tok: "--border-strong", role: "emphasis", use: "hover surrounds, the elevated / pulled-forward edge", oklch: "0.45 0.014 250" },
];

const STATES = [
  { tok: "--accent", role: "primary / focus base", note: "the one CTA outline; never decoration" },
  { tok: "--status-error", role: "validation fail", note: "destructive confirm, invalid field" },
];

export default function Borders() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/borders</span>
        <span className="crumbs"><span>maude</span><span>foundation</span><span>borders</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Borders. Hairlines carry separation.</h1>
          <p className="lede">
            On a dark cool-neutral ladder, a heavy fill or a drop shadow shouts. A crisp 1px
            hairline does the same job and stays quiet — so the chrome never out-shouts the
            canvas. Three weights set the separation hierarchy; accent and error are the only
            colored borders, and each does exactly one job.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Strategy</dt><dd>hairline-mono · 1px</dd></div>
          <div><dt>Weights</dt><dd>subtle · default · strong</dd></div>
          <div><dt>Colored</dt><dd>accent · error (role only)</dd></div>
          <div><dt>Derivation</dt><dd>cool-neutral ladder hue ≈ 252</dd></div>
        </dl>

        <h2 data-no>The three weights <span className="h2-aside">subtle → default → strong</span></h2>
        <p>
          Each weight is one lightness step up the neutral ladder. The jump is small on purpose —
          enough to read the hierarchy, never enough to draw the eye away from the work.
        </p>
        <div className="bd-ladder">
          {WEIGHTS.map((w) => (
            <div className="bd-sample" key={w.tok} style={{ borderColor: `var(${w.tok})` }}>
              <div className="bd-sample-line" style={{ background: `var(${w.tok})` }} />
              <div className="bd-sample-meta">
                <strong>{w.role}</strong>
                <code className="bd-tok">{w.tok}</code>
                <span className="bd-oklch mono">{w.oklch}</span>
                <span className="bd-use">{w.use}</span>
              </div>
            </div>
          ))}
        </div>

        <h2 data-no>Seams, not fills <span className="h2-aside">how a studio is framed</span></h2>
        <p>
          The signature trick: lay panels on a 1px hairline backdrop and let the gutters show
          through. No region carries its own border — the seam between them <em>is</em> the
          border. One material, separated by light.
        </p>
        <div className="bd-studio" aria-label="Studio framed by hairline seams">
          <div className="bd-region bd-region--rail">
            <span className="bd-region-tag">layers</span>
            <div className="bd-stub" /><div className="bd-stub bd-stub--sel" /><div className="bd-stub" /><div className="bd-stub" />
          </div>
          <div className="bd-region bd-region--canvas">
            <span className="bd-region-tag bd-region-tag--ghost">canvas</span>
            <div className="bd-node">artboard</div>
          </div>
          <div className="bd-region bd-region--insp">
            <span className="bd-region-tag">properties</span>
            <div className="bd-field-row"><span className="mono">X</span><span className="bd-field">248</span></div>
            <div className="bd-field-row"><span className="mono">Y</span><span className="bd-field">96</span></div>
            <div className="bd-field-row"><span className="mono">W</span><span className="bd-field">168</span></div>
          </div>
        </div>
        <p className="bd-aside">
          Every visible line above is one <code>--border-subtle</code> seam — there are no per-panel
          borders. Compare with stacked drop-shadow cards: the seam version is calmer and reads as
          a single instrument.
        </p>

        <h2 data-no>Colored borders <span className="h2-aside">role, never decoration</span></h2>
        <p>
          Only two borders carry hue. Accent marks the single primary edge or the focus-ring base;
          error marks a fail. Reaching for a colored border anywhere else dilutes the signal.
        </p>
        <div className="bd-states">
          {STATES.map((s) => (
            <div className="bd-state" key={s.tok} style={{ borderColor: `var(${s.tok})` }}>
              <strong style={{ color: `var(${s.tok})` }}>{s.role}</strong>
              <code className="bd-tok">{s.tok}</code>
              <span className="bd-use">{s.note}</span>
            </div>
          ))}
        </div>

        <h2 data-no>In context <span className="h2-aside">input border states</span></h2>
        <p>
          The same ladder driving a real control. Rest and hover differ by one weight step; focus
          adds the accent ring; error swaps the hue. The fill never changes — the border does.
        </p>
        <div className="bd-inputs">
          <label className="bd-input-wrap">
            <span className="bd-input-label mono">rest</span>
            <input className="input" defaultValue="Untitled frame" />
          </label>
          <label className="bd-input-wrap">
            <span className="bd-input-label mono">hover</span>
            <input className="input bd-input--hover" defaultValue="Untitled frame" />
          </label>
          <label className="bd-input-wrap">
            <span className="bd-input-label mono">focus</span>
            <input className="input bd-input--focus" defaultValue="Untitled frame" />
          </label>
          <label className="bd-input-wrap">
            <span className="bd-input-label mono">error</span>
            <input className="input bd-input--error" defaultValue="name taken" aria-invalid="true" />
          </label>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/borders</span>
          <span>hairline-mono · 1px · separation by light, not fill</span>
        </footer>
      </main>
    </>
  );
}
