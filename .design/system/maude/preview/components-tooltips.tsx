/**
 * @canvas      components-tooltips — tooltips + a popover, every one anchored to a
 *              SPECIFIC toolbar control, never floating over canvas void. Tooltips
 *              are single-line hints with a .kbd shortcut; the popover carries richer,
 *              interactive content (an alignment menu). Soft reveal via .motion-soft
 *              (opacity only, bounded). Tooltips augment labeled controls — never the
 *              only place essential info lives.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/components-tooltips — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN (from template): 4 placement variants (top / right / bottom / left) +
 * a popover with richer content. Tooltip = one short phrase, no period. Popover =
 * headline + 1–2 sentences + interactive content. Tooltips augment, never replace,
 * a label — keyboard users must not be required to read one.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-tooltips.css";
import type { ReactNode } from "react";

export default function ComponentsTooltips() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-tooltips</span>
        <span className="crumbs"><span>maude</span><span>component</span><span>tooltips</span></span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Tooltips. Anchored, never afloat.</h1>
          <p className="lede">
            A tooltip hangs off the control it explains — a toolbar button, a layer row,
            never a pin floating over empty canvas. One short phrase, a <code>.kbd</code>
            shortcut, no period. A popover does the heavier lifting: a headline and
            interactive content, summoned by click. Both reveal soft, opacity only.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Tooltip</dt><dd>one phrase · + kbd</dd></div>
          <div><dt>Popover</dt><dd>headline · interactive</dd></div>
          <div><dt>Reveal</dt><dd>soft · 120ms · opacity</dd></div>
          <div><dt>Delay</dt><dd>~400ms hover / on focus</dd></div>
        </dl>

        {/* ── Placement — four tooltips, each off a real toolbar button ── */}
        <h2 data-no>Placement <span className="h2-aside">each off a toolbar button</span></h2>
        <p>
          The studio toolbar. Every glyph is a labeled control; the tooltip restates the
          name and adds the shortcut. Placement flips to whichever side has room — here we
          show all four anchored to the buttons that own them.
        </p>

        <div className="tt-toolbar-wrap">
          <div className="toolbar" role="toolbar" aria-label="Canvas tools">
            <div className="toolbar-group">
              <Tip side="top" label="Move" kbd="V">
                <button className="btn btn--icon" aria-label="Move"><MoveGlyph /></button>
              </Tip>
              <Tip side="bottom" label="Frame" kbd="F">
                <button className="btn btn--icon" aria-label="Frame"><FrameGlyph /></button>
              </Tip>
            </div>
            <span className="toolbar-sep" />
            <div className="toolbar-group">
              <Tip side="left" label="Hand off to production" kbd="⌘↵">
                <button className="btn btn--icon" aria-label="Hand off"><HandoffGlyph /></button>
              </Tip>
              <Tip side="right" label="Show layers panel" kbd="⌘\">
                <button className="btn btn--icon" aria-label="Layers"><LayersGlyph /></button>
              </Tip>
            </div>
          </div>
        </div>

        <p className="tt-aside mono">
          ↑ tooltips render at rest here for the specimen — in product they wait ~400ms
          on hover or appear immediately on keyboard focus.
        </p>

        {/* ── Tooltip on a layer row — proves "anchored to content" ── */}
        <h2 data-no>On a row <span className="h2-aside">augments, never replaces</span></h2>
        <p>A tooltip can explain a truncated layer name, but the row already carries the label — the tooltip is extra, not the only source of truth.</p>
        <nav className="tt-layers panel" aria-label="Layers">
          <div className="panel-bd" style={{ padding: "var(--space-2)" }}>
            <div className="tree-row">Frame · Hero</div>
            <Tip side="right" label="Pricing card — synced 2m ago" inline>
              <div className="tree-row" aria-selected="true">Card · Pricing</div>
            </Tip>
            <div className="tree-row">Text · Headline</div>
          </div>
        </nav>

        {/* ── Popover — richer, interactive, anchored to a specific button ── */}
        <h2 data-no>Popover <span className="h2-aside">richer · interactive · click-summoned</span></h2>
        <p>When a hint needs choices, it graduates to a popover. This one hangs off the <strong>Align</strong> toolbar button and stays put until you pick — a tooltip never holds controls.</p>

        <div className="tt-pop-wrap">
          <div className="tt-host tt-host--pop">
            <button className="btn" aria-expanded="true" aria-controls="align-pop">
              <AlignGlyph /> Align <span className="kbd">A</span>
            </button>
            <div className="panel tt-popover motion-soft" id="align-pop" role="dialog" aria-label="Align selection">
              <div className="panel-hd"><span>Align selection</span></div>
              <div className="panel-bd">
                <p className="tt-pop-body">Snap the selected nodes to a shared edge or center on the canvas.</p>
                <div className="tt-pop-grid" role="group" aria-label="Alignment">
                  <button className="btn btn--sm">Left</button>
                  <button className="btn btn--sm btn--primary">Center</button>
                  <button className="btn btn--sm">Right</button>
                  <button className="btn btn--sm">Top</button>
                  <button className="btn btn--sm">Middle</button>
                  <button className="btn btn--sm">Bottom</button>
                </div>
                <div className="tt-pop-foot">
                  <span className="mono">distribute</span>
                  <span><span className="kbd">⌥</span> <span className="kbd">A</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="callout callout--info tt-note">
          <span className="mono">i</span>
          <p style={{ margin: 0 }}>
            Never make a tooltip the <em>only</em> home for essential info — a keyboard user
            tabbing through the toolbar shouldn't have to read a hover hint to know what a
            button does. The <code>aria-label</code> on each control is the source of truth;
            the tooltip just restates it and adds the shortcut.
          </p>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-tooltips</span>
          <span>tooltip + popover · anchored · soft reveal</span>
        </footer>
      </main>
    </>
  );
}

