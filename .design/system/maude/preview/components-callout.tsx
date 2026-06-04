/**
 * @canvas      components-callout — inline callouts: info / success / warn / error.
 *              The left status rule carries the meaning; the bg stays neutral so
 *              callouts stack without competing. Thin-stroke (1px) SVG glyphs only,
 *              never emoji. Real maude messages — agent progress, handoff gates.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/components-callout — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-callout.css";

type Variant = "info" | "success" | "warn" | "error";

/* Thin-stroke geometric glyphs — terminal/IDE heritage, currentColor inherits the rule hue. */
function Glyph({ variant }: { variant: Variant }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (variant) {
    case "info":
      return <svg {...common}><circle cx="8" cy="8" r="6.25" /><path d="M8 7.25v3.5" /><path d="M8 5.1h.01" /></svg>;
    case "success":
      return <svg {...common}><circle cx="8" cy="8" r="6.25" /><path d="m5.4 8.2 1.9 1.9 3.5-4" /></svg>;
    case "warn":
      return <svg {...common}><path d="M8 2.4 14.4 13H1.6L8 2.4Z" /><path d="M8 6.6v3" /><path d="M8 11.2h.01" /></svg>;
    case "error":
      return <svg {...common}><circle cx="8" cy="8" r="6.25" /><path d="m5.8 5.8 4.4 4.4" /><path d="m10.2 5.8-4.4 4.4" /></svg>;
  }
}

type Note = {
  variant: Variant;
  head: string;
  text: string;
  action?: string;
};

const NOTES: Note[] = [
  {
    variant: "success",
    head: "Agent finished drafting 3 frames",
    text: "Onboarding · flow now has welcome, permissions and done — open the canvas to review before you keep iterating.",
    action: "Open canvas",
  },
  {
    variant: "info",
    head: "Auto-snapshot kept",
    text: "Your last edit was snapshotted to _history. Roll back any step with the timeline, nothing is overwritten in place.",
  },
  {
    variant: "warn",
    head: "Handoff blocked — 2 nodes off-grid",
    text: "The pricing · v3 frame can't hand off until every node snaps to the 8px grid. Two are 3px out.",
    action: "Review nodes",
  },
  {
    variant: "error",
    head: "Couldn't reach the agent",
    text: "The drafting run dropped at frame 2 of 5. Your work is saved — retry when the connection is back.",
    action: "Retry run",
  },
];

export default function ComponentsCallout() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-callout</span>
        <span className="crumbs"><span>maude</span><span>component</span><span>callout</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Callouts. In-flow, not in the way.</h1>
          <p className="lede">
            A callout speaks where the work is — neither a toast that vanishes nor a
            modal that blocks. The meaning rides a single left rule in the status hue;
            the surface stays neutral so callouts stack without shouting over the
            canvas. The title is the takeaway, the body is one sentence.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Kind</dt><dd>inline · persistent</dd></div>
          <div><dt>Signal</dt><dd>left rule · status hue</dd></div>
          <div><dt>Surface</dt><dd>--bg-1 (neutral)</dd></div>
          <div><dt>Glyph</dt><dd>1px stroke · no emoji</dd></div>
        </dl>

        <h2 data-no>The four variants <span className="h2-aside">info · success · warn · error</span></h2>
        <p>
          Real messages from a working session — the agent reports, the snapshot
          keeper notes, the handoff gate warns, the run fails. Each leads with the
          status hue on the rule and glyph; the body explains in one line.
        </p>

        <div className="co-stack">
          {NOTES.map((n) => (
            <div className={`callout callout--${n.variant} co`} key={n.head} role="note">
              <span className="co-glyph"><Glyph variant={n.variant} /></span>
              <div className="co-body">
                <p className="co-head">{n.head}</p>
                <p className="co-text">{n.text}</p>
              </div>
              {n.action && (
                <button type="button" className="btn btn--sm co-action">{n.action}</button>
              )}
            </div>
          ))}
        </div>

        <h2 data-no>Calm, not loud <span className="h2-aside">good · wrong</span></h2>
        <p>
          The rule and glyph carry the urgency. A filled status background — even on an
          error — out-shouts the canvas and makes a stack of callouts unreadable.
        </p>
        <div className="co-vs">
          <figure className="ok">
            <div className="callout callout--error co">
              <span className="co-glyph"><Glyph variant="error" /></span>
              <div className="co-body">
                <p className="co-head">Couldn't reach the agent</p>
                <p className="co-text">Neutral surface, rule does the signalling.</p>
              </div>
            </div>
            <figcaption>✓ rule signals · surface stays calm</figcaption>
          </figure>
          <figure className="no">
            <div className="callout co co-flooded">
              <span className="co-glyph"><Glyph variant="error" /></span>
              <div className="co-body">
                <p className="co-head">Couldn't reach the agent</p>
                <p className="co-text">Filled background floods the panel — louder than the canvas.</p>
              </div>
            </div>
            <figcaption>✕ filled status bg · out-shouts the work</figcaption>
          </figure>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-callout</span>
          <span>inline · status rule · title is the takeaway</span>
        </footer>
      </main>
    </>
  );
}
