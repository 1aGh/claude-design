/**
 * @canvas      components-shortcuts-overlay — the ? cheat-sheet over the canvas.
 *              Demonstrates the on-demand keyboard reference: a dim scrim, the shared
 *              panel material, and grouped shortcuts in dense mono columns —
 *              Canvas / Selection / Agent / View. The label never repeats the key;
 *              every binding is a .kbd combo. Calm, dense, discoverable on ? then gone.
 *              Bounded compositor-only reveal; reduced-motion via token collapse.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/components-shortcuts-overlay — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-shortcuts-overlay.css";

type Row = { label: string; keys: string[][] }; // keys = combos; each combo a key list

const SECTIONS: { head: string; agent?: boolean; rows: Row[] }[] = [
  {
    head: "Canvas",
    rows: [
      { label: "Command palette", keys: [["⌘", "K"]] },
      { label: "New frame", keys: [["⌘", "N"]] },
      { label: "New artboard", keys: [["⌘", "⇧", "N"]] },
      { label: "Pan", keys: [["space"], ["drag"]] },
      { label: "Zoom to fit", keys: [["⇧", "1"]] },
      { label: "Snap to grid", keys: [["⌘", "'"]] },
    ],
  },
  {
    head: "Selection",
    rows: [
      { label: "Select all in frame", keys: [["⌘", "A"]] },
      { label: "Duplicate node", keys: [["⌘", "D"]] },
      { label: "Group", keys: [["⌘", "G"]] },
      { label: "Nudge", keys: [["←"], ["→"], ["↑"], ["↓"]] },
      { label: "Send to inspector", keys: [["I"]] },
      { label: "Deselect", keys: [["⎋"]] },
    ],
  },
  {
    head: "Agent",
    agent: true,
    rows: [
      { label: "Ask the agent", keys: [["⌘", "J"]] },
      { label: "Accept draft", keys: [["⌘", "⏎"]] },
      { label: "Reject draft", keys: [["⌘", "⌫"]] },
      { label: "Iterate on selection", keys: [["⌘", "⇧", "J"]] },
      { label: "Hand off to production", keys: [["⌘", "⇧", "H"]] },
    ],
  },
  {
    head: "View",
    rows: [
      { label: "Toggle layers", keys: [["⌘", "1"]] },
      { label: "Toggle inspector", keys: [["⌘", "2"]] },
      { label: "Toggle theme", keys: [["⌘", "⇧", "L"]] },
      { label: "Toggle grid", keys: [["⌘", "."]] },
      { label: "Full screen", keys: [["⌃", "⌘", "F"]] },
    ],
  },
];

function Combos({ keys }: { keys: string[][] }) {
  return (
    <span className="so-combos">
      {keys.map((combo, ci) => (
        <span className="so-combo" key={ci}>
          {ci > 0 && <span className="so-or">/</span>}
          {combo.map((k, ki) => (
            <span className="kbd" key={ki}>{k}</span>
          ))}
        </span>
      ))}
    </span>
  );
}

export default function ComponentsShortcutsOverlay() {
  const total = SECTIONS.reduce((n, s) => n + s.rows.length, 0);
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-shortcuts-overlay</span>
        <span className="crumbs"><span>maude</span><span>pro</span><span>shortcuts</span></span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Shortcuts. On demand.</h1>
          <p className="lede">
            Press <span className="kbd">?</span> from anywhere — the whole keyboard surface,
            grouped and dense, then gone. A pro wants this on tap, not pinned in a sidebar
            taking weight all day. Same panel material as every other surface; the label
            states the verb, the <span className="kbd">⌘</span> combo states how.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Trigger</dt><dd>? · from anywhere</dd></div>
          <div><dt>Groups</dt><dd>Canvas · Selection · Agent · View</dd></div>
          <div><dt>Keycap</dt><dd>.kbd · mono</dd></div>
          <div><dt>Dismiss</dt><dd>esc</dd></div>
        </dl>

        <h2 data-no>The overlay <span className="h2-aside">? · scrim · four columns</span></h2>
        <p>
          Four columns over a dim scrim. Density is the point — the whole map fits one
          glance. The agent column wears its own presence hue header so it reads as the
          collaborator it is.
        </p>

        <div className="so-stage canvas" aria-label="Shortcuts overlay over the canvas">
          <span className="so-scrim" />
          <div className="so-overlay" role="dialog" aria-label="Keyboard shortcuts" aria-modal="true">
            <div className="so-overlay-hd">
              <span className="so-title">Keyboard shortcuts</span>
              <span className="so-trigger mono">press <span className="kbd">?</span> to open</span>
            </div>

            <div className="so-columns">
              {SECTIONS.map((s) => (
                <section className={"so-section" + (s.agent ? " so-section--agent" : "")} key={s.head}>
                  <h3 className="so-section-hd">{s.head}</h3>
                  <dl className="so-list">
                    {s.rows.map((r) => (
                      <div className="so-pair" key={r.label}>
                        <dt>{r.label}</dt>
                        <dd><Combos keys={r.keys} /></dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>

            <div className="so-overlay-ft">
              <span className="mono">close with <span className="kbd">⎋</span></span>
              <span className="so-count mono">{total} bindings · 4 groups</span>
            </div>
          </div>
        </div>

        <h2 data-no>Reading a pair <span className="h2-aside">verb left · binding right</span></h2>
        <p>
          Every row is the same contract: the verb on the left in body type, the binding
          on the right as <span className="kbd">⌘</span><span className="kbd">D</span>. When
          two keys do the same thing, a thin <span className="mono">/</span> separates the
          alternatives — never crowd them together.
        </p>
        <div className="so-legend">
          <dl className="so-list">
            <div className="so-pair">
              <dt>Single key</dt>
              <dd><Combos keys={[["?"]]} /></dd>
            </div>
            <div className="so-pair">
              <dt>Modifier combo</dt>
              <dd><Combos keys={[["⌘", "⇧", "H"]]} /></dd>
            </div>
            <div className="so-pair">
              <dt>Either of two</dt>
              <dd><Combos keys={[["space"], ["drag"]]} /></dd>
            </div>
          </dl>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-shortcuts-overlay</span>
          <span>? · dense · calm · gone on esc</span>
        </footer>
      </main>
    </>
  );
}
