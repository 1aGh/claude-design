/**
 * @canvas      components-toggles — switch · checkbox · radio · segmented, in the
 *              panel material. Switch = a binary setting that takes effect now;
 *              checkbox = batch select; radio = exclusive choice in a small set;
 *              segmented = the active tool / view. Accent rides the ON state ONLY —
 *              one job per surface. The Canvas-settings panel is LIVE: flipping a
 *              switch retints the dotted-grid preview beside it.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/components-toggles — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN (from template): checkbox / radio / switch / segmented — each in
 * unchecked, checked, focused, disabled states. Each is a real <input> with
 * custom styling — the accessibility tree stays intact. Accent only on ON.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-toggles.css";
import { useId, useState } from "react";

type Tool = "move" | "frame" | "pen";

export default function ComponentsToggles() {
  // Live settings — flipping these retints the canvas preview to the right.
  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [agentCursors, setAgentCursors] = useState(false);
  const [tool, setTool] = useState<Tool>("frame");
  const [snapTo, setSnapTo] = useState("grid");
  const radioName = useId();

  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-toggles</span>
        <span className="crumbs"><span>maude</span><span>component</span><span>toggles</span></span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>Toggles. The accent only when on.</h1>
          <p className="lede">
            A switch flips a setting that takes effect now. A checkbox batch-selects.
            A radio picks one from a small set. A segmented control holds the active
            tool. All four share the panel material; the indigo accent appears on the
            <em> ON</em> state and nowhere else — the eye reads state, not chrome.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Material</dt><dd>panel · bg-3 track</dd></div>
          <div><dt>Accent role</dt><dd>ON state only</dd></div>
          <div><dt>A11y</dt><dd>real input · native role</dd></div>
          <div><dt>Flip</dt><dd>140ms · transform</dd></div>
        </dl>

        {/* ── Original move: a live settings panel wired to a dotted-canvas preview ── */}
        <h2 data-no>Canvas settings <span className="h2-aside">live · flip a switch</span></h2>
        <p>
          Real rows from the inspector. Toggle one and the preview beside it responds —
          this is what a switch is <em>for</em>: an immediate, reversible change to the
          surface you are looking at. The active tool is a segmented control.
        </p>

        <div className="tg-live">
          <div className="panel tg-settings">
            <div className="panel-hd"><span>Canvas</span><span className="mono">{tool}</span></div>
            <div className="panel-bd">
              <SettingRow id={`${radioName}-grid`} label="Show dotted grid" hint="the infinite-canvas backdrop" checked={grid} onChange={setGrid} />
              <SettingRow id={`${radioName}-snap`} label="Snap to grid" hint="align nodes to the 24px pitch" checked={snap} onChange={setSnap} />
              <SettingRow id={`${radioName}-agent`} label="Show agent cursors" hint="where the AI is touching the canvas" checked={agentCursors} onChange={setAgentCursors} />

              <div className="tg-divider" />

              <div className="tg-toolrow">
                <span className="insp-label">Tool</span>
                <span className="seg" role="group" aria-label="Active tool">
                  {(["move", "frame", "pen"] as Tool[]).map((t) => (
                    <button key={t} type="button" aria-pressed={tool === t} onClick={() => setTool(t)}>{t}</button>
                  ))}
                </span>
              </div>
            </div>
          </div>

          <div
            className="tg-preview"
            data-grid={grid}
            data-snap={snap}
            aria-label="Canvas preview reflecting the settings"
          >
            <div className="tg-readout mono">tool {tool} · grid {grid ? "on" : "off"} · snap {snap ? "on" : "off"}</div>
            <div className="tg-node">
              <span>Frame · Hero</span>
              {snap && <span className="tg-guide tg-guide--v" />}
              {snap && <span className="tg-guide tg-guide--h" />}
            </div>
            {agentCursors && (
              <div className="tg-agent">
                <span className="presence-dot presence-dot--agent" />
                <span className="lbl mono">agent</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Switch — every state ── */}
        <h2 data-no>Switch <span className="h2-aside">binary · takes effect now</span></h2>
        <div className="panel tg-states">
          <div className="panel-bd">
            <SettingRow id="sw-a" label="Show dotted grid" hint="on" checked onChange={() => {}} />
            <SettingRow id="sw-b" label="Auto hand off on approve" hint="off" checked={false} onChange={() => {}} />
            <SettingRow id="sw-c" label="Lock layer order" hint="disabled — admin only" checked={false} disabled onChange={() => {}} />
          </div>
        </div>

        {/* ── Checkbox — squared, batch select ── */}
        <h2 data-no>Checkbox <span className="h2-aside">squared · batch select</span></h2>
        <p>Pick which layers ride along when you hand off. Square corners, native <code>indeterminate</code> for a mixed group.</p>
        <fieldset className="tg-set">
          <legend className="insp-label">Include in hand off</legend>
          <CheckRow id="cb-a" label="Frame · Hero" defaultChecked />
          <CheckRow id="cb-b" label="Card · Pricing" defaultChecked />
          <CheckRow id="cb-c" label="Group · Footer" />
          <CheckRow id="cb-d" label="Hidden nodes" disabled />
        </fieldset>

        {/* ── Radio — round, exclusive ── */}
        <h2 data-no>Radio <span className="h2-aside">round · one of a set</span></h2>
        <p>Where snapping anchors. Exactly one is true; round corners say "you can only pick one".</p>
        <fieldset className="tg-set" role="radiogroup" aria-label="Snap target">
          <RadioRow name={radioName} value="grid" label="The dotted grid" hint="24px pitch" checked={snapTo === "grid"} onChange={setSnapTo} />
          <RadioRow name={radioName} value="nodes" label="Other node edges" hint="smart guides" checked={snapTo === "nodes"} onChange={setSnapTo} />
          <RadioRow name={radioName} value="off" label="Nothing — free placement" checked={snapTo === "off"} onChange={setSnapTo} />
        </fieldset>

        <div className="callout callout--info tg-note">
          <span className="mono">i</span>
          <p style={{ margin: 0 }}>
            One accent, one job: it marks the <strong>ON</strong> switch, the <strong>checked</strong> box, the
            <strong> selected</strong> radio, the <strong>active</strong> segment — never a resting control. If two
            controls glow at once, that is two jobs and the eye loses the signal.
          </p>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-toggles</span>
          <span>switch · checkbox · radio · segmented · accent = ON</span>
        </footer>
      </main>
    </>
  );
}

