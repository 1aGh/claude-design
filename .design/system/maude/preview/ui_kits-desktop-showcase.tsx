/**
 * SPECIMEN: ui_kits/desktop/showcase  — THE SIGNATURE "DS in use" artifact
 * DEMONSTRATES: every Core token composed into ONE cohesive maude studio instrument —
 *   top toolbar (inline logo mark · tool seg move/frame/pen · zoom · Share · Hand off →) ·
 *   left layers tree (selection in --accent-tint + inset bar) · center DOTTED CANVAS with
 *   three frames, ONE selected node carrying indigo handles + a mono coordinate readout,
 *   and the AI agent's presence cursor anchored to a SPECIFIC node ("agent · drafting") ·
 *   right inspector (tabular X/Y/W/H fields, fill, a live tab strip) · bottom status bar
 *   (mono: zoom %, node count, "handoff ready"). Plus a theme toggle and a live accent demo.
 * COMPOSITION: a full-bleed desktop shell. The chrome shares ONE material end to end — the
 *   same 1px hairlines, the same radii, the same elevation — framing the canvas without
 *   ever out-shouting it. The accent appears in exactly THREE places: the Hand off primary,
 *   the selected node, and the active layer. Count them.
 * COPY VOICE: terse, precise, confident. Real domain nouns only — canvas, artboard, frame,
 *   node, inspector, layers, agent, hand off, properties, selection, presence, token.
 * WHEN SCAFFOLDED: always-on (the single highest-leverage file). A reader who opens only
 *   this specimen should understand the whole DS.
 * NOTES: all glyphs are inline 1px-stroke SVG (never emoji, never <img src="../">). The
 *   agent presence cursor anchors to the selected node, never floats over canvas void. The
 *   only motion is the agent label's soft pulse — bounded, compositor-only (opacity), and
 *   collapsed by --dur-soft under reduced-motion. The tool/tab/screen switches are real
 *   useState, not decoration. Cropmark framing is thicker than internal panel borders.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import "./ui_kits-desktop-showcase.css";

/* 1px-stroke geometric glyphs — terminal/IDE heritage, never emoji. currentColor retints. */
const Glyph = {
  mark: (
    // The maude mark — the spark: a four-point star on the indigo message-bubble
    // tile (bottom-right corner squared; the shipped app favicon). One confident accent.
    <svg viewBox="0 0 32 32" aria-hidden="true" className="brand-mark-svg" fill="none">
      <path d="M7 0H25A7 7 0 0 1 32 7V32H7A7 7 0 0 1 0 25V7A7 7 0 0 1 7 0Z" fill="var(--accent)" />
      <path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" fill="var(--accent-fg)" />
    </svg>
  ),
  move: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5v11M2.5 8h11M8 2.5 6 4.5M8 2.5 10 4.5M8 13.5 6 11.5M8 13.5 10 11.5M2.5 8 4.5 6M2.5 8 4.5 10M13.5 8 11.5 6M13.5 8 11.5 10" />
    </svg>
  ),
  frame: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 2v12M11 2v12M2 5h12M2 11h12" />
    </svg>
  ),
  pen: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 13l1-3 6-6 2 2-6 6-3 1ZM9 4l2 2" />
    </svg>
  ),
  hand: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 8V4.5a1 1 0 0 1 2 0V8M7 7.5V4a1 1 0 0 1 2 0v3.5M9 7.5V5a1 1 0 0 1 2 0v4.5a3.5 3.5 0 0 1-3.5 3.5H7a3 3 0 0 1-2.4-1.2L3 11.5a1 1 0 0 1 1.6-1.2L5 11" />
    </svg>
  ),
  zoomIn: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="4" /><path d="M10 10l3.5 3.5M7 5v4M5 7h4" />
    </svg>
  ),
  zoomOut: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="4" /><path d="M10 10l3.5 3.5M5 7h4" />
    </svg>
  ),
  share: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M11 5l-6 3M11 11l-6-3" />
      <circle cx="12.5" cy="3.5" r="2" /><circle cx="3.5" cy="8" r="2" /><circle cx="12.5" cy="12.5" r="2" />
    </svg>
  ),
  handoff: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M9 5l3 3-3 3" />
    </svg>
  ),
  layersGlyph: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5 14 5.5 8 8.5 2 5.5 8 2.5ZM2.5 8.5 8 11.2 13.5 8.5" />
    </svg>
  ),
  text: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4h8M8 4v9M6 13h4" />
    </svg>
  ),
  rect: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="4" width="10" height="8" rx="1.5" />
    </svg>
  ),
  group: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1" /><rect x="7" y="7" width="6" height="6" rx="1" />
    </svg>
  ),
  chevron: (
    <svg className="g chev" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 4l4 4-4 4" />
    </svg>
  ),
  agent: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 13.5 4 4l9 4-4 1.5-1 4-1.5-3.5-3 3.5Z" />
    </svg>
  ),
};

