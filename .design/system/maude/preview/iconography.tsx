/**
 * @canvas      iconography — the thin-stroke geometric glyph set, re-curated to
 *              the maude canvas domain. ONE family, ONE stroke weight (1px),
 *              rounded caps + joins, terminal/IDE heritage. Demonstrates the
 *              constant 1px stroke on a 24-unit grid, the 16/20/24 size scale,
 *              currentColor inheritance, and the glyphs seated in a real toolbar.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/iconography — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import type { ReactNode } from "react";
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./iconography.css";

/* ── The set. Every glyph is authored on a 24×24 grid, fill:none, 1px stroke,
 * rounded caps + joins, color inherited from the parent via currentColor.
 * Re-curated to the maude domain: move · frame · pen · grab · zoom · command
 * · branch · layers · eye · lock · grid · node. NO emoji, ever. ────────────── */
type Glyph = { id: string; label: string; role: string; d: ReactNode };

const GLYPHS: Glyph[] = [
  {
    id: "move",
    label: "move",
    role: "select + nudge",
    d: <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />,
  },
  {
    id: "frame",
    label: "frame",
    role: "new artboard",
    d: <><path d="M7 3v18M17 3v18M3 7h18M3 17h18" /><rect x="7" y="7" width="10" height="10" rx="1" /></>,
  },
  {
    id: "pen",
    label: "pen",
    role: "vector path",
    d: <><path d="M5 19l3-1 11-11-2-2L6 16l-1 3Z" /><path d="M15 6l3 3" /></>,
  },
  {
    id: "grab",
    label: "hand",
    role: "pan the canvas",
    d: <path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11m0-1v-.5a1.5 1.5 0 0 1 3 0V11m0 0a1.5 1.5 0 0 1 3 0v3a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-3.5a1.5 1.5 0 0 1 2.5-1.5L8 13" />,
  },
  {
    id: "zoom",
    label: "zoom",
    role: "fit / scale view",
    d: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2M8.5 11h5M11 8.5v5" /></>,
  },
  {
    id: "command",
    label: "command",
    role: "command palette",
    d: <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z" />,
  },
  {
    id: "branch",
    label: "branch",
    role: "version / commit",
    d: <><circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="9" r="2.4" /><path d="M6 8.4v7.2M8 6.6h4a3 3 0 0 1 3 3v.6" /></>,
  },
  {
    id: "handoff",
    label: "hand off",
    role: "ship to code",
    d: <><path d="M3 12h13M11 7l5 5-5 5" /><path d="M19 4v16" /></>,
  },
  {
    id: "layers",
    label: "layers",
    role: "stacking order",
    d: <path d="M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17l9 5 9-5" />,
  },
  {
    id: "eye",
    label: "eye",
    role: "visibility",
    d: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  },
  {
    id: "lock",
    label: "lock",
    role: "lock layer",
    d: <><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><path d="M12 15v2" /></>,
  },
  {
    id: "node",
    label: "node",
    role: "artboard / element",
    d: <><rect x="4" y="4" width="16" height="16" rx="1.5" /><circle cx="4" cy="4" r="1.6" /><circle cx="20" cy="4" r="1.6" /><circle cx="4" cy="20" r="1.6" /><circle cx="20" cy="20" r="1.6" /></>,
  },
];

const SIZES = [24, 20, 16] as const;

function Icon({ d, size = 24 }: { d: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d}
    </svg>
  );
}

