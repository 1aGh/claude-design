/**
 * SPECIMEN: components-inputs
 * DEMONSTRATES: .input, .select, .textarea, .field (mono tabular coordinate input),
 *   the focus ring (accent border + 3px --accent-tint halo), --bg-3, --fg-0..3,
 *   --border-default/strong, --status-error, --radius-sm/xs, --dur-soft
 * COMPOSITION: a labelled-field stack (idle · focus · error · disabled), textarea +
 *   select, then a mini inspector row of tabular .field coordinate inputs (X/Y/W/H/∠).
 *   The focus treatment is the signature: accent border + a soft accent-tint halo.
 * COPY VOICE: real studio labels — Canvas name, Hand-off note, Frame role — never "Enter text".
 * WHEN SCAFFOLDED: always (Core)
 * NOTES: focus ring is border-color + box-shadow halo (NOT an outline that masks the
 *   border). Error colors border + helper. The .field coordinate cell is mono/tabular —
 *   the inspector's native unit. All transitions are color/box-shadow only.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-inputs.css";

export default function ComponentsInputs() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-inputs</span>
        <span className="crumbs"><span>maude</span><span>components</span><span>inputs</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Inputs. The ring is the tell.</h1>
          <p className="lede">
            Labels above, helper below — never inside the field. On focus the border
            turns indigo and a soft accent-tint halo blooms around it: present, calm,
            never an outline that masks the edge. Coordinate fields drop to mono,
            tabular figures — the inspector&apos;s native unit.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Controls</dt><dd>input · select · textarea · field</dd></div>
          <div><dt>Focus</dt><dd>accent border + tint halo</dd></div>
          <div><dt>Surface</dt><dd>--bg-3</dd></div>
          <div><dt>Error</dt><dd>--status-error</dd></div>
        </dl>

        <h2 data-no>States <span className="h2-aside">idle · focus · error · disabled</span></h2>
        <div className="fld-grid">
          <label className="fld">
            <span className="fld-label">Canvas name</span>
            <input className="input" type="text" defaultValue="checkout · v3" />
            <span className="fld-help">Idle — neutral hairline on --bg-3.</span>
          </label>
          <label className="fld">
            <span className="fld-label">Frame role</span>
            {/* static "focused" reproduction — mirrors the .input:focus rule from _components.css */}
            <input className="input is-focus" type="text" defaultValue="primary action" />
            <span className="fld-help">Focused — accent border + 3px tint halo.</span>
          </label>
          <label className="fld is-error">
            <span className="fld-label">Node id</span>
            <input className="input" type="text" defaultValue="frame//" aria-invalid="true" />
            <span className="fld-help">Slug can&apos;t contain a slash — try a hyphen.</span>
          </label>
          <label className="fld is-disabled">
            <span className="fld-label">Created</span>
            <input className="input" type="text" defaultValue="2026-06-03 · synced" disabled />
            <span className="fld-help">Disabled — read-only, written by the agent.</span>
          </label>
        </div>

        <h2 data-no>Multiline &amp; choice <span className="h2-aside">textarea · select · search</span></h2>
        <div className="fld-row">
          <label className="fld fld--wide">
            <span className="fld-label">Hand-off note</span>
            <textarea className="textarea" rows={3} defaultValue="Spacing locked to the 4px base; the agent should keep the primary the only accent fill on hand-off." />
            <span className="fld-help">Travels with the component drop.</span>
          </label>
          <div className="fld-stack">
            <label className="fld">
              <span className="fld-label">Frame role</span>
              <div className="select-wrap">
                <select className="select" defaultValue="primary">
                  <option value="primary">Primary action</option>
                  <option value="surface">Surface</option>
                  <option value="overlay">Overlay</option>
                </select>
                <svg className="g sel-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6.5l4 4 4-4" /></svg>
              </div>
              <span className="fld-help">What this frame becomes in production.</span>
            </label>
            <label className="fld">
              <span className="fld-label">Find a node</span>
              <div className="search-wrap">
                <svg className="g sel-caret search-ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4" /><path d="M10 10l3 3" /></svg>
                <input className="input search-input" type="search" placeholder="Name, layer, or id" />
              </div>
              <span className="fld-help">Fuzzy match across the layer tree.</span>
            </label>
          </div>
        </div>

        <h2 data-no>The inspector row <span className="h2-aside">tabular .field — x · y · w · h · ∠</span></h2>
        <p>
          Where numbers live, the field goes mono and tabular so columns line up to the
          pixel. This is the inspector&apos;s real anatomy — a label and a tight grid of
          coordinate cells, right-aligned, 64px wide.
        </p>
        <div className="panel insp-card">
          <div className="panel-hd">Transform<span className="hd-meta">Frame · Pricing</span></div>
          <div className="panel-bd">
            <div className="insp-row">
              <span className="insp-label">Pos</span>
              <span className="insp-fields">
                <span className="fld-mini"><span className="mini-tag">X</span><input className="field" defaultValue="248" /></span>
                <span className="fld-mini"><span className="mini-tag">Y</span><input className="field" defaultValue="96" /></span>
              </span>
            </div>
            <div className="insp-row">
              <span className="insp-label">Size</span>
              <span className="insp-fields">
                <span className="fld-mini"><span className="mini-tag">W</span><input className="field" defaultValue="320" /></span>
                <span className="fld-mini"><span className="mini-tag">H</span><input className="field" defaultValue="540" /></span>
              </span>
            </div>
            <div className="insp-row">
              <span className="insp-label">Rotate</span>
              <span className="insp-fields">
                <span className="fld-mini"><span className="mini-tag">∠</span><input className="field is-focus" defaultValue="0" /></span>
                <span className="insp-unit">deg</span>
              </span>
            </div>
            <div className="insp-row">
              <span className="insp-label">Radius</span>
              <span className="insp-fields">
                <span className="fld-mini"><span className="mini-tag">r</span><input className="field" defaultValue="7" /></span>
                <span className="insp-unit">px · --radius-md</span>
              </span>
            </div>
          </div>
        </div>

        <h2 data-no>Why a halo, not an outline <span className="h2-aside">focus anatomy</span></h2>
        <p>
          An <code>outline</code> sits on top of the border and hides the state change
          underneath. The halo is a <code>box-shadow</code> — it sits outside the box, so
          the accent border still reads as the border. Both layers are accent, both calm.
        </p>
        <div className="focus-anat">
          <span className="anat-chip"><span className="input is-focus anat-input" aria-hidden="true">320</span></span>
          <ul className="anat-legend">
            <li><span className="dot dot--border" />accent border — <code>border-color: var(--accent)</code></li>
            <li><span className="dot dot--halo" />tint halo — <code>box-shadow: 0 0 0 3px var(--accent-tint)</code></li>
          </ul>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-inputs</span>
          <span>accent ring · tabular fields · mono first-class</span>
        </footer>
      </main>
    </>
  );
}
