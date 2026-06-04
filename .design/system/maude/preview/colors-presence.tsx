/**
 * @canvas      colors-presence — the --presence-* family in the studio: collaborator
 *              cursors AND the AI agent's own cursor, every one ANCHORED to a specific
 *              node / row / toolbar on the dotted canvas (never floating over void).
 *              Demonstrates --presence-online / --away / --offline and the load-bearing
 *              --presence-agent: the agent gets its own hue so you always know it — not
 *              a teammate — is the one touching the canvas. Plus an avatar stack with
 *              presence dots and a "who's here" bar. Pulses are ≤56px, bounded,
 *              compositor-only; reduced-motion collapses them.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/colors-presence — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN (from audience-pro-presence): --presence-* states, dots on avatars,
 * live cursors + labels, a viewers count. RESTRUCTURED for the studio — cursors
 * sit ON real canvas nodes, the AGENT cursor (--presence-agent) is the headline
 * (the reference had no agent), and collaborator cursors map to DS presence-state
 * tokens, NOT the reference's illustrative inline oklch() per-user colours.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./colors-presence.css";

/* the standard pointer arrow — one shape, tinted by who's holding it */
function Pointer() {
  return (
    <svg className="cur-arrow" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 3 L20 11.5 L12.5 13 L10 21 Z" />
    </svg>
  );
}

const FAMILY = [
  { tok: "--presence-online", state: "online", oklch: "0.74 0.16 145", use: "actively in the canvas" },
  { tok: "--presence-away", state: "away", oklch: "0.80 0.13 78", use: "idle ≥ 5 min" },
  { tok: "--presence-offline", state: "offline", oklch: "0.56 0.02 255", use: "last seen — muted" },
  { tok: "--presence-agent", state: "agent", oklch: "0.70 0.17 300", use: "the AI — its own hue", agent: true },
];

const ROSTER = [
  { initials: "DK", name: "Dana K.", state: "online" as const, where: "editing Hero" },
  { initials: "RV", name: "Reyes V.", state: "away" as const, where: "idle 6m" },
  { initials: "MT", name: "Mara T.", state: "offline" as const, where: "left 1h ago" },
  { initials: "AI", name: "Agent", state: "agent" as const, where: "drafting Footer", agent: true },
];