/* ── Tooltip wrapper — wraps any control, anchors a hint to a placement side ── */
function Tip(props: {
  side: "top" | "right" | "bottom" | "left";
  label: string;
  kbd?: string;
  inline?: boolean;
  children: ReactNode;
}) {
  const { side, label, kbd, inline, children } = props;
  return (
    <span className={`tt-host${inline ? " tt-host--inline" : ""}`}>
      {children}
      <span className={`tt-tip tt-tip--${side} motion-soft`} role="tooltip">
        {label}
        {kbd && <span className="kbd tt-kbd">{kbd}</span>}
        <span className="tt-arrow" aria-hidden="true" />
      </span>
    </span>
  );
}

/* ── 1px-stroke geometric glyphs — terminal/IDE heritage, no emoji ── */
function MoveGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M7 1.5 V12.5 M1.5 7 H12.5 M7 1.5 L5 3.5 M7 1.5 L9 3.5 M7 12.5 L5 10.5 M7 12.5 L9 10.5 M1.5 7 L3.5 5 M1.5 7 L3.5 9 M12.5 7 L10.5 5 M12.5 7 L10.5 9" />
    </svg>
  );
}
function FrameGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M3.5 1.5 V12.5 M10.5 1.5 V12.5 M1.5 3.5 H12.5 M1.5 10.5 H12.5" />
    </svg>
  );
}
function HandoffGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <rect x="1.5" y="2.5" width="6" height="6" rx="1" />
      <path d="M7 5.5 H12 M10 3.5 L12 5.5 L10 7.5" />
      <path d="M1.5 11 H12.5" strokeDasharray="1 2" />
    </svg>
  );
}
function LayersGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M7 1.5 L12.5 4.5 L7 7.5 L1.5 4.5 Z" />
      <path d="M1.5 7.5 L7 10.5 L12.5 7.5" />
    </svg>
  );
}
function AlignGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M6.5 1 V12" />
      <rect x="2" y="3" width="9" height="2.4" rx="0.6" />
      <rect x="3.5" y="7.6" width="6" height="2.4" rx="0.6" />
    </svg>
  );
}
