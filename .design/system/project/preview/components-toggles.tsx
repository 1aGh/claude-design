/**
 * @canvas      components-toggles — switches, checkboxes, radios + segmented control
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       DS specimen — components-toggles
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-toggles/
 * @handoff     bunx shadcn add file://./components-toggles.registry.json
 */

import { useState } from "react";
export default function ComponentsToggles() {
  return (
    <>
<header className="specimen-hd">
          <span className="sku">MDCC-DSN/01.components-toggles</span>
          <span className="crumbs">
            <span>maude</span>
            <span>design system</span>
            <span>components</span>
            <span>toggles</span>
          </span>
        </header>
        <main className="specimen">
          <section className="specimen-title">
            <h1>Toggles</h1>
            <p className="lede">
              Switches, checkboxes, radios, segmented controls. All hard-edged. Physical-switch metaphor, not rounded slider. The accent fills the "on" state.
            </p>
          </section>
          <dl className="specimen-meta">
            <div><dt>Variants</dt><dd>switch · check · radio · seg</dd></div>
            <div><dt>Family</dt><dd>hard-edges</dd></div>
          </dl>

          <h2 data-no="01">Switch</h2>
          <div className="row">
            <Switch initial={false} />
            <Switch initial={true} />
            <span style={{ color: 'var(--fg-2)', fontSize: 'var(--type-sm)' }}>
              click to toggle · the switch reads as a hardware part, not a slider
            </span>
          </div>

          <h2 data-no="02">Checkbox + radio</h2>
          <div className="row">
            <label style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', fontSize: 'var(--type-sm)' }}>
              <input type="checkbox" className="check" defaultChecked /> auto-open critic panel after /design:edit
            </label>
            <label style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', fontSize: 'var(--type-sm)' }}>
              <input type="checkbox" className="check" /> auto-screenshot before snapshot
            </label>
          </div>
          <div className="row">
            <label style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', fontSize: 'var(--type-sm)' }}>
              <input type="radio" name="r" className="radio" defaultChecked /> Paper (light)
            </label>
            <label style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', fontSize: 'var(--type-sm)' }}>
              <input type="radio" name="r" className="radio" /> Phosphor (dark)
            </label>
            <label style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', fontSize: 'var(--type-sm)' }}>
              <input type="radio" name="r" className="radio" /> System (prefers-color-scheme)
            </label>
          </div>

          <h2 data-no="03">Segmented control</h2>
          <div className="row">
            <Seg options={["All", "Featured", "New", "Archived"]} />
          </div>

          <footer className="specimen-ft">
            <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-toggles</span></div>
            <div className="colo-block"><span>Maude · v0.12.0</span></div>
          </footer>
        </main>
    </>
  );
}

function Switch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <span
      className="switch"
      tabIndex={0}
      role="switch"
      aria-checked={on}
      onClick={() => setOn((v) => !v)}
    />
  );
}

function Seg({ options }: { options: string[] }) {
  const [active, setActive] = useState(options[0]);
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={active === o} onClick={() => setActive(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
