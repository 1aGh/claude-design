/**
 * @canvas      colors-themes-side-by-side — dark + light, equal status, at once.
 *              Demonstrates the theme contract: the SAME studio frame rendered
 *              in both themes simultaneously via nested
 *              .maude[data-theme="dark"] / [data-theme="light"] wrappers.
 *              Only the tokens change — identical markup, identical structure.
 *              Dark is the default (studio); light is an equal-status secondary
 *              (reading / handoff), not an afterthought.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/colors-themes-side-by-side — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN: theme-both-side-by-side
 * DEMONSTRATES: dark + light rendered side-by-side, same UI in both, the
 * theme-switch token contract.
 * NOTES: colors_and_type.css gates its theme blocks on
 * `.maude[data-theme="…"]`, so each pane wrapper carries BOTH the
 * `maude` class AND its own `data-theme`. That's what lets both themes
 * show on one page regardless of the document-root toggle. If a component
 * renders differently across panes beyond color, it's a token-resolution bug,
 * not per-theme design.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./colors-themes-side-by-side.css";

/** The studio frame — one component, rendered identically into both theme panes. */
function StudioFrame() {
  return (
    <div className="th-studio">
      <div className="th-toolbar">
        <span className="th-title mono">untitled · canvas</span>
        <span className="seg" role="group" aria-label="Tool">
          <button aria-pressed={true}>move</button>
          <button aria-pressed={false}>frame</button>
        </span>
        <span className="th-spacer" />
        <span className="presence-dot presence-dot--agent" title="AI agent" />
        <button className="btn btn--primary btn--sm">Hand off →</button>
      </div>

      <nav className="th-layers" aria-label="Layers">
        <div className="tree-row" aria-selected="true">Frame · Hero</div>
        <div className="tree-row">Card · Pricing</div>
        <div className="tree-row">Text · Headline</div>
      </nav>

      <div className="th-canvas">
        <span className="th-readout mono">x 248 · y 96</span>
        <div className="th-node">Frame · Hero</div>
      </div>
    </div>
  );
}

export default function ColorsThemesSideBySide() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/colors-themes-side-by-side</span>
        <span className="crumbs"><span>maude</span><span>color</span><span>themes</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Themes. Two surfaces, one truth.</h1>
          <p className="lede">
            Dark is the studio default — the canvas-browser surface you live in. Light is its
            equal — built for reading and hand-off, not bolted on. Here the same studio frame
            renders in both at once. The markup is identical in both panes; only the tokens
            differ. Scan them side by side: if anything but color changes between the two,
            that's a token-resolution bug, not a per-theme design.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Default</dt><dd>dark · studio</dd></div>
          <div><dt>Secondary</dt><dd>light · equal status</dd></div>
          <div><dt>Shared</dt><dd>one token shape</dd></div>
          <div><dt>Accent</dt><dd>indigo 268, both</dd></div>
        </dl>

        <h2 data-no>Same frame, both themes <span className="h2-aside">nested data-theme wrappers</span></h2>
        <p>
          Each pane is wrapped in its own <code>.maude[data-theme]</code> scope, so both
          themes resolve on this single page no matter how the header toggle is set. The frame
          component is rendered twice with zero per-pane overrides — the cascade carries
          everything.
        </p>
        <div className="th-panes">
          {/* dark pane — own theme scope, independent of the document root */}
          <section className="th-pane maude" data-theme="dark" aria-label="Dark theme">
            <div className="th-pane-hd">
              <span className="th-pane-name">Dark</span>
              <span className="th-pane-tag mono">default · studio</span>
            </div>
            <StudioFrame />
          </section>

          {/* light pane — own theme scope, independent of the document root */}
          <section className="th-pane maude" data-theme="light" aria-label="Light theme">
            <div className="th-pane-hd">
              <span className="th-pane-name">Light</span>
              <span className="th-pane-tag mono">equal · handoff</span>
            </div>
            <StudioFrame />
          </section>
        </div>

        <h2 data-no>Token deltas <span className="h2-aside">what actually moves</span></h2>
        <p>
          The same token, two values. Surfaces flip from a deep cool-neutral floor to a clean
          near-white; the accent <em>deepens</em> in light to hold contrast against bright
          surfaces. Everything else is the cascade resolving the same names.
        </p>
        <div className="th-deltas">
          <div className="th-delta-row th-delta-hd">
            <span className="mono">token</span>
            <span className="mono">dark</span>
            <span className="mono">light</span>
          </div>
          <div className="th-delta-row">
            <span className="mono th-tok">--bg-0</span>
            <span className="th-cell"><span className="th-dot" data-pane="dark" style={{ background: "oklch(0.165 0.012 255)" }} /><span className="mono">0.165 0.012 255</span></span>
            <span className="th-cell"><span className="th-dot th-dot--bord" data-pane="light" style={{ background: "oklch(0.975 0.004 255)" }} /><span className="mono">0.975 0.004 255</span></span>
          </div>
          <div className="th-delta-row">
            <span className="mono th-tok">--fg-0</span>
            <span className="th-cell"><span className="th-dot th-dot--bord" style={{ background: "oklch(0.955 0.005 250)" }} /><span className="mono">0.955 0.005 250</span></span>
            <span className="th-cell"><span className="th-dot" style={{ background: "oklch(0.225 0.015 260)" }} /><span className="mono">0.225 0.015 260</span></span>
          </div>
          <div className="th-delta-row">
            <span className="mono th-tok">--accent</span>
            <span className="th-cell"><span className="th-dot" style={{ background: "oklch(0.600 0.190 268)" }} /><span className="mono">0.600 0.190 268</span></span>
            <span className="th-cell"><span className="th-dot" style={{ background: "oklch(0.520 0.195 268)" }} /><span className="mono">0.520 0.195 268 · deeper</span></span>
          </div>
        </div>

        <div className="callout callout--info th-note">
          <span className="mono">contract</span>
          <span>
            Both panes pull the same <code>var(--*)</code> names — only the OKLCH values behind
            them differ, declared once in <code>colors_and_type.css</code>. No component carries
            a per-theme override. To re-check a new component across themes, drop it into both
            panes and confirm only its color moves.
          </span>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/colors-themes-side-by-side</span>
          <span>dark default · light equal · one token shape</span>
        </footer>
      </main>
    </>
  );
}