export default function ColorsPresence() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/colors-presence</span>
        <span className="crumbs"><span>maude</span><span>color</span><span>presence</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Presence. Who's on the canvas — including the agent.</h1>
          <p className="lede">
            Collaboration here is multiplayer in the literal sense: teammates have cursors,
            and so does the <strong>AI agent</strong>. The agent draws on the same canvas you
            do, so it earns its own hue — <code>--presence-agent</code>, a distinct violet —
            and you never have to guess whether that node moved because a colleague did it or
            because the agent did. Every cursor anchors to a real node; presence is never
            decoration floating over the void.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>States</dt><dd>online · away · offline</dd></div>
          <div><dt>Agent hue</dt><dd>violet · 300°</dd></div>
          <div><dt>Dot</dt><dd>8px · ring on agent</dd></div>
          <div><dt>Pulse</dt><dd>≤56px · bounded</dd></div>
        </dl>

        <h2 data-no>The family <span className="h2-aside">four tokens · the agent stands apart</span></h2>
        <p>
          Three human states share the warm-to-muted band; the agent sits on a hue no
          human state uses. That separation is the whole point — the agent reads as
          machine, instantly.
        </p>
        <div className="grid pres-fam">
          {FAMILY.map((f) => (
            <div className="swatch" key={f.tok}>
              <div className="chip pres-chip" style={{ background: `var(${f.tok})` }}>
                <span className={"presence-dot presence-dot--" + f.state + (f.agent ? " pres-pulse" : "")} />
              </div>
              <div className="meta">
                <strong>{f.tok}</strong>
                <span className="oklch">{f.oklch}</span>
                <span style={{ display: "block", marginTop: 4, color: "var(--fg-2)" }}>{f.use}</span>
              </div>
            </div>
          ))}
        </div>

        <h2 data-no>Cursors on the canvas <span className="h2-aside">anchored to nodes, never the void</span></h2>
        <p>
          Two teammates and the agent are in the frame. Each cursor sits ON the node its
          owner is touching — Dana on the Hero, Reyes on a plan card, the agent on the
          Footer it's drafting. The agent's pointer pulls a soft ring so it never hides
          in a busy view.
        </p>
        <div className="pres-canvas" aria-label="Canvas with three presence cursors anchored to nodes">
          {/* the nodes — the anchors */}
          <div className="pc-node n-hero">
            <span className="pc-cap mono">Frame · Hero</span>
          </div>
          <div className="pc-node n-card">
            <span className="pc-cap mono">Card · Pro</span>
          </div>
          <div className="pc-node n-footer pc-node--agent">
            <span className="pc-cap mono">Group · Footer</span>
            <span className="pc-agentbadge mono">agent editing</span>
          </div>

          {/* cursors — each pinned to a node corner, tinted by presence state */}
          <div className="cursor cur-online" style={{ ["--cur" as string]: "var(--presence-online)" }}>
            <Pointer />
            <span className="cur-label">Dana</span>
          </div>
          <div className="cursor cur-away" style={{ ["--cur" as string]: "var(--presence-away)" }}>
            <Pointer />
            <span className="cur-label">Reyes</span>
          </div>
          <div className="cursor cur-agent" style={{ ["--cur" as string]: "var(--presence-agent)" }}>
            <span className="cur-ring" aria-hidden="true" />
            <Pointer />
            <span className="cur-label cur-label--agent">Agent</span>
          </div>

          <span className="pc-count mono">3 here · 1 agent</span>
        </div>

        <h2 data-no>Avatar stack &amp; who's here <span className="h2-aside">dot anchors to the avatar</span></h2>
        <p>
          In the toolbar the same states ride as dots on a stacked avatar cluster; the
          full roster expands below. The agent carries its ringed dot in both — consistent
          wherever it appears.
        </p>
        <div className="pres-toolbar toolbar">
          <span className="pt-title mono">Pricing v3</span>
          <span className="toolbar-sep" />
          <div className="avatar-stack" aria-label="4 here">
            {ROSTER.map((r) => (
              <span key={r.initials} className={"av av--" + r.state + (r.agent ? " av--agent" : "")} title={r.name}>
                {r.initials}
                <span className={"presence-dot presence-dot--" + r.state} />
              </span>
            ))}
          </div>
          <span className="pt-here mono">4 here</span>
          <span className="toolbar-sep" />
          <button className="btn btn--sm">Share</button>
        </div>

        <ul className="whos-here">
          {ROSTER.map((r) => (
            <li key={r.initials} className={"wh-row tree-row" + (r.agent ? " wh-row--agent" : "")}>
              <span className={"av av--" + r.state + (r.agent ? " av--agent" : "")}>
                {r.initials}
                <span className={"presence-dot presence-dot--" + r.state} />
              </span>
              <span className="wh-name">{r.name}</span>
              <span className="wh-where mono">{r.where}</span>
              <span className={"wh-state tag" + (r.agent ? " tag--accent" : "")}>{r.state}</span>
            </li>
          ))}
        </ul>

        <div className="callout callout--info pres-note">
          <span>
            <strong className="note-h">Why the agent gets its own hue.</strong>
            The agent edits the same canvas as your team. If it shared the online-green,
            you couldn't tell a teammate's change from the model's. A dedicated violet
            (<code>--presence-agent</code>) keeps attribution honest — and the ring marks it
            as the one non-human presence in the room. Don't blink presence; in a busy
            canvas it's noise. The only motion is the agent's slow ring, capped at 56px.
          </span>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/colors-presence</span>
          <span>--presence-* · online · away · offline · agent</span>
        </footer>
      </main>
    </>
  );
}
