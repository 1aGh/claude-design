/**
 * @canvas      components-keyboard — the .kbd keycap component, dissected.
 *              Demonstrates the keycap primitive at every size, single keys vs combos
 *              (chained .kbd with a "+" separator), keycap anatomy (the 2px bottom edge
 *              that reads as a physical key), and a mini keyboard map highlighting
 *              Maude's primary bindings — ⌘K palette, N frame, ? shortcuts. Mono,
 *              literal key names, no spelling-out. Static; no animation.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/components-keyboard — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-keyboard.css";

/* A combo chains .kbd keycaps with a visible "+" that is NOT part of the keycap. */
function Combo({ keys, size }: { keys: string[]; size?: "sm" | "lg" }) {
  const cls = "kbd" + (size ? " kbd--" + size : "");
  return (
    <span className="kb-combo">
      {keys.map((k, i) => (
        <span key={i}>
          {i > 0 && <span className="kb-plus" aria-hidden="true">+</span>}
          <span className={cls}>{k}</span>
        </span>
      ))}
    </span>
  );
}

const PRIMARY = [
  { label: "Command palette", keys: ["⌘", "K"], on: ["⌘", "K"] },
  { label: "New frame", keys: ["⌘", "N"], on: ["⌘", "N"] },
  { label: "Ask the agent", keys: ["⌘", "J"], on: ["⌘", "J"] },
  { label: "Hand off", keys: ["⌘", "⇧", "H"], on: ["⌘", "⇧", "H"] },
  { label: "Shortcuts", keys: ["?"], on: ["?"] },
  { label: "Deselect", keys: ["⎋"], on: ["⎋"] },
];

/* Mini keyboard map — three rows of a studio-relevant key cluster. The bound
 * keys (⌘ K N J H ?) light up in accent-tint. Layout dims may be px (frames). */
const MAP_ROWS: string[][] = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "?"],
  ["⇧", "Z", "X", "C", "V", "B", "N", "M", "⌥", "⌘"],
];
const BOUND = new Set(["⌘", "K", "N", "J", "H", "?", "⇧"]);