export default function Iconography() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/iconography</span>
        <span className="crumbs"><span>maude</span><span>foundation</span><span>icons</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Iconography. One stroke.</h1>
          <p className="lede">
            Thin-stroke geometric, drawn on a 24-unit grid at a constant <strong>1px stroke</strong>
            with rounded caps and joins — terminal and IDE heritage, not a marketing icon set.
            Twelve glyphs cover the canvas verbs: move, frame, pen, pan, zoom, command, branch,
            hand off, layers, visibility, lock, node. Color is never hardcoded — every glyph
            inherits <code>currentColor</code> from its parent, so it follows the chrome. No emoji.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Family</dt><dd>thin-stroke geometric (single)</dd></div>
          <div><dt>Stroke</dt><dd>1px · round cap · round join</dd></div>
          <div><dt>Grid</dt><dd>24 viewBox · sizes 24/20/16</dd></div>
          <div><dt>Color</dt><dd>currentColor (inherits fg)</dd></div>
        </dl>

        <h2 data-no>The grid &amp; the stroke <span className="h2-aside">why 1px holds together</span></h2>
        <p>
          One glyph blown up on its construction grid. The terminals snap to whole units and the
          1px stroke stays optically the same at every size — that constancy is what stops the set
          reading as a mix of borrowed icons.
        </p>
        <div className="ico-anatomy">
          <div className="ico-grid" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="ico-grid-svg" preserveAspectRatio="xMidYMid meet">
              {Array.from({ length: 23 }, (_, i) => i + 1).map((n) => (
                <line key={`v${n}`} x1={n} y1={0} x2={n} y2={24} className="ico-grid-line" />
              ))}
              {Array.from({ length: 23 }, (_, i) => i + 1).map((n) => (
                <line key={`h${n}`} x1={0} y1={n} x2={24} y2={n} className="ico-grid-line" />
              ))}
              <path
                d="M3 12l2-2 4 4 8-8 4 4"
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ico-grid-mark"
              />
            </svg>
          </div>
          <ul className="ico-anatomy-notes">
            <li><span className="mono">viewBox</span> 0 0 24 24 — one grid for the whole set</li>
            <li><span className="mono">stroke-width</span> 1 — never scaled, never doubled</li>
            <li><span className="mono">linecap / linejoin</span> round — soft terminals, no daggers</li>
            <li><span className="mono">fill</span> none — outline only; weight does the work</li>
          </ul>
        </div>

        <h2 data-no>The set <span className="h2-aside">twelve canvas verbs</span></h2>
        <div className="ico-set">
          {GLYPHS.map((g) => (
            <figure className="ico-tile" key={g.id}>
              <div className="ico-tile-glyph"><Icon d={g.d} /></div>
              <figcaption>
                <strong>{g.label}</strong>
                <span className="ico-role">{g.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <h2 data-no>Size scale <span className="h2-aside">24 · 20 · 16, one stroke</span></h2>
        <p>
          The three UI sizes. Sixteen is the inspector / dense-toolbar unit, twenty the comfortable
          default, twenty-four the touch-of-emphasis. The stroke does not thicken with the icon.
        </p>
        <div className="ico-scale">
          {GLYPHS.slice(0, 5).map((g) => (
            <div className="ico-scale-row" key={g.id}>
              {SIZES.map((s) => (
                <div className="ico-scale-cell" key={s}>
                  <Icon d={g.d} size={s} />
                  <span className="ico-scale-px mono">{s}</span>
                </div>
              ))}
              <span className="ico-scale-name">{g.label}</span>
            </div>
          ))}
        </div>

        <h2 data-no>In the toolbar <span className="h2-aside">glyphs seated in chrome</span></h2>
        <p>
          The same glyphs in their habitat — the canvas toolbar. They take their color from the
          control: muted on rest, foreground on the active tool, accent-fg only inside the one
          primary action. The accent never lands on more than a single button.
        </p>
        <div className="ico-toolbar-wrap">
          <div className="toolbar" role="toolbar" aria-label="Canvas tools">
            <span className="toolbar-group seg" role="group" aria-label="Pointer">
              <button aria-pressed={true} title="Move" className="ico-toolbtn"><Icon d={GLYPHS[0].d} size={16} /></button>
              <button aria-pressed={false} title="Hand" className="ico-toolbtn"><Icon d={GLYPHS[3].d} size={16} /></button>
            </span>
            <span className="toolbar-sep" />
            <span className="toolbar-group seg" role="group" aria-label="Shapes">
              <button aria-pressed={false} title="Frame" className="ico-toolbtn"><Icon d={GLYPHS[1].d} size={16} /></button>
              <button aria-pressed={false} title="Pen" className="ico-toolbtn"><Icon d={GLYPHS[2].d} size={16} /></button>
              <button aria-pressed={false} title="Node" className="ico-toolbtn"><Icon d={GLYPHS[11].d} size={16} /></button>
            </span>
            <span className="toolbar-sep" />
            <span className="toolbar-group seg" role="group" aria-label="View">
              <button aria-pressed={false} title="Zoom" className="ico-toolbtn"><Icon d={GLYPHS[4].d} size={16} /></button>
              <button aria-pressed={false} title="Layers" className="ico-toolbtn"><Icon d={GLYPHS[8].d} size={16} /></button>
            </span>
            <span className="ico-toolbar-spacer" />
            <button className="btn btn--sm" title="Command palette">
              <Icon d={GLYPHS[5].d} size={16} /> <span className="kbd">⌘K</span>
            </button>
            <button className="btn btn--primary btn--sm" title="Hand off to code">
              <Icon d={GLYPHS[7].d} size={16} /> Hand off
            </button>
          </div>
        </div>

        <div className="callout callout--info ico-callout">
          <Icon d={GLYPHS[9].d} size={16} />
          <span>
            Glyphs ship as inline JSX with <code>stroke="currentColor"</code> — never
            <code>{'<img src="…">'}</code>, never a hardcoded stroke hue. Recolor by changing the
            parent <code>color</code>, the way every chrome control already does.
          </span>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/iconography</span>
          <span>thin-stroke geometric · 1px · 12 glyphs · no emoji</span>
        </footer>
      </main>
    </>
  );
}
