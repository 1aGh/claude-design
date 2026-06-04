/**
 * @canvas      type-mono — SIGNATURE — mono as a first-class citizen. JetBrains /
 *              Geist Mono carries coordinate readouts, inspector fields, tabular
 *              numerics, part-numbers, command lines — the developer-tool DNA, not
 *              relegated to code blocks. Proves tabular-nums column alignment.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/type-mono — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./type-mono.css";

/* The roles mono owns in the studio — each a real string, never Lorem. */
const ROLES = [
  { label: "Part-number", demo: <span className="mono">MAUDE/type-mono · rev 04 · 2026-06-03</span> },
  { label: "Coordinates", demo: <span className="mono mn-coord">x 248&nbsp;&nbsp;y 96&nbsp;&nbsp;w 168&nbsp;&nbsp;h 116</span> },
  { label: "Hash / node id", demo: <span className="mono">node 7a3e-9f1c · sha 0x4f8a2c · v0.28.1</span> },
  { label: "Timestamp", demo: <span className="mono">19:42:08.103 · saved 4s ago</span> },
  { label: "Keyboard", demo: <span><kbd className="kbd">⌘</kbd> <kbd className="kbd">K</kbd> opens the command palette</span> },
  { label: "Path", demo: <span className="mono">.design/system/maude/colors_and_type.css</span> },
] as const;

/* Coordinate table — proves tabular-nums: every digit shares a cell width, so
 * the decimal point and right edge line up frame to frame. */
const NODES = [
  { name: "Frame · Hero", x: 0, y: 0, w: 1440, h: 900 },
  { name: "Card · Pricing", x: 248, y: 96, w: 168, h: 116 },
  { name: "Text · Headline", x: 32, y: 8, w: 384, h: 40 },
  { name: "Group · Footer", x: 0, y: 812, w: 1440, h: 88 },
] as const;

export default function TypeMono() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/type-mono</span>
        <span className="crumbs"><span>maude</span><span>type</span><span>mono</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Mono is first-class.</h1>
          <p className="lede">
            This is not a code-block face exiled to a snippet — <em>JetBrains&nbsp;Mono</em>
            is structural. It carries every part-number, every coordinate readout, every
            inspector field, every tabular column in the studio. When a thing looks like
            data, it&apos;s set in mono. That&apos;s the terminal-and-IDE heritage, worn
            on the surface.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Family</dt><dd>JetBrains / Geist Mono</dd></div>
          <div><dt>Figures</dt><dd>tabular-nums</dd></div>
          <div><dt>Set on</dt><dd>.mono · .field · code</dd></div>
          <div><dt>Body size</dt><dd>0.92em (reads denser)</dd></div>
        </dl>

        <h2 data-no>The coordinate readout <span className="h2-aside">the signature unit</span></h2>
        <p>
          When you grab a node, the canvas speaks in mono: a live HUD pinned to the
          selection, and the inspector fields that mirror it. Both are tabular, so a digit
          never shifts the layout as values tick.
        </p>
        <div className="mn-stage" aria-label="Canvas — coordinate readout">
          <div className="mn-node">
            <span className="mn-readout">x 248&nbsp;·&nbsp;y 96</span>
            Card · Pricing
            <span className="mn-handle tl" /><span className="mn-handle tr" />
            <span className="mn-handle bl" /><span className="mn-handle br" />
          </div>
          <aside className="mn-insp" aria-label="Inspector">
            <span className="mn-insp-hd">Properties</span>
            <div className="insp-row"><span className="insp-label">X · Y</span><span className="insp-fields"><span className="field">248</span><span className="field">96</span></span></div>
            <div className="insp-row"><span className="insp-label">Size</span><span className="insp-fields"><span className="field">168</span><span className="field">116</span></span></div>
            <div className="insp-row"><span className="insp-label">Angle</span><span className="insp-fields"><span className="field">0°</span></span></div>
          </aside>
        </div>

        <h2 data-no>The roles mono owns <span className="h2-aside">data, never prose</span></h2>
        <p>
          Mono is role-typed — it never carries body copy (it reads slower), but it owns
          everything that wants alignment, exactness, or a machine&apos;s authorship.
        </p>
        <div className="mn-roles">
          {ROLES.map((r) => (
            <div className="mn-role" key={r.label}>
              <span className="mn-role-label">{r.label}</span>
              <span className="mn-role-demo">{r.demo}</span>
            </div>
          ))}
        </div>

        <h2 data-no>Tabular alignment <span className="h2-aside">columns that hold</span></h2>
        <p>
          The proof: a coordinate table for the whole layer tree. Because the figures are
          tabular, the four numeric columns are dead-straight — right-aligned, decimal under
          decimal, regardless of digit count. This is why the inspector never twitches.
        </p>
        <div className="mn-table" role="table" aria-label="Layer coordinates">
          <div className="mn-tr mn-th" role="row">
            <span role="columnheader">Layer</span>
            <span role="columnheader" className="num">X</span>
            <span role="columnheader" className="num">Y</span>
            <span role="columnheader" className="num">W</span>
            <span role="columnheader" className="num">H</span>
          </div>
          {NODES.map((n) => (
            <div className="mn-tr" role="row" key={n.name}>
              <span role="cell" className="mn-name">{n.name}</span>
              <span role="cell" className="num">{n.x}</span>
              <span role="cell" className="num">{n.y}</span>
              <span role="cell" className="num">{n.w}</span>
              <span role="cell" className="num">{n.h}</span>
            </div>
          ))}
        </div>

        <h2 data-no>A command line <span className="h2-aside">terminal heritage, on the surface</span></h2>
        <p>
          And where the tool meets the shell, mono is simply the native voice — a prompt,
          a flag, an exit code. No styling tricks; the face does the work.
        </p>
        <div className="mn-term" aria-label="Terminal — handoff">
          <div className="mn-term-line"><span className="mn-prompt">›</span> maude design handoff <span className="mn-flag">--registry</span></div>
          <div className="mn-term-out">→ wrote registry-item.json · 3 artboards · 14 tokens</div>
          <div className="mn-term-line mn-term-idle"><span className="mn-prompt">›</span><span className="mn-caret" /></div>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/type-mono</span>
          <span>jetbrains mono · tabular-nums · first-class</span>
        </footer>
      </main>
    </>
  );
}