/* ── A switch row: real <input type=checkbox className="switch"> ── */
function SettingRow(props: {
  id: string; label: string; hint?: string;
  checked: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  const { id, label, hint, checked, disabled, onChange } = props;
  return (
    <div className="tg-row" data-disabled={disabled || undefined}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className="tg-label">
        {label}
        {hint && <span className="tg-hint mono">{hint}</span>}
      </label>
    </div>
  );
}

/* ── A squared checkbox row — native input, custom box ── */
function CheckRow(props: { id: string; label: string; defaultChecked?: boolean; disabled?: boolean }) {
  const { id, label, defaultChecked, disabled } = props;
  return (
    <div className="tg-row" data-disabled={disabled || undefined}>
      <input id={id} type="checkbox" className="check" defaultChecked={defaultChecked} disabled={disabled} />
      <label htmlFor={id} className="tg-label">{label}</label>
    </div>
  );
}

/* ── A round radio row — native input, custom dot ── */
function RadioRow(props: {
  name: string; value: string; label: string; hint?: string;
  checked: boolean; onChange: (v: string) => void;
}) {
  const { name, value, label, hint, checked, onChange } = props;
  const id = `${name}-${value}`;
  return (
    <div className="tg-row">
      <input id={id} type="radio" name={name} className="radio" value={value} checked={checked} onChange={() => onChange(value)} />
      <label htmlFor={id} className="tg-label">
        {label}
        {hint && <span className="tg-hint mono">{hint}</span>}
      </label>
    </div>
  );
}
