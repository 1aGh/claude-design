/**
 * @canvas      components-command-palette — the ⌘K palette over the dotted canvas.
 *              Demonstrates the keyboard-first entry point to everything Maude:
 *              a single mono search input, results grouped Frames / Actions / Agent,
 *              one selected row washed in --accent-tint with an inset accent bar,
 *              right-aligned .kbd hints, and the "Ask the agent…" hand-off row.
 *              The palette is the keyboard-driven signature — chrome that appears,
 *              does its one job, and dismisses. Bounded compositor-only reveal.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/components-command-palette — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import type { ReactNode } from "react";
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-command-palette.css";

/* Thin-stroke (1px) geometric glyphs — terminal/IDE heritage, no emoji. */
function Glyph({ d, name }: { d: ReactNode; name: string }) {
  // Named → labelled image; unnamed → decorative (the row's text carries meaning).
  const a11y = name ? { role: "img" as const, "aria-label": name } : { "aria-hidden": true };
  return (
    <svg className="cp-glyph" width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      {...a11y}>
      {d}
    </svg>
  );
}
const ICON = {
  frame: <><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 9h16M9 4v16" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  handoff: <><path d="M5 12h12" /><path d="m13 6 6 6-6 6" /></>,
  grid: <><path d="M9 4v16M15 4v16M4 9h16M4 15h16" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.6-3.6" /></>,
  layers: <><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 13 8 4 8-4" /></>,
  agent: <><circle cx="12" cy="12" r="3.2" /><path d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20M6.3 6.3l1.8 1.8M15.9 15.9l1.8 1.8M17.7 6.3l-1.8 1.8M8.1 15.9l-1.8 1.8" /></>,
  duplicate: <><rect x="8" y="8" width="11" height="11" rx="1.5" /><path d="M5 14V5h9" /></>,
} as const;

/* Three result groups. The selected row is the FIRST runnable — accent-tint wash. */
const GROUPS = [
  {
    head: "Frames",
    rows: [
      { icon: ICON.frame, pre: "New ", match: "fra", post: "me", keys: ["⌘", "N"], sel: true },
      { icon: ICON.duplicate, pre: "Duplicate ", match: "fra", post: "me", keys: ["⌘", "D"] },
      { icon: ICON.layers, pre: "Select all in ", match: "fra", post: "me", keys: ["⌘", "A"] },
    ],
  },
  {
    head: "Actions",
    rows: [
      { icon: ICON.handoff, pre: "Hand off to production", match: "", post: "", keys: ["⌘", "⇧", "H"] },
      { icon: ICON.grid, pre: "Snap all to grid", match: "", post: "", keys: ["⌘", "'"] },
    ],
  },
  {
    head: "Agent",
    rows: [
      { icon: ICON.agent, pre: "Ask the agent to draft a ", match: "fra", post: "me", keys: ["⏎"], agent: true },
    ],
  },
];

