/**
 * @canvas      components-status — status badges, pills, dots, and presence, plus a
 *              build/handoff pipeline strip where only the active (or failed) step
 *              earns a solid badge — the rest stay quiet. Uses --status-* + presence.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/components-status — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import type { ReactNode } from "react";
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-status.css";

type Tone = "success" | "warn" | "error" | "info";

const PILLS: { tone: Tone; label: string }[] = [
  { tone: "success", label: "Synced" },
  { tone: "warn",    label: "Pending" },
  { tone: "error",   label: "Failed" },
  { tone: "info",    label: "Draft" },
];

const PRESENCE = [
  { mod: "online",  label: "Mara editing" },
  { mod: "away",    label: "Theo idle 4m" },
  { mod: "offline", label: "Jun offline" },
  { mod: "agent",   label: "agent drafting" },
];

// Handoff pipeline — exactly one step is "active"; one failed earlier.
type Step = { name: string; state: "done" | "active" | "failed" | "todo" };
const PIPELINE: Step[] = [
  { name: "Snapshot",    state: "done" },
  { name: "Grid check",  state: "done" },
  { name: "Token audit", state: "active" },
  { name: "Export",      state: "todo" },
  { name: "Hand off",    state: "todo" },
];
// A second strip showing the failed path.
const PIPELINE_FAIL: Step[] = [
  { name: "Snapshot",    state: "done" },
  { name: "Grid check",  state: "failed" },
  { name: "Token audit", state: "todo" },
  { name: "Export",      state: "todo" },
  { name: "Hand off",    state: "todo" },
];

const STEP_GLYPH: Record<Step["state"], ReactNode> = {
  done:   <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2.5 6.3 2.3 2.3 4.7-5.2" /></svg>,
  active: <span className="presence-dot presence-dot--agent st-pulse" aria-hidden="true" />,
  failed: <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3.5 3.5 5 5" /><path d="m8.5 3.5-5 5" /></svg>,
  todo:   <span className="st-todo-dot" aria-hidden="true" />,
};

function Pipeline({ steps, caption }: { steps: Step[]; caption: string }) {
  return (
    <div className="panel st-pipe-panel">
      <div className="panel-hd">{caption}</div>
      <ol className="st-pipe">
        {steps.map((s, i) => (
          <li className={`st-step st-step--${s.state}`} key={s.name}>
            <span className="st-step-badge" aria-hidden="true">{STEP_GLYPH[s.state]}</span>
            <span className="st-step-name">{s.name}</span>
            {i < steps.length - 1 && <span className="st-conn" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function ComponentsStatus() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-status</span>
        <span className="crumbs"><span>maude</span><span>component</span><span>status</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Status. What state is this in.</h1>
          <p className="lede">
            Badges answer "what's happening now"; the pipeline answers "where is this
            in the run". Both draw from the <code>--status-*</code> palette, never the
            accent — the accent is for what you can <em>act</em> on, status is for what
            simply <em>is</em>. Only the live step earns a solid badge; the rest stay quiet.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Palette</dt><dd>--status-* · presence</dd></div>
          <div><dt>Solid</dt><dd>active / failed only</dd></div>
          <div><dt>Quiet</dt><dd>outline · done-tick</dd></div>
          <div><dt>Accent</dt><dd>never (action only)</dd></div>
        </dl>

        <h2 data-no>Pills <span className="h2-aside">solid · outline</span></h2>
        <p>
          Solid pills are loud — reserve them for the one state that needs the eye now.
          Outline pills carry the rest of a dense list without competing.
        </p>
        <div className="row st-pillrow">
          {PILLS.map((p) => (
            <span className={`st-pill st-pill--solid st-${p.tone}`} key={`s-${p.tone}`} role="status">{p.label}</span>
          ))}
        </div>
        <div className="row st-pillrow">
          {PILLS.map((p) => (
            <span className={`st-pill st-${p.tone}`} key={`o-${p.tone}`}>{p.label}</span>
          ))}
        </div>

        <h2 data-no>Presence <span className="h2-aside">who's on the canvas</span></h2>
        <p>
          The dot tells you who is touching the work. The agent gets its own hue and a
          soft halo — you always know when it, not a teammate, is editing.
        </p>
        <div className="row st-presrow">
          {PRESENCE.map((p) => (
            <span className="st-pres" key={p.mod}>
              <span className={`presence-dot presence-dot--${p.mod}`} />
              <span className="st-pres-lbl">{p.label}</span>
            </span>
          ))}
        </div>

        <h2 data-no>Handoff pipeline <span className="h2-aside">one solid step at a time</span></h2>
        <p>
          A run is a strip of steps. Done steps tick quietly, the live step pulses in
          the agent hue, the rest wait as hollow dots — your eye lands on exactly one
          place: where the run is now.
        </p>
        <div className="st-pipes">
          <Pipeline steps={PIPELINE} caption="run · pricing · v3" />
          <Pipeline steps={PIPELINE_FAIL} caption="run · mobile · nav — blocked" />
        </div>

        <h2 data-no>Row indicators <span className="h2-aside">state of a thing</span></h2>
        <p>A list of canvases, each with a left-edge bar in its status hue and a trailing pill.</p>
        <div className="st-rows">
          <div className="panel st-row">
            <span className="st-row-bar st-bar--success" aria-hidden="true" />
            <div className="st-row-body"><strong>pricing · v3</strong><span className="st-row-sub">Synced to handoff 2m ago.</span></div>
            <span className="st-pill st-pill--solid st-success" role="status">Live</span>
          </div>
          <div className="panel st-row">
            <span className="st-row-bar st-bar--warn" aria-hidden="true" />
            <div className="st-row-body"><strong>onboarding · flow</strong><span className="st-row-sub">Token audit running (started 40s ago).</span></div>
            <span className="st-pill st-pill--solid st-warn" role="status">Auditing</span>
          </div>
          <div className="panel st-row">
            <span className="st-row-bar st-bar--error" aria-hidden="true" />
            <div className="st-row-body"><strong>mobile · nav</strong><span className="st-row-sub">Grid check failed — 2 nodes off-grid.</span></div>
            <span className="st-pill st-pill--solid st-error" role="status">Blocked</span>
          </div>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-status</span>
          <span>status palette · solid earns attention · accent stays for actions</span>
        </footer>
      </main>
    </>
  );
}