const TOOLS = [
  { id: "move", label: "Move", glyph: Glyph.move, kbd: "V" },
  { id: "frame", label: "Frame", glyph: Glyph.frame, kbd: "F" },
  { id: "pen", label: "Pen", glyph: Glyph.pen, kbd: "P" },
] as const;

type LayerNode = { id: string; label: string; glyph: ReactNode; depth: number; kind: string };
const LAYERS: LayerNode[] = [
  { id: "hero", label: "Frame · Hero", glyph: Glyph.frame, depth: 0, kind: "frame" },
  { id: "headline", label: "Text · Headline", glyph: Glyph.text, depth: 1, kind: "text" },
  { id: "sub", label: "Text · Subhead", glyph: Glyph.text, depth: 1, kind: "text" },
  { id: "pricing", label: "Card · Pricing", glyph: Glyph.rect, depth: 0, kind: "card" },
  { id: "plan", label: "Text · Plan name", glyph: Glyph.text, depth: 1, kind: "text" },
  { id: "price", label: "Text · $24/mo", glyph: Glyph.text, depth: 1, kind: "text" },
  { id: "cta", label: "Frame · CTA", glyph: Glyph.frame, depth: 1, kind: "frame" },
  { id: "footer", label: "Group · Footer", glyph: Glyph.group, depth: 0, kind: "group" },
];

const INSPECTOR_TABS = ["Properties", "Layout", "Tokens"] as const;
type InspTab = (typeof INSPECTOR_TABS)[number];

const ACCENTS = [
  { id: "indigo", label: "indigo", oklch: "0.60 0.19 268", h: 268 },
  { id: "iris", label: "iris", oklch: "0.62 0.18 290", h: 290 },
  { id: "cobalt", label: "cobalt", oklch: "0.60 0.17 250", h: 250 },
] as const;

