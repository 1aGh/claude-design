/**
 * @canvas      radii — the maude corner ladder: --radius-xs..pill, a MILD
 *              ladder where corners soften just enough to read as deliberate,
 *              never enough to go pill-heavy. Shown on the shared panel material,
 *              on buttons and tabular fields, a concentric-nesting proof, and a
 *              pill-discipline rule (the one fully-round corner, reserved).
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/radii — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN: foundations-radii
 * DEMONSTRATES: --radius-xs/sm/md/lg/xl/pill applied to the real chrome anatomy.
 * NOTES: Crisp, not pill-heavy — sm carries buttons/fields, md the panels, lg/xl
 *        the few floating surfaces. Pill is for dots and counts, never controls.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./radii.css";

/* The ladder. `px` is the resolved token value; `role` names where each rung
 * lands in dense studio chrome. Mild on purpose — the IDE/terminal heritage. */
const LADDER = [
  { tok: "xs",   px: "3px",   role: "fields · kbd · selection handles · readout" },
  { tok: "sm",   px: "5px",   role: "buttons · inputs · segmented · the workhorse" },
  { tok: "md",   px: "7px",   role: "panels · cards · toolbar · the shared material" },
  { tok: "lg",   px: "10px",  role: "the studio frame · grouped regions" },
  { tok: "xl",   px: "14px",  role: "dialogs · sheets · the rare floating surface" },
  { tok: "pill", px: "999px", role: "presence dots · chips · counts — never a control" },
] as const;

export default function Radii() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/radii</span>
        <span className="crumbs"><span>maude</span><span>radius</span><span>mild ladder</span></span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Radii. Mild on purpose.</h1>
          <p className="lede">
            Six rungs that soften the corner just enough to read as <em>made</em>, never
            enough to go round. A pro tool with terminal and IDE heritage keeps its edges
            crisp — <code>--radius-sm</code> carries every button and field, <code>--radius-md</code>{" "}
            is the one shared panel material, and the only fully-round corner is reserved for
            a presence dot. Stick to the ladder: every off-token corner is noise.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Steps</dt><dd>6 (xs → pill)</dd></div>
          <div><dt>Range</dt><dd>3px → 14px + 999</dd></div>
          <div><dt>Workhorse</dt><dd>sm · md</dd></div>
          <div><dt>Personality</dt><dd>mild · crisp</dd></div>
        </dl>

        <h2 data-no>The ladder <span className="h2-aside">panel material · resolved px · role</span></h2>
        <p>
          Each tile applies the rung to a square of the panel material. Read the corners
          left to right and watch them relax — and stop. The jump from <code>xl</code> to{" "}
          <code>pill</code> is deliberate: there is no rung between "soft surface" and "fully round".
        </p>
        <div className="rad-ladder">
          {LADDER.map((s) => (
            <div className="rad-step" key={s.tok}>
              <div
                className="rad-corner"
                style={{ borderRadius: `var(--radius-${s.tok})`, ...(s.tok === "pill" ? { height: 64, width: 64, margin: "var(--space-4) auto 0" } : null) }}
              />
              <div className="rad-meta">
                <span className="rad-tok">--radius-{s.tok}</span>
                <span className="rad-px">{s.px}</span>
                <span className="rad-role">{s.role}</span>
              </div>
            </div>
          ))}
        </div>

        <h2 data-no>On the material <span className="h2-aside">the same radius, the real anatomy</span></h2>
        <p>
          The radius is not abstract — it is the curve you feel on every control. Here it is
          on the chrome that uses it: the segmented tool, a tabular inspector field, the primary
          action, and a panel header.
        </p>
        <div className="rad-anatomy">
          <div className="rad-demo">
            <span className="rad-demo__cap">controls <span>--radius-sm</span></span>
            <div className="row" style={{ margin: 0 }}>
              <button className="btn btn--primary btn--sm">Hand off</button>
              <button className="btn btn--sm">Duplicate</button>
              <span className="seg" role="group" aria-label="Tool">
                <button aria-pressed={true}>move</button>
                <button aria-pressed={false}>frame</button>
              </span>
            </div>
          </div>

          <div className="rad-demo">
            <span className="rad-demo__cap">fields <span>--radius-xs</span></span>
            <div className="insp-row">
              <span className="insp-label">X · Y</span>
              <span className="insp-fields"><span className="field">248</span><span className="field">96</span></span>
            </div>
            <div className="insp-row">
              <span className="insp-label">Size</span>
              <span className="insp-fields"><span className="field">168</span><span className="field">116</span></span>
            </div>
          </div>

          <div className="rad-demo">
            <span className="rad-demo__cap">panel <span>--radius-md</span></span>
            <div className="panel" style={{ boxShadow: "none" }}>
              <div className="panel-hd">Properties</div>
              <div className="panel-bd" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--type-xs)", color: "var(--fg-2)" }}>
                Card · Pricing
              </div>
            </div>
          </div>

          <div className="rad-demo">
            <span className="rad-demo__cap">nesting <span>lg ⊃ sm</span></span>
            <div className="rad-nest">
              <div className="rad-nest__inner">outer lg · inner sm</div>
            </div>
            <span style={{ fontSize: "var(--type-xs)", color: "var(--fg-2)", lineHeight: "var(--lh-xs)" }}>
              The outer radius runs ahead of the inner by its padding so the corners stay concentric — never an inner rounder than its frame.
            </span>
          </div>
        </div>

        <h2 data-no>Pill discipline <span className="h2-aside">where fully-round is earned — and where it is wrong</span></h2>
        <p>
          <code>--radius-pill</code> is the one fully-round corner in the system, and it has
          exactly two jobs: presence dots and small counts. The instant a button or a panel
          goes pill, the chrome stops reading as a precise instrument.
        </p>
        <div className="rad-pill-row">
          <span className="presence-dot presence-dot--agent" title="agent" />
          <span className="chip">3 selected</span>
          <span className="tag tag--accent">draft</span>
          <span className="chip"><span className="presence-dot presence-dot--online" /> 2 here</span>
        </div>
        <p className="rad-square-note">
          ✕ pill on a <span className="mono">.btn</span> or a <span className="mono">.panel</span> — a Pro Tool keeps its corners mild.
        </p>

        <footer className="specimen-ft">
          <span>MAUDE/radii</span>
          <span>mild · 3px → 14px · pill reserved</span>
        </footer>
      </main>
    </>
  );
}