export default function ComponentsKeyboard() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-keyboard</span>
        <span className="crumbs"><span>maude</span><span>pro</span><span>keyboard</span></span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Keycaps.</h1>
          <p className="lede">
            The <code>.kbd</code> primitive — mono, a 2px bottom edge that reads as a real
            key, literal symbols never spelled out. <span className="kbd">⌘</span> not
            "Cmd", <span className="kbd">K</span> not "the K key". Single keys stand alone;
            combos chain with a visible <span className="mono">+</span> that lives outside
            the cap. This is keyboard-driven Maude, made legible.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Class</dt><dd>.kbd</dd></div>
          <div><dt>Sizes</dt><dd>sm · base · lg</dd></div>
          <div><dt>Edge</dt><dd>border-bottom 2px</dd></div>
          <div><dt>Type</dt><dd>mono · tabular</dd></div>
        </dl>

        <h2 data-no>Anatomy <span className="h2-aside">the 2px bottom edge is the tell</span></h2>
        <p>
          One keycap, marked up. The doubled bottom border is the whole illusion — it gives
          the cap a lit top face and a shadowed lip, so it reads as pressable without a
          gradient or a drop shadow. Tokens only: <code>--bg-2</code> face,
          <code> --border-default</code> edge, mono glyph.
        </p>
        <div className="kb-anatomy">
          <div className="kb-anatomy-stage">
            <span className="kbd kbd--lg kb-spot">K</span>
            <span className="kb-mark kb-mark--face">face · --bg-2</span>
            <span className="kb-mark kb-mark--edge">edge · 2px bottom border</span>
            <span className="kb-mark kb-mark--glyph">glyph · mono · --fg-1</span>
          </div>
          <ol className="kb-anatomy-legend mono">
            <li><span className="kb-num">1</span> radius — --radius-xs (mild)</li>
            <li><span className="kb-num">2</span> padding — 3px 6px (dense)</li>
            <li><span className="kb-num">3</span> bottom edge — 2px, the lip</li>
            <li><span className="kb-num">4</span> never an emoji glyph — IDE heritage</li>
          </ol>
        </div>

        <h2 data-no>Sizes <span className="h2-aside">sm · base · lg, one cap</span></h2>
        <p>
          Three sizes off one cap. Base is the default — inline in copy, in palette rows, in
          the shortcuts overlay. <code>lg</code> heroes a single binding; <code>sm</code>
          tucks into a dense table cell.
        </p>
        <div className="kb-sizes row">
          <span className="kb-size">
            <span className="kbd kbd--sm">⌫</span>
            <span className="kb-size-tag mono">sm · 9px</span>
          </span>
          <span className="kb-size">
            <span className="kbd">K</span>
            <span className="kb-size-tag mono">base · 11px</span>
          </span>
          <span className="kb-size">
            <span className="kbd kbd--lg">⌘</span>
            <span className="kb-size-tag mono">lg · 13px</span>
          </span>
        </div>

        <h2 data-no>Single keys &amp; combos <span className="h2-aside">+ lives outside the cap</span></h2>
        <p>
          Every modifier and special key is a single cap. A combo is just caps chained with
          a thin <span className="mono">+</span> — the separator is a sign, not a key, so it
          never wears the cap material.
        </p>
        <div className="kb-singles">
          <div className="kb-single-row">
            <span className="kb-single-lbl mono">modifiers</span>
            <span className="row" style={{ margin: 0 }}>
              <span className="kbd">⌘</span><span className="kbd">⇧</span>
              <span className="kbd">⌥</span><span className="kbd">⌃</span>
            </span>
          </div>
          <div className="kb-single-row">
            <span className="kb-single-lbl mono">specials</span>
            <span className="row" style={{ margin: 0 }}>
              <span className="kbd">⏎</span><span className="kbd">⎋</span>
              <span className="kbd">⌫</span><span className="kbd">⇥</span>
              <span className="kbd">␣</span>
            </span>
          </div>
          <div className="kb-single-row">
            <span className="kb-single-lbl mono">combos</span>
            <span className="row" style={{ margin: 0 }}>
              <Combo keys={["⌘", "K"]} />
              <Combo keys={["⌘", "⇧", "N"]} />
              <Combo keys={["⌃", "⌘", "F"]} />
            </span>
          </div>
        </div>

        <h2 data-no>Maude&apos;s primary bindings <span className="h2-aside">the map lights them up</span></h2>
        <p>
          A studio-relevant slice of the keyboard. The keys Maude binds — the palette, the
          frame, the agent, the hand off — glow in <code>--accent-tint</code>. Everything
          else stays the quiet cool-neutral material.
        </p>

        <div className="kb-map" aria-label="Keyboard map — Maude's primary bindings">
          {MAP_ROWS.map((rowKeys, ri) => (
            <div className="kb-map-row" key={ri}>
              {rowKeys.map((k, ki) => (
                <span
                  className={"kbd kb-cap" + (BOUND.has(k) ? " is-bound" : "")}
                  key={ki}
                >
                  {k}
                </span>
              ))}
            </div>
          ))}
        </div>

        <ul className="kb-key" aria-label="Primary bindings">
          {PRIMARY.map((b) => (
            <li className="kb-key-row" key={b.label}>
              <Combo keys={b.keys} />
              <span className="kb-key-lbl">{b.label}</span>
            </li>
          ))}
        </ul>

        <h2 data-no>In flowing copy <span className="h2-aside">inline, baseline-aligned</span></h2>
        <p className="kb-inline">
          Press <Combo keys={["⌘", "K"]} /> from anywhere to open the command palette. Use
          {" "}<span className="kbd">J</span> and <span className="kbd">K</span> to walk the
          results, <span className="kbd">⏎</span> to run the selected action, or
          {" "}<span className="kbd">⎋</span> to dismiss without choosing. Hand off a finished
          frame with <Combo keys={["⌘", "⇧", "H"]} />.
        </p>

        <footer className="specimen-ft">
          <span>MAUDE/components-keyboard</span>
          <span>.kbd · mono · literal symbols · no emoji</span>
        </footer>
      </main>
    </>
  );
}
