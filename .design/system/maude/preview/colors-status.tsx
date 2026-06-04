/**
 * @canvas      colors-status — the four status semantics, kept calm.
 *              Demonstrates --status-success / --status-warn / --status-error /
 *              --status-info: the family separate from the accent, shown as
 *              swatches and in real chrome usage (callouts, inline tags, a
 *              build-state strip, an inspector validity row). Calm, not loud —
 *              status reports an outcome, it doesn't decorate.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/colors-status — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN: status-colors
 * DEMONSTRATES: --status-success, --status-warn, --status-error, --status-info
 * NOTES: Status is SEPARATE from accent — accent says "do this", status says
 * "this happened". In a calm pro tool status is mostly hairline + tint, with a
 * solid fill reserved for the one thing that genuinely needs to interrupt.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./colors-status.css";

const STATUS = [
  { key: "success", tok: "--status-success", word: "synced", use: "saved · synced · live", oklch: "0.760 0.150 162" },
  { key: "warn", tok: "--status-warn", word: "deferred", use: "due soon · stale · review", oklch: "0.800 0.130 78" },
  { key: "error", tok: "--status-error", word: "failed", use: "failed · blocked · conflict", oklch: "0.660 0.190 25" },
  { key: "info", tok: "--status-info", word: "note", use: "heads-up · changelog · tip", oklch: "0.720 0.120 238" },
];

export default function ColorsStatus() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/colors-status</span>
        <span className="crumbs"><span>maude</span><span>color</span><span>status</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Status. Outcomes, said quietly.</h1>
          <p className="lede">
            Four semantics — success, warn, error, info — and they are <em>not</em> the accent.
            The accent says "do this"; status says "this happened". In a tool you live in all
            day, status earns its volume: mostly a hairline and a tint, with a solid fill held
            back for the one thing that has to interrupt. Loud-everywhere status is just noise
            you learn to ignore.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Family</dt><dd>4 (separate from accent)</dd></div>
          <div><dt>Hues</dt><dd>162 · 78 · 25 · 238</dd></div>
          <div><dt>Default form</dt><dd>hairline + tint</dd></div>
          <div><dt>Solid fill</dt><dd>interrupt only</dd></div>
        </dl>

        <h2 data-no>The family <span className="h2-aside">four semantics, two forms each</span></h2>
        <p>
          Each semantic shown three ways: the raw hue, the calm form (tint + hairline) that's
          the default in chrome, and the solid form reserved for the badge that must be seen.
          Read across a row to see how loud each one is allowed to get.
        </p>
        <div className="st-grid">
          {STATUS.map((s) => (
            <div className={`st-card st-${s.key}`} key={s.tok}>
              <div className="st-hue" style={{ background: `var(${s.tok})` }} />
              <div className="st-body">
                <strong className="mono">{s.tok}</strong>
                <span className="mono oklch">{s.oklch}</span>
                <span className="st-use">{s.use}</span>
                <div className="st-forms">
                  <span className="st-pill st-pill--calm">{s.word}</span>
                  <span className="st-pill st-pill--solid">{s.word}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <h2 data-no>In context <span className="h2-aside">the build strip</span></h2>
        <p>
          Where status actually shows up: a hand-off pipeline strip. Each step reports its own
          outcome with a left-edge hairline and a tint — calm enough to scan, clear enough to
          act on. Only the failed step earns a solid badge, because that's the one you have to
          stop for.
        </p>
        <div className="panel st-pipe">
          <div className="panel-hd"><span>Hand off · pipeline</span><span className="mono">4 steps</span></div>
          <div className="panel-bd st-pipe-bd">
            <div className="st-step callout callout--success">
              <span className="st-step-dot" style={{ background: "var(--status-success)" }} />
              <span className="st-step-label">Tokens resolved</span>
              <span className="st-step-meta mono">synced · 0.4s</span>
            </div>
            <div className="st-step callout callout--info">
              <span className="st-step-dot" style={{ background: "var(--status-info)" }} />
              <span className="st-step-label">Snapshot of canvas captured</span>
              <span className="st-step-meta mono">note · 1 frame</span>
            </div>
            <div className="st-step callout callout--warn">
              <span className="st-step-dot" style={{ background: "var(--status-warn)" }} />
              <span className="st-step-label">2 nodes off the spacing ladder</span>
              <span className="st-step-meta mono">review</span>
            </div>
            <div className="st-step callout callout--error">
              <span className="st-step-dot" style={{ background: "var(--status-error)" }} />
              <span className="st-step-label">Inspector export blocked</span>
              <span className="st-pill st-pill--solid st-step-badge">failed</span>
            </div>
          </div>
        </div>

        <h2 data-no>Inline tags <span className="h2-aside">low-noise, in dense rows</span></h2>
        <p>
          Inside a dense layer tree or properties table, status drops to the lowest-noise form:
          a hairline outline, no fill. It tints the row's meaning without pulling the eye off
          the work.
        </p>
        <div className="st-tags">
          <span className="st-tag" data-st="success">passed</span>
          <span className="st-tag" data-st="warn">pending</span>
          <span className="st-tag" data-st="error">conflict</span>
          <span className="st-tag" data-st="info">draft</span>
        </div>

        <div className="callout callout--warn st-guard">
          <span className="mono">guardrail</span>
          <span>
            Success is never the accent and the accent is never success. If "saved" turns
            indigo, the eye can no longer tell a primary action from a settled outcome — the
            two signals collapse into one. Keep the families apart.
          </span>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/colors-status</span>
          <span>status · success · warn · error · info</span>
        </footer>
      </main>
    </>
  );
}
