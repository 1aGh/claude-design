/**
 * @canvas      components-list — the layers tree + a canvases list, in the
 *              unified panel material. Demonstrates .tree-row selection
 *              (accent-tint wash + inset accent bar), multi-select, nesting /
 *              indent with disclosure twisties, a drag handle, per-row meta
 *              (type glyph · visibility · lock · presence), and a second list
 *              variant — the "canvases" picker — proving one row anatomy scales
 *              from a deep tree to a flat catalogue. Keyboard-first; J/K hints
 *              live in the footer, never on the rows.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/components-list — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN (from audience-pro-components-list): dense list rows, selection
 * state, multi-select, keyboard hints. RESTRUCTURED for the studio — the rows
 * are a real layers tree (nesting + twisties + drag) and a canvases catalogue,
 * not a flat roster. Selection uses --accent-tint + inset bar (the studio's
 * selection language), not --bg-4.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-list.css";

/* ── thin-stroke 1px geometric glyphs (terminal/IDE heritage, no emoji) ── */
function Glyph({ name }: { name: "frame" | "text" | "group" | "image" | "vector" }) {
  const p = {
    frame: "M4 4h12v12H4z M4 8h12 M8 4v12",
    text: "M4 5h12 M10 5v10 M7 15h6",
    group: "M3 7h7v7H3z M10 4h7v7",
    image: "M3 4h14v12H3z M3 13l4-4 3 3 3-4 4 5",
    vector: "M4 4h3v3H4z M13 13h3v3h-3z M7 5.5h6v-1 M5.5 7v6 M13 14.5h-6",
  }[name];
  return (
    <svg className="row-glyph" width="14" height="14" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={p} />
    </svg>
  );
}

function Twisty({ open }: { open: boolean }) {
  return (
    <svg className={"twisty" + (open ? " is-open" : "")} width="10" height="10" viewBox="0 0 10 10"
      fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 2.5 L6.5 5 L3.5 7.5" />
    </svg>
  );
}

function Grip() {
  return (
    <svg className="row-grip" width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="3" r="1" /><circle cx="6" cy="3" r="1" />
      <circle cx="2" cy="7" r="1" /><circle cx="6" cy="7" r="1" />
      <circle cx="2" cy="11" r="1" /><circle cx="6" cy="11" r="1" />
    </svg>
  );
}

/* visibility / lock — toggled affordances rendered per row */
function EyeOff() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10s2.5-4.5 7-4.5 7 4.5 7 4.5-2.5 4.5-7 4.5S3 10 3 10z M4 4l12 12" />
    </svg>
  );
}
function Lock() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 9h10v7H5z M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}

type Layer = {
  id: string; label: string; glyph: "frame" | "text" | "group" | "image" | "vector";
  depth: number; open?: boolean; selected?: boolean; hidden?: boolean; locked?: boolean;
  meta?: string; agent?: boolean;
};

const LAYERS: Layer[] = [
  { id: "page", label: "Page · Pricing v3", glyph: "frame", depth: 0, open: true, meta: "1440×1024" },
  { id: "hero", label: "Frame · Hero", glyph: "frame", depth: 1, open: true },
  { id: "head", label: "Text · Headline", glyph: "text", depth: 2, agent: true },
  { id: "sub", label: "Text · Subhead", glyph: "text", depth: 2 },
  { id: "cards", label: "Group · Plan cards", glyph: "group", depth: 1, open: true, selected: true, meta: "×3" },
  { id: "card-a", label: "Card · Starter", glyph: "frame", depth: 2, selected: true },
  { id: "card-b", label: "Card · Pro", glyph: "frame", depth: 2, selected: true },
  { id: "card-c", label: "Card · Team", glyph: "frame", depth: 2, locked: true },
  { id: "shot", label: "Image · Product shot", glyph: "image", depth: 1, hidden: true },
  { id: "footer", label: "Group · Footer", glyph: "group", depth: 1 },
  { id: "logo", label: "Vector · Mark", glyph: "vector", depth: 2 },
];

const CANVASES = [
  { name: "Pricing v3", frames: 12, edited: "now", who: "you", live: "agent" as const },
  { name: "Onboarding flow", frames: 28, edited: "6m", who: "Dana", live: "online" as const },
  { name: "Inspector redesign", frames: 9, edited: "1h", who: "you", live: null },
  { name: "Marketing site", frames: 41, edited: "yesterday", who: "Reyes", live: "away" as const },
  { name: "Handoff · v0.31", frames: 7, edited: "3d", who: "you", live: null },
];

