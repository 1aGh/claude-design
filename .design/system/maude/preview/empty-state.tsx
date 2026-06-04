/**
 * @canvas      empty-state — SIGNATURE — the studio's empty surfaces, written
 *              in maude's voice. The empty canvas (dotted, calm, with an agent
 *              offer to draft a frame), no-frames-yet, and no-search-results,
 *              each carrying exactly ONE primary indigo action. Plus a
 *              "Voice — keep or kill" panel that puts maude's terse copy next to
 *              the corporate filler it replaces, and a variants grid for the
 *              smaller empty cases (layers, properties, history, comments).
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/empty-state — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import type { ReactNode } from "react";
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./empty-state.css";

/* The smaller empty surfaces — each one names the missing thing and offers the
 * single next step, never a generic "Get started". One accent action apiece. */
type Mini = { ctx: string; title: string; body: string; cta: string; glyph: ReactNode };

const Glyph = {
  layers: (
    <>
      <path d="M12 4 4 8l8 4 8-4-8-4Z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 16l8 4 8-4" opacity="0.5" />
    </>
  ),
  props: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="14" y1="4" x2="14" y2="20" />
      <line x1="16.5" y1="9" x2="18.5" y2="9" />
      <line x1="16.5" y1="13" x2="18.5" y2="13" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.6" />
      <path d="M4 4v3h3" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  comments: (
    <>
      <path d="M4 5h16v11H9l-4 3v-3H4Z" />
      <line x1="8" y1="9.5" x2="16" y2="9.5" opacity="0.5" />
      <line x1="8" y1="12.5" x2="13" y2="12.5" opacity="0.5" />
    </>
  ),
};

const MINIS: Mini[] = [
  {
    ctx: "Layers",
    title: "Nothing on this frame",
    body: "Drop a node or let the agent sketch one.",
    cta: "Add node",
    glyph: Glyph.layers,
  },
  {
    ctx: "Properties",
    title: "Select a node",
    body: "Pick something on the canvas to edit its properties.",
    cta: "Pick a node",
    glyph: Glyph.props,
  },
  {
    ctx: "History",
    title: "No snapshots yet",
    body: "Every edit auto-snapshots. Make one to start the trail.",
    cta: "Snapshot now",
    glyph: Glyph.history,
  },
  {
    ctx: "Comments",
    title: "Quiet so far",
    body: "Drop a pin on the canvas to start a thread.",
    cta: "Leave a note",
    glyph: Glyph.comments,
  },
];

/* The voice contrast — terse maude copy vs the filler it replaces. */
const VOICE: { keep: string; kill: string; note: string }[] = [
  { keep: "Nothing on this canvas — yet.", kill: "Welcome! It looks like you don't have anything here.", note: "no greeting, no apology" },
  { keep: "Ask the agent to draft a frame.", kill: "Get started by creating your first amazing project!", note: "name the action, drop the adjectives" },
  { keep: "No frames match “pricing”.", kill: "Sorry, we couldn't find any results for your search.", note: "show the query, skip the sorry" },
  { keep: "Hand off when you're ready.", kill: "Click here to continue to the next step of your journey.", note: "the verb is the label" },
];