export default function ComponentsCommandPalette() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-command-palette</span>
        <span className="crumbs"><span>maude</span><span>pro</span><span>palette</span></span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Command palette.</h1>
          <p className="lede">
            <span className="kbd">⌘</span> <span className="kbd">K</span> from anywhere — the
            keyboard-first way into every frame, action, and the agent itself. One mono
            input, results grouped, the next runnable already selected. Type the verb;
            never reach for a menu. The palette appears, does its one job, dismisses.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Trigger</dt><dd>⌘K · universal</dd></div>
          <div><dt>Material</dt><dd>shared panel · shadow-lg</dd></div>
          <div><dt>Selection</dt><dd>accent-tint + bar</dd></div>
          <div><dt>Groups</dt><dd>Frames · Actions · Agent</dd></div>
        </dl>

        <h2 data-no>Over the canvas <span className="h2-aside">⌘K · scrim · one selected row</span></h2>
        <p>
          The palette floats on a dim scrim over the dotted canvas — the work stays visible
          behind it, never replaced. The accent appears exactly once: the selected row.
        </p>

        <div className="cp-stage canvas" aria-label="Command palette over the canvas">
          <span className="cp-scrim" />
          <div className="cp" role="dialog" aria-label="Command palette" aria-modal="true">
            <div className="cp-input">
              <Glyph d={ICON.search} name="Search" />
              <span className="cp-query">
                fra<span className="cp-caret" aria-hidden="true" />
              </span>
              <span className="cp-input-hint"><span className="kbd">esc</span></span>
            </div>

            <div className="cp-results" role="listbox" aria-label="Results">
              {GROUPS.map((g) => (
                <div className="cp-group" key={g.head}>
                  <div className="cp-group-head">{g.head}</div>
                  {g.rows.map((r, i) => (
                    <div
                      className={
                        "cp-row" +
                        (r.sel ? " is-selected" : "") +
                        (r.agent ? " cp-row--agent" : "")
                      }
                      role="option"
                      aria-selected={r.sel ? "true" : "false"}
                      key={g.head + i}
                    >
                      <span className="cp-row-glyph">
                        <Glyph d={r.icon} name="" />
                      </span>
                      <span className="cp-label">
                        {r.pre}
                        {r.match && <mark className="cp-match">{r.match}</mark>}
                        {r.post}
                      </span>
                      <span className="cp-keys">
                        {r.keys.map((k, j) => (
                          <span className="kbd" key={j}>{k}</span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="cp-footer">
              <span className="cp-foot-hints">
                <span className="kbd">↑</span><span className="kbd">↓</span>
                <span className="cp-foot-sep">navigate</span>
                <span className="kbd">⏎</span>
                <span className="cp-foot-sep">run</span>
                <span className="kbd">⇥</span>
                <span className="cp-foot-sep">to agent</span>
              </span>
              <span className="cp-count mono">6 · across 3 groups</span>
            </div>
          </div>
        </div>

        <h2 data-no>Anatomy of a row <span className="h2-aside">glyph · label · match · keys</span></h2>
        <p>
          A row is a four-part grid: a 1px glyph, the action label with the matched substring
          tinted, and the binding right-aligned as <span className="kbd">⌘</span><span className="kbd">N</span>.
          The selected row adds an inset accent bar — present, never a loud fill.
        </p>
        <div className="cp-anatomy">
          <div className="cp-row is-selected" role="presentation">
            <span className="cp-row-glyph"><Glyph d={ICON.frame} name="" /></span>
            <span className="cp-label">New <mark className="cp-match">fra</mark>me</span>
            <span className="cp-keys"><span className="kbd">⌘</span><span className="kbd">N</span></span>
          </div>
          <ol className="cp-callouts mono">
            <li><span className="cp-num">1</span> glyph — thin-stroke, fg-1</li>
            <li><span className="cp-num">2</span> label — match in accent-tint</li>
            <li><span className="cp-num">3</span> keys — .kbd, right-aligned</li>
            <li><span className="cp-num">4</span> selected — inset accent bar + tint</li>
          </ol>
        </div>

        <h2 data-no>The agent row <span className="h2-aside">hand off the query to the agent</span></h2>
        <p>
          When the verb is a request, not a command, the last group hands it to the agent.
          The row carries the agent presence hue, not the indigo accent — you always know
          who is about to touch the canvas.
        </p>
        <div className="cp-agentrow">
          <div className="cp-row cp-row--agent" role="presentation">
            <span className="cp-row-glyph"><Glyph d={ICON.agent} name="" /></span>
            <span className="cp-label">Ask the agent to draft a <mark className="cp-match">fra</mark>me</span>
            <span className="cp-keys"><span className="kbd">⏎</span></span>
          </div>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-command-palette</span>
          <span>⌘K · keyboard-driven · one selected row</span>
        </footer>
      </main>
    </>
  );
}
