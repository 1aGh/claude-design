/**
 * SPECIMEN: components-buttons
 * DEMONSTRATES: .btn, .btn--primary/--ghost/--danger/--icon/--sm, .kbd,
 *   --accent (one job per surface), --bg-2..4, --fg-0..3, --border-default/strong,
 *   --radius-sm, --dur-soft, --ease-out
 * COMPOSITION: a real studio toolbar row (Share / Hand off →) leads, then the
 *   variant ladder, sizes + icon-only + kbd-hint, and a states matrix. ONE accent
 *   per cluster — the primary action is the only fill that carries indigo.
 * COPY VOICE: terse domain verbs — Hand off, Iterate, Duplicate frame, Delete node.
 * WHEN SCAFFOLDED: always (Core)
 * NOTES: every button transition is compositor-safe (color/background only on .btn;
 *   the icon nudge is transform). Reduced-motion handled by the --dur-* token collapse.
 *   Accent appears exactly ONCE per row — chrome must not out-shout the canvas.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-buttons.css";

/* 1px-stroke geometric glyphs — terminal/IDE heritage, never emoji. */
const Icon = {
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
  iterate: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8a5 5 0 1 1 1.6 3.7M3 12V8.5h3.5" />
    </svg>
  ),
  duplicate: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5.5" y="5.5" width="7" height="7" rx="1.5" /><path d="M9.5 3.5H4A1.5 1.5 0 0 0 2.5 5v5.5" />
    </svg>
  ),
  trash: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 4.5h9M6 4.5V3h4v1.5M5 4.5l.5 8h5l.5-8" />
    </svg>
  ),
  plus: (<svg className="g" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4v8M4 8h8" /></svg>),
  pen: (<svg className="g" viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3l2 2-7 7-2.6.6.6-2.6 7-7z" /></svg>),
  frame: (<svg className="g" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2v12M11 2v12M2 5h12M2 11h12" /></svg>),
};

const VARIANTS = [
  { cls: "btn btn--primary", label: "Hand off →", note: "the one accent — primary action" },
  { cls: "btn", label: "Duplicate frame", note: "default — neutral material" },
  { cls: "btn btn--ghost", label: "Rename", note: "ghost — invisible until touched" },
  { cls: "btn btn--danger", label: "Delete node", note: "danger — outlined, fills on hover" },
];

export default function ComponentsButtons() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-buttons</span>
        <span className="crumbs"><span>maude</span><span>components</span><span>buttons</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Buttons. One carries the accent.</h1>
          <p className="lede">
            Four roles, one rule: in any cluster the indigo fill marks the single
            primary action — never two. Default buttons wear the neutral material,
            ghost stays invisible until you reach for it, danger outlines and fills
            only on hover. Dense by default; the toolbar variant tightens further.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Roles</dt><dd>primary · default · ghost · danger</dd></div>
          <div><dt>Sizes</dt><dd>base · sm · icon (28px)</dd></div>
          <div><dt>Accent</dt><dd>1 per surface</dd></div>
          <div><dt>Radius</dt><dd>--radius-sm</dd></div>
        </dl>

        <h2 data-no>In the toolbar <span className="h2-aside">share · hand off →</span></h2>
        <p>
          The studio toolbar is where buttons live. The accent points at exactly one
          thing — hand off to production — while everything left of it stays calm
          neutral material. Count the indigo fills: one.
        </p>
        <div className="toolbar btn-toolbar" role="toolbar" aria-label="Canvas actions">
          <span className="tb-title">checkout · v3 — untitled frame</span>
          <span className="seg" role="group" aria-label="Tool">
            <button aria-pressed={true}>move</button>
            <button aria-pressed={false}>frame</button>
            <button aria-pressed={false}>pen</button>
          </span>
          <span className="tb-spacer" />
          <button className="btn btn--icon" aria-label="New frame">{Icon.plus}</button>
          <button className="btn btn--icon" aria-label="Duplicate">{Icon.duplicate}</button>
          <span className="toolbar-sep" aria-hidden="true" />
          <button className="btn btn--sm">{Icon.share}Share</button>
          <button className="btn btn--primary btn--sm">{Icon.handoff}Hand off →</button>
        </div>

        <h2 data-no>The four roles <span className="h2-aside">one accent per cluster</span></h2>
        <div className="btn-ladder">
          {VARIANTS.map((v) => (
            <div className="btn-rung" key={v.label}>
              <button className={v.cls}>{v.label}</button>
              <span className="rung-note">{v.note}</span>
            </div>
          ))}
        </div>

        <h2 data-no>Sizes, icons &amp; shortcuts <span className="h2-aside">base · sm · icon-only · kbd</span></h2>
        <div className="btn-shelf">
          <div className="shelf-cell">
            <span className="cell-cap">size</span>
            <div className="row" style={{ margin: 0 }}>
              <button className="btn btn--primary">{Icon.iterate}Iterate</button>
              <button className="btn btn--primary btn--sm">{Icon.iterate}Iterate</button>
            </div>
          </div>
          <div className="shelf-cell">
            <span className="cell-cap">icon-only · 28px</span>
            <div className="row" style={{ margin: 0 }}>
              <button className="btn btn--icon" aria-label="Pen">{Icon.pen}</button>
              <button className="btn btn--icon" aria-label="Frame">{Icon.frame}</button>
              <button className="btn btn--icon" aria-label="Duplicate">{Icon.duplicate}</button>
              <button className="btn btn--icon" aria-label="Delete node">{Icon.trash}</button>
            </div>
          </div>
          <div className="shelf-cell">
            <span className="cell-cap">with shortcut hint</span>
            <div className="row" style={{ margin: 0 }}>
              <button className="btn">Hand off <span className="kbd">⌘↵</span></button>
              <button className="btn btn--ghost">Inspector <span className="kbd">I</span></button>
            </div>
          </div>
        </div>

        <h2 data-no>States <span className="h2-aside">idle · hover · active · disabled</span></h2>
        <p>
          Hover lifts the surface one elevation step; active drops it; disabled fades
          to <code>--fg-3</code> with no hover affordance. The accent fill never disables
          to grey — a primary that can&apos;t fire just doesn&apos;t render.
        </p>
        <div className="btn-states">
          <div className="state-head" aria-hidden="true">
            <span /><span>idle</span><span>hover</span><span>active</span><span>disabled</span>
          </div>
          {[
            { label: "Primary", base: "btn btn--primary", hov: "btn btn--primary is-hover", act: "btn btn--primary is-active" },
            { label: "Default", base: "btn", hov: "btn is-hover", act: "btn is-active" },
            { label: "Ghost", base: "btn btn--ghost", hov: "btn btn--ghost is-hover", act: "btn btn--ghost is-active" },
            { label: "Danger", base: "btn btn--danger", hov: "btn btn--danger is-hover", act: "btn btn--danger is-active" },
          ].map((r) => (
            <div className="state-row" key={r.label}>
              <span className="state-label">{r.label}</span>
              <button className={r.base}>{r.label === "Danger" ? "Delete" : "Hand off"}</button>
              <button className={r.hov}>{r.label === "Danger" ? "Delete" : "Hand off"}</button>
              <button className={r.act}>{r.label === "Danger" ? "Delete" : "Hand off"}</button>
              <button className={r.base} disabled>{r.label === "Danger" ? "Delete" : "Hand off"}</button>
            </div>
          ))}
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-buttons</span>
          <span>one accent per surface · indigo 268</span>
        </footer>
      </main>
    </>
  );
}