export default function UiKitsDesktopShowcase() {
  const [tool, setTool] = useState<string>("move");
  const [zoom, setZoom] = useState(100);
  const [selected, setSelected] = useState("pricing");
  const [tab, setTab] = useState<InspTab>("Properties");
  const [accent, setAccent] = useState<string>("indigo");

  const current = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];
  // accent override = ONE hue, all six tokens recomputed in OKLCH from that hue.
  const accentVars =
    accent === "indigo"
      ? undefined
      : ({
          "--accent": `oklch(0.60 0.19 ${current.h})`,
          "--accent-hover": `oklch(0.66 0.18 ${current.h})`,
          "--accent-active": `oklch(0.55 0.19 ${current.h})`,
          "--accent-muted": `oklch(0.46 0.11 ${current.h})`,
          "--accent-tint": `color-mix(in oklab, var(--accent) 16%, transparent)`,
        } as CSSProperties);

  const clampZoom = (z: number) => Math.min(400, Math.max(25, z));

  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/ui_kits-desktop-showcase</span>
        <span className="crumbs"><span>maude</span><span>ui_kits</span><span>desktop</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen sc-specimen">
        <section className="specimen-title">
          <h1>The studio.</h1>
          <p className="lede">
            One instrument. The toolbar, the layers, the inspector and the status bar all
            share a single material — same hairlines, same radii, same quiet elevation — so
            nothing competes with the work. They frame a dotted infinite canvas you iterate on
            <em> with</em> an agent. The accent appears exactly three times: the primary
            action, the selected node, the active layer. Everything else is calm.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Surface</dt><dd>desktop · dark default</dd></div>
          <div><dt>Material</dt><dd>one · shared chrome</dd></div>
          <div><dt>Accent</dt><dd>single · one job</dd></div>
          <div><dt>Mono</dt><dd>first-class</dd></div>
        </dl>

        <h2 data-no>One cohesive instrument <span className="h2-aside">accent in context — one job per surface</span></h2>

        {/* ── The studio shell — cropmark-framed staging device ──────────────── */}
        <div className="sc-frame" style={accentVars}>
          <div className="sc-shell" aria-label="Maude studio">
            {/* TOP TOOLBAR */}
            <header className="sc-toolbar">
              <span className="sc-brand" role="img" aria-label="Maude">
                <span className="sc-mark">{Glyph.mark}</span>
                <span className="sc-wordmark">maude</span>
              </span>
              <span className="sc-file mono">untitled-2 · canvas</span>

              <span className="toolbar-sep" />
              <span className="seg sc-tools" role="group" aria-label="Tool">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={tool === t.id}
                    aria-label={t.label}
                    onClick={() => setTool(t.id)}
                    title={`${t.label} · ${t.kbd}`}
                  >
                    {t.glyph}
                  </button>
                ))}
              </span>

              <span className="toolbar-sep" />
              <span className="sc-zoom" role="group" aria-label="Zoom">
                <button className="btn btn--icon btn--sm" onClick={() => setZoom((z) => clampZoom(z - 25))} aria-label="Zoom out">{Glyph.zoomOut}</button>
                <button className="sc-zoom-val mono" onClick={() => setZoom(100)} aria-label="Reset zoom to 100%" title="Reset to 100%">{zoom}%</button>
                <button className="btn btn--icon btn--sm" onClick={() => setZoom((z) => clampZoom(z + 25))} aria-label="Zoom in">{Glyph.zoomIn}</button>
              </span>

              <span className="sc-spacer" />

              {/* presence: humans + the agent, anchored to a real label */}
              <span className="sc-presence" aria-label="Present">
                <span className="sc-avatar" title="you">YO</span>
                <span className="sc-avatar sc-avatar--peer" title="Rena">RN</span>
                <span className="presence-dot presence-dot--agent" title="agent" />
              </span>

              <button className="btn btn--sm">{Glyph.share}Share</button>
              <button className="btn btn--primary btn--sm">{Glyph.handoff}Hand off</button>
            </header>

            {/* LEFT — LAYERS TREE */}
            <nav className="sc-layers" aria-label="Layers">
              <div className="sc-panel-hd">{Glyph.layersGlyph}<span>Layers</span><span className="sc-count mono">{LAYERS.length}</span></div>
              <div className="sc-tree" role="tree" aria-label="Layers">
                {LAYERS.map((l) => (
                  <div
                    key={l.id}
                    className="tree-row sc-row"
                    role="treeitem"
                    tabIndex={0}
                    aria-selected={selected === l.id}
                    style={{ paddingLeft: `calc(var(--space-3) + ${l.depth} * var(--space-5))` }}
                    onClick={() => setSelected(l.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(l.id); }
                    }}
                  >
                    {l.depth === 0 && l.kind !== "text" ? <span className="sc-chev">{Glyph.chevron}</span> : <span className="sc-chev-spacer" />}
                    <span className="sc-row-glyph">{l.glyph}</span>
                    <span className="sc-row-label">{l.label}</span>
                    {l.id === "pricing" && <span className="presence-dot presence-dot--agent sc-row-agent" title="agent is editing" />}
                  </div>
                ))}
              </div>
            </nav>

            {/* CENTER — THE DOTTED CANVAS */}
            <div className="sc-canvas" aria-label="Canvas">
              {/* artboard 1 — Hero frame */}
              <div className="sc-artboard sc-art-hero">
                <span className="sc-art-tab mono">Hero · 960×540</span>
                <div className="sc-block sc-block--head" />
                <div className="sc-block sc-block--line" />
                <div className="sc-block sc-block--line short" />
              </div>

              {/* artboard 2 — Pricing card, the SELECTED node */}
              <div className="sc-artboard sc-art-pricing is-selected">
                <span className="sc-art-tab mono is-selected">Pricing · selected</span>
                <span className="sc-readout mono">x 248 · y 96 · w 168 · h 116</span>
                <div className="sc-node-bd">
                  <div className="sc-block sc-block--plan" />
                  <div className="sc-block sc-block--price" />
                  <div className="sc-cta">{Glyph.handoff}<span>Choose plan</span></div>
                </div>
                <span className="sc-handle tl" /><span className="sc-handle tr" />
                <span className="sc-handle bl" /><span className="sc-handle br" />
                <span className="sc-handle tm" /><span className="sc-handle bm" />
                <span className="sc-handle ml" /><span className="sc-handle mr" />

                {/* the AI agent presence cursor — anchored to THIS node's corner */}
                <span className="sc-agent" aria-label="Agent">
                  <span className="sc-agent-cursor">{Glyph.agent}</span>
                  <span className="sc-agent-lbl mono">agent · drafting</span>
                </span>
              </div>

              {/* artboard 3 — Footer group */}
              <div className="sc-artboard sc-art-footer">
                <span className="sc-art-tab mono">Footer · 960×120</span>
                <div className="sc-block sc-block--line short" />
                <div className="sc-block sc-block--line short" />
              </div>
            </div>

            {/* RIGHT — INSPECTOR */}
            <aside className="sc-insp" aria-label="Inspector">
              <div className="tabbar sc-insp-tabs" role="tablist" aria-label="Inspector view">
                {INSPECTOR_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="tab"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="sc-insp-bd">
                {tab === "Properties" && (
                  <>
                    <div className="sc-insp-sec">
                      <div className="sc-insp-sec-hd mono">Frame</div>
                      <div className="insp-row"><span className="insp-label">X</span><span className="insp-fields"><span className="field">248</span><span className="field">96</span></span></div>
                      <div className="insp-row"><span className="insp-label">W</span><span className="insp-fields"><span className="field">168</span><span className="field">116</span></span></div>
                      <div className="insp-row"><span className="insp-label">Rot</span><span className="insp-fields"><span className="field">0°</span></span></div>
                    </div>
                    <div className="sc-insp-sec">
                      <div className="sc-insp-sec-hd mono">Appearance</div>
                      <div className="insp-row"><span className="insp-label">Radius</span><span className="insp-fields"><span className="field">7</span></span></div>
                      <div className="insp-row"><span className="insp-label">Fill</span><span className="sc-fill-row"><span className="sc-swatch" /><span className="field sc-hex">bg-2</span></span></div>
                      <div className="insp-row"><span className="insp-label">Border</span><span className="sc-fill-row"><span className="sc-swatch sc-swatch--border" /><span className="field sc-hex">hairline</span></span></div>
                      <div className="insp-row"><span className="insp-label">CTA</span><span className="tag tag--accent">accent</span></div>
                    </div>
                  </>
                )}
                {tab === "Layout" && (
                  <div className="sc-insp-sec">
                    <div className="sc-insp-sec-hd mono">Auto layout</div>
                    <div className="insp-row"><span className="insp-label">Dir</span><span className="seg sc-mini-seg"><button aria-pressed={false}>→</button><button aria-pressed={true}>↓</button></span></div>
                    <div className="insp-row"><span className="insp-label">Gap</span><span className="insp-fields"><span className="field">12</span></span></div>
                    <div className="insp-row"><span className="insp-label">Pad</span><span className="insp-fields"><span className="field">16</span><span className="field">16</span></span></div>
                    <div className="insp-row"><span className="insp-label">Align</span><span className="insp-fields"><span className="field">center</span></span></div>
                  </div>
                )}
                {tab === "Tokens" && (
                  <div className="sc-insp-sec">
                    <div className="sc-insp-sec-hd mono">Bound tokens</div>
                    <div className="sc-token-row"><span className="sc-swatch sc-tk-bg" /><span className="mono">--bg-2</span><span className="sc-token-use">surface</span></div>
                    <div className="sc-token-row"><span className="sc-swatch sc-tk-border" /><span className="mono">--border-default</span><span className="sc-token-use">hairline</span></div>
                    <div className="sc-token-row"><span className="sc-swatch sc-tk-accent" /><span className="mono">--accent</span><span className="sc-token-use">CTA fill</span></div>
                    <div className="sc-token-row"><span className="sc-swatch sc-tk-radius" /><span className="mono">--radius-md</span><span className="sc-token-use">corner</span></div>
                  </div>
                )}

                <button className="btn sc-apply">{Glyph.handoff}Hand off node</button>
              </div>
            </aside>

            {/* BOTTOM — STATUS BAR */}
            <footer className="sc-status mono">
              <span className="sc-status-grp"><span className="presence-dot presence-dot--online" />synced · 19:42</span>
              <span className="sc-status-grp">{TOOLS.find((t) => t.id === tool)?.label.toLowerCase()} · {zoom}%</span>
              <span className="sc-spacer" />
              <span className="sc-status-grp">{LAYERS.length} nodes</span>
              <span className="sc-status-grp">x 248 y 96</span>
              <span className="sc-status-grp sc-status-ready"><span className="presence-dot presence-dot--agent" />handoff ready</span>
            </footer>
          </div>
        </div>

        {/* ── Read the instrument — what the chrome is doing ──────────────────── */}
        <div className="sc-legend">
          <div className="sc-legend-item">
            <span className="sc-legend-key" data-k="material" />
            <div><strong>One material</strong><p>Toolbar, layers, inspector, status — every surface is <code>--bg-1</code> on the same <code>--border-default</code> hairline. Cohesion is the identity.</p></div>
          </div>
          <div className="sc-legend-item">
            <span className="sc-legend-key" data-k="accent" />
            <div><strong>One accent, one job</strong><p>Indigo marks one thing per surface — the primary action, the current selection, the active tab. The agent gets its own violet so the machine never wears the accent. If your eye finds indigo first, the chrome overstepped.</p></div>
          </div>
          <div className="sc-legend-item">
            <span className="sc-legend-key" data-k="canvas" />
            <div><strong>The dotted canvas</strong><p>The deepest surface (<code>--bg-0</code>) carries the dot-grid. The work sits on it; the chrome frames it and stays quiet.</p></div>
          </div>
          <div className="sc-legend-item">
            <span className="sc-legend-key" data-k="mono" />
            <div><strong>Mono is first-class</strong><p>Coordinates, the file name, zoom, node counts — every number rides <code>--font-mono</code> with tabular figures. Developer-tool DNA.</p></div>
          </div>
        </div>

        <h2 data-no>The accent stays single <span className="h2-aside">retint the hue — the rule survives</span></h2>
        <p>
          The accent is one OKLCH hue with five derived tokens. Swap the hue and the whole
          studio retints in lockstep — but the <strong>discipline</strong> is unchanged: still
          one job per surface, still exactly three appearances. The accent is a signal, never a
          theme you sprinkle. Pick a hue and watch the frame above follow.
        </p>
        <div className="sc-accent-pick" role="group" aria-label="Accent hue">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              className="sc-accent-swatch"
              aria-pressed={accent === a.id}
              onClick={() => setAccent(a.id)}
              title={`${a.label} · oklch(${a.oklch})`}
              style={{ "--sw": `oklch(0.60 0.19 ${a.h})` } as CSSProperties}
            >
              <span className="sc-accent-chip" />
              <span className="sc-accent-meta"><span className="sc-accent-name">{a.label}</span><span className="mono sc-accent-oklch">{a.oklch}</span></span>
            </button>
          ))}
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/ui_kits-desktop-showcase</span>
          <span>one instrument · the canvas leads</span>
        </footer>
      </main>
    </>
  );
}