export default function ComponentsList() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-list</span>
        <span className="crumbs"><span>maude</span><span>component</span><span>list</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Lists. The layers tree, the canvases shelf.</h1>
          <p className="lede">
            One row anatomy, two jobs. A deep <strong>layers tree</strong> — nested,
            disclosable, draggable — and a flat <strong>canvases</strong> catalogue both
            run on the same <code>.tree-row</code>. Selection is a quiet <code>--accent-tint</code>
            wash plus an inset accent bar, never a loud fill. Rows stay tight (~28px);
            you read a hundred of them without the chrome ever raising its voice.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Anatomy</dt><dd>.tree-row</dd></div>
          <div><dt>Selection</dt><dd>accent-tint + inset bar</dd></div>
          <div><dt>Row height</dt><dd>~28px · dense</dd></div>
          <div><dt>Multi-select</dt><dd>shift / cmd-click</dd></div>
        </dl>

        <h2 data-no>The layers tree <span className="h2-aside">nested · selectable · draggable</span></h2>
        <p>
          The panel material houses the tree: a header in mono, disclosure twisties,
          indent guides per depth, a drag handle on hover, and a meta cluster
          (type glyph · visibility · lock). Two cards are co-selected; one node is
          being touched by the agent.
        </p>
        <div className="list-wrap">
          <div className="panel list-panel">
            <div className="panel-hd">
              <span>Layers</span>
              <span className="list-count">11 · 2 selected</span>
            </div>
            <div className="tree" role="tree" aria-label="Layers">
              {LAYERS.map((l) => (
                <div
                  key={l.id}
                  className={"tree-row lr" + (l.hidden ? " is-hidden" : "")}
                  role="treeitem"
                  aria-selected={l.selected || undefined}
                  aria-expanded={l.open !== undefined ? l.open : undefined}
                  style={{ paddingLeft: `calc(var(--space-3) + ${l.depth} * var(--space-5))` }}
                >
                  <Grip />
                  <span className="lr-disc">
                    {l.open !== undefined ? <Twisty open={l.open} /> : <span className="lr-leaf" />}
                  </span>
                  <Glyph name={l.glyph} />
                  <span className="lr-name">{l.label}</span>
                  {l.agent && <span className="presence-dot presence-dot--agent lr-agent" title="agent editing" />}
                  {l.meta && <span className="lr-meta mono">{l.meta}</span>}
                  <span className="lr-tools">
                    {l.hidden && <span className="lr-tool is-on" title="hidden"><EyeOff /></span>}
                    {l.locked && <span className="lr-tool is-on" title="locked"><Lock /></span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <aside className="list-notes">
            <div className="callout callout--info">
              <span>
                <strong className="note-h">Indent is structure, not decoration.</strong>
                Each depth steps one <code>--space-5</code>; the guide hairline traces the
                parent so a 5-deep tree never loses its spine.
              </span>
            </div>
            <div className="note-states">
              <span className="ns-row"><span className="ns-chip ns-idle" /> idle — fg-1 on bg-1</span>
              <span className="ns-row"><span className="ns-chip ns-hover" /> hover — bg-2 wash</span>
              <span className="ns-row"><span className="ns-chip ns-sel" /> selected — accent-tint + inset bar</span>
              <span className="ns-row"><span className="ns-chip ns-agent" /> agent-touched — presence-agent dot</span>
            </div>
          </aside>
        </div>

        <h2 data-no>The canvases shelf <span className="h2-aside">same row · flat catalogue</span></h2>
        <p>
          Drop the nesting and the same row becomes a canvases picker — predictable
          column slots (name · frames · edited · who's live). Selection language is
          identical; only the columns change.
        </p>
        <div className="panel canv-panel">
          <div className="canv-head">
            <span>Canvas</span>
            <span className="num">Frames</span>
            <span className="num">Edited</span>
            <span>Live</span>
          </div>
          {CANVASES.map((c, i) => (
            <div key={c.name} className={"tree-row canv-row" + (i === 0 ? " cr-sel" : "")} aria-selected={i === 0 || undefined}>
              <span className="cr-name">
                <Glyph name="frame" />
                {c.name}
              </span>
              <span className="num cr-frames mono">{c.frames}</span>
              <span className="num cr-edited mono">{c.edited}</span>
              <span className="cr-live">
                {c.live === "agent" ? (
                  <><span className="presence-dot presence-dot--agent" /> agent</>
                ) : c.live ? (
                  <><span className={"presence-dot presence-dot--" + c.live} /> {c.who}</>
                ) : (
                  <span className="cr-quiet">{c.who} · last</span>
                )}
              </span>
            </div>
          ))}
        </div>

        <h2 data-no>Keyboard footer <span className="h2-aside">power users navigate by key</span></h2>
        <p>Hints live here, not on the rows — they'd be noise on a hundred-row tree.</p>
        <div className="kbd-footer">
          <span><span className="kbd">J</span><span className="kbd">K</span> move selection</span>
          <span><span className="kbd">⇧</span>click range-select</span>
          <span><span className="kbd">←</span><span className="kbd">→</span> collapse · expand</span>
          <span><span className="kbd">⌫</span> delete layer</span>
          <span><span className="kbd">⌘</span><span className="kbd">G</span> group</span>
          <span><span className="kbd">⏎</span> rename</span>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-list</span>
          <span>.tree-row · layers + canvases · one anatomy</span>
        </footer>
      </main>
    </>
  );
}