export default function EmptyState() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/empty-state</span>
        <span className="crumbs"><span>maude</span><span>brand</span><span>empty-state</span></span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Empty, on purpose.</h1>
          <p className="lede">
            An empty surface is the first thing a new user reads and the last thing a pro
            wants to. So we write it once, properly: name the missing thing, offer the single
            next step, and get out of the way. One primary indigo action per surface — never
            two, never a wall of onboarding. The blank canvas isn&rsquo;t a dead end; it&rsquo;s an
            invitation with the agent already standing by.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Surfaces</dt><dd>canvas · frames · search</dd></div>
          <div><dt>Action</dt><dd>one accent · per state</dd></div>
          <div><dt>Tone</dt><dd>terse · no filler</dd></div>
          <div><dt>Agent</dt><dd>offered, not forced</dd></div>
        </dl>

        <h2 data-no>The empty canvas <span className="h2-aside">the first frame is one prompt away</span></h2>
        <p>
          The canvas is never &ldquo;loading&rdquo; or &ldquo;blank&rdquo; — it&rsquo;s a dotted infinite surface
          waiting for the first node. The prompt sits dead-center, calm, with the agent offered
          as the fast path. The dot-grid does the talking; the copy stays out of the way.
        </p>
        <div className="es-canvas-wrap" aria-label="Empty canvas state">
          <div className="es-canvas-toolbar">
            <span className="es-tool-title">untitled · canvas</span>
            <span className="es-spacer" />
            <span className="presence-dot presence-dot--agent" title="AI agent — idle" />
            <span className="es-agent-state">agent · idle</span>
          </div>
          <div className="es-canvas">
            <div className="es-prompt">
              <span className="es-mark" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
                  <rect x="7" y="7" width="18" height="18" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                </svg>
              </span>
              <p className="es-prompt-title">Nothing on this canvas &mdash; yet.</p>
              <p className="es-prompt-body">
                Draw a frame, paste a mockup, or hand it to the agent.
              </p>
              <div className="es-prompt-actions">
                <button className="btn btn--primary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 4v16M4 12h16" />
                  </svg>
                  Ask the agent to draft a frame
                </button>
                <button className="btn">
                  Draw a frame
                  <span className="kbd">F</span>
                </button>
              </div>
              <p className="es-prompt-hint mono">double-click anywhere to start typing</p>
            </div>
          </div>
        </div>

        <h2 data-no>No frames yet <span className="h2-aside">an empty project, not an empty page</span></h2>
        <p>
          A fresh project lists no frames. We don&rsquo;t apologize for it — we hand over the two
          ways in. The illustration is the selection motif itself, drawn empty: the handles are
          there, the node isn&rsquo;t.
        </p>
        <div className="es-panel-row">
          <div className="es-state panel">
            <div className="panel-hd">Frames <span className="mono es-count">0</span></div>
            <div className="es-state-bd">
              <span className="es-illu" aria-hidden="true">
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <rect x="16" y="16" width="24" height="24" rx="3" fill="none" stroke="var(--border-strong)" strokeWidth="1.25" strokeDasharray="4 4" />
                  <g fill="var(--accent)">
                    <rect x="11" y="11" width="6" height="6" rx="1.4" />
                    <rect x="39" y="11" width="6" height="6" rx="1.4" />
                    <rect x="11" y="39" width="6" height="6" rx="1.4" />
                    <rect x="39" y="39" width="6" height="6" rx="1.4" />
                  </g>
                </svg>
              </span>
              <p className="es-state-title">No frames yet</p>
              <p className="es-state-body">Frames are where the design lives. Make the first one.</p>
              <div className="es-state-actions">
                <button className="btn btn--primary btn--sm">New frame</button>
                <button className="btn btn--ghost btn--sm">Import mockup</button>
              </div>
            </div>
          </div>

          <div className="es-state panel">
            <div className="panel-hd">Search <span className="mono es-count">&ldquo;pricing&rdquo;</span></div>
            <div className="es-state-bd">
              <span className="es-illu" aria-hidden="true">
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="var(--fg-3)" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="25" cy="25" r="12" />
                  <line x1="34" y1="34" x2="44" y2="44" />
                  <line x1="20" y1="25" x2="30" y2="25" opacity="0.4" />
                </svg>
              </span>
              <p className="es-state-title">No frames match &ldquo;pricing&rdquo;</p>
              <p className="es-state-body">Nothing on the canvas carries that name. Clear the filter, or name a frame for it.</p>
              <div className="es-state-actions">
                <button className="btn btn--primary btn--sm">Clear search</button>
                <button className="btn btn--ghost btn--sm">New frame &ldquo;Pricing&rdquo;</button>
              </div>
            </div>
          </div>
        </div>

        <h2 data-no>Voice &mdash; keep or kill <span className="h2-aside">terse beats friendly</span></h2>
        <p>
          The same surface, written two ways. The left column ships; the right is the corporate
          filler it replaces. A pro reads the left once and never again &mdash; which is the point.
        </p>
        <div className="es-voice" role="table" aria-label="Voice — keep vs kill">
          <div className="es-voice-hd" role="row">
            <span role="columnheader" className="es-voice-keep-hd">keep</span>
            <span role="columnheader" className="es-voice-kill-hd">kill</span>
            <span role="columnheader" className="es-voice-note-hd">why</span>
          </div>
          {VOICE.map((v) => (
            <div className="es-voice-row" role="row" key={v.keep}>
              <span role="cell" className="es-voice-keep">{v.keep}</span>
              <span role="cell" className="es-voice-kill"><s>{v.kill}</s></span>
              <span role="cell" className="es-voice-note mono">{v.note}</span>
            </div>
          ))}
        </div>

        <h2 data-no>The rest of the studio <span className="h2-aside">small surfaces, same rule</span></h2>
        <p>
          Every panel that can be empty gets the same treatment: a thin-stroke glyph, a titled
          situation, one sentence of what to do, and exactly one accent action. Same material,
          same restraint &mdash; just scaled down to the panel.
        </p>
        <div className="es-mini-grid">
          {MINIS.map((m) => (
            <div className="es-mini panel" key={m.ctx}>
              <div className="panel-hd">{m.ctx}</div>
              <div className="es-mini-bd">
                <span className="es-mini-glyph" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                    {m.glyph}
                  </svg>
                </span>
                <p className="es-mini-title">{m.title}</p>
                <p className="es-mini-body">{m.body}</p>
                <button className="btn btn--primary btn--sm">{m.cta}</button>
              </div>
            </div>
          ))}
        </div>

        <h2 data-no>The recipe <span className="h2-aside">one accent, one sentence</span></h2>
        <ul className="es-recipe">
          <li><span className="es-recipe-n mono">01</span> Name the missing thing, not the absence. <em>&ldquo;No frames yet&rdquo;</em>, never <em>&ldquo;Nothing here&rdquo;</em>.</li>
          <li><span className="es-recipe-n mono">02</span> One sentence of what to do next. The verb leads.</li>
          <li><span className="es-recipe-n mono">03</span> Exactly one primary indigo action. A ghost second is fine; a second primary is not.</li>
          <li><span className="es-recipe-n mono">04</span> Offer the agent where it&rsquo;s the fast path &mdash; never force it.</li>
          <li><span className="es-recipe-n mono">05</span> No emoji, no exclamation marks, no &ldquo;oops&rdquo;. The chrome stays calm.</li>
        </ul>

        <footer className="specimen-ft">
          <span>MAUDE/empty-state</span>
          <span>canvas · frames · search · one accent each</span>
        </footer>
      </main>
    </>
  );
}
