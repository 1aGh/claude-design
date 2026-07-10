// photo-knobs.jsx — the Inspector "Photo" tab body (feature-photo-editor, Task 15).
//
// A self-contained editor for a PhotoEdit sidecar. Unlike CssKnobs (whose write
// path is /_api/edit-css keyed on a source `data-cd-id`), PhotoKnobs writes the
// non-destructive `assets/<sha8>.photo.json` sidecar through /_api/photo-edit —
// so it works for BOTH an artboard `<img>` and an annotation ImageStroke (both
// carry an `assets/<sha8>.<ext>` source), neither of which CssKnobs can express.
//
// Runs on the MAIN origin (the studio shell), so inline styles are fine
// (style-src 'self' 'unsafe-inline'). Renders the controls; the live pixel
// preview happens in the canvas iframe's <PhotoLayer>, driven by `onEdit`
// (app.jsx broadcasts the updated edit down to the canvas). Reuses the shell's
// HSV `ColorPicker` when injected; falls back to a native color input.
//
// Sections + ranges mirror photo/schema.ts exactly:
//   Adjustments (brightness/contrast/saturation/exposure −1..1, hue −180..180,
//   sepia/grayscale/invert 0..1) · Duotone · Grain · Pattern · Mask · Background.

import { useCallback, useEffect, useRef, useState } from 'react';

const PATTERN_TYPES = ['dots', 'grid', 'lines', 'diagonal', 'crosshatch'];
const PATTERN_BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'];
const MASK_PRESETS = ['none', 'vignette', 'radial-reveal', 'edge-fade'];

const ADJUSTMENTS = [
  { key: 'brightness', label: 'Brightness', min: -1, max: 1 },
  { key: 'contrast', label: 'Contrast', min: -1, max: 1 },
  { key: 'saturation', label: 'Saturation', min: -1, max: 1 },
  { key: 'exposure', label: 'Exposure', min: -1, max: 1 },
  { key: 'hue', label: 'Hue', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'sepia', label: 'Sepia', min: 0, max: 1 },
  { key: 'grayscale', label: 'Grayscale', min: 0, max: 1 },
  { key: 'invert', label: 'Invert', min: 0, max: 1 },
];

// Deep-clone a small plain edit object (structuredClone is available in the shell).
const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : {});

/** Prune empty sub-objects so a neutral edit serializes back to `{}`. */
function prune(edit) {
  const out = {};
  for (const [k, v] of Object.entries(edit)) {
    if (v == null) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const inner = {};
      for (const [ik, iv] of Object.entries(v)) if (iv != null && iv !== '') inner[ik] = iv;
      if (Object.keys(inner).length) out[k] = inner;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── small inline-styled primitives ──────────────────────────────────────────

const S = {
  body: { padding: '10px 12px', fontSize: 12, color: 'var(--st-fg, #ddd)', overflowY: 'auto' },
  sec: { marginBottom: 14 },
  secHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    opacity: 0.7,
    margin: '4px 0 8px',
  },
  row: { display: 'flex', alignItems: 'center', gap: 8, margin: '5px 0' },
  label: { flex: '0 0 78px', fontSize: 11, opacity: 0.85 },
  range: { flex: 1, minWidth: 0 },
  num: {
    flex: '0 0 42px',
    textAlign: 'right',
    fontFamily: 'var(--st-mono, ui-monospace, monospace)',
    fontSize: 11,
    opacity: 0.75,
  },
  btn: {
    font: 'inherit',
    fontSize: 11,
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid var(--st-border, #444)',
    background: 'var(--st-btn-bg, #2a2a2a)',
    color: 'inherit',
    cursor: 'pointer',
  },
  reset: {
    font: 'inherit',
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 4,
    border: '1px solid transparent',
    background: 'transparent',
    color: 'inherit',
    opacity: 0.6,
    cursor: 'pointer',
  },
  select: {
    font: 'inherit',
    fontSize: 11,
    padding: '3px 6px',
    borderRadius: 5,
    border: '1px solid var(--st-border, #444)',
    background: 'var(--st-btn-bg, #2a2a2a)',
    color: 'inherit',
  },
};

function Section({ title, right, children }) {
  return (
    <section style={S.sec}>
      <div style={S.secHead}>
        <span>{title}</span>
        {right}
      </div>
      {children}
    </section>
  );
}

function Slider({ label, value, min, max, step = 0.01, unit = '', onChange, onCommit }) {
  const v = value ?? (min < 0 ? 0 : min);
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <input
        type="range"
        style={S.range}
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        aria-label={label}
      />
      <span style={S.num}>
        {step >= 1 ? Math.round(v) : v.toFixed(2)}
        {unit}
      </span>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function ColorSwatch({ value, fallback, ColorPicker, onApply }) {
  const hex = value || fallback;
  if (ColorPicker) return <ColorPicker seed={hex} onApply={onApply} />;
  return (
    <input
      type="color"
      value={hex}
      onChange={(e) => onApply(e.target.value)}
      style={{ width: 28, height: 20, padding: 0, border: 'none', background: 'none' }}
      aria-label="color"
    />
  );
}

// ── the panel ────────────────────────────────────────────────────────────────

/**
 * @param {object}   p
 * @param {string}   p.asset             `assets/<sha8>.<ext>` source path.
 * @param {object}  [p.initialEdit]      Seed PhotoEdit (else fetched on mount).
 * @param {Function} [p.ColorPicker]     Injected HSV picker component (optional).
 * @param {Function} [p.onEdit]          (edit) => void — live-preview broadcast.
 * @param {Function} [p.onRemoveBackground] async (asset) => { maskAsset } | null.
 * @param {Function} [p.onRecordEdit]    (before, after) => void — undo integration.
 */
export function PhotoKnobs({ asset, initialEdit, ColorPicker, onEdit, onRemoveBackground, onRecordEdit }) {
  const [edit, setEditState] = useState(() => clone(initialEdit));
  const [loading, setLoading] = useState(!initialEdit);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [bgBusy, setBgBusy] = useState(false);
  const putTimer = useRef(null);
  const editRef = useRef(edit);
  editRef.current = edit;

  // Hydrate from the sidecar unless seeded.
  useEffect(() => {
    if (initialEdit || !asset) return;
    let dead = false;
    setLoading(true);
    fetch(`/_api/photo-edit?asset=${encodeURIComponent(asset)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => {
        if (dead) return;
        setEditState(j && typeof j === 'object' ? j : {});
        setLoading(false);
      })
      .catch(() => !dead && setLoading(false));
    return () => {
      dead = true;
    };
  }, [asset, initialEdit]);

  const put = useCallback(
    (next) => {
      clearTimeout(putTimer.current);
      putTimer.current = setTimeout(async () => {
        setSaveState('saving');
        try {
          const res = await fetch(`/_api/photo-edit?asset=${encodeURIComponent(asset)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prune(next)),
          });
          setSaveState(res.ok ? 'saved' : 'error');
        } catch {
          setSaveState('error');
        }
      }, 160);
    },
    [asset]
  );

  // Apply a mutation, push the optimistic edit to the live preview, persist
  // (debounced), and record undo (before → after).
  const mutate = useCallback(
    (fn, { commit = false } = {}) => {
      const before = editRef.current;
      const next = clone(before);
      fn(next);
      setEditState(next);
      onEdit?.(next);
      put(next);
      if (commit) onRecordEdit?.(before, next);
    },
    [onEdit, put, onRecordEdit]
  );

  const setAdj = (key, value, commit) =>
    mutate((e) => {
      e.adjustments = e.adjustments || {};
      if (value === 0 || value == null) delete e.adjustments[key];
      else e.adjustments[key] = value;
      if (Object.keys(e.adjustments).length === 0) delete e.adjustments;
    }, { commit });

  const setSection = (section, patch, commit) =>
    mutate((e) => {
      e[section] = { ...(e[section] || {}), ...patch };
    }, { commit });

  const resetAdjustments = () => mutate((e) => delete e.adjustments, { commit: true });

  if (loading) return <div style={{ ...S.body, opacity: 0.6 }}>Loading photo edit…</div>;

  const adj = edit.adjustments || {};
  const duo = edit.duotone || {};
  const grain = edit.grain || {};
  const pat = edit.pattern || {};
  const mask = edit.mask || {};
  const bg = edit.backgroundRemoved || {};

  return (
    <div style={S.body} data-testid="photo-knobs">
      <div style={{ ...S.secHead, marginTop: 0, opacity: 0.5, textTransform: 'none', letterSpacing: 0 }}>
        <span style={{ fontFamily: 'var(--st-mono, monospace)', fontSize: 10 }}>{asset}</span>
        <span style={{ fontSize: 10 }}>
          {saveState === 'saving' ? 'saving…' : saveState === 'error' ? '⚠ save failed' : saveState === 'saved' ? 'saved' : ''}
        </span>
      </div>

      <Section
        title="Adjustments"
        right={
          <button type="button" style={S.reset} onClick={resetAdjustments} title="Reset adjustments">
            reset
          </button>
        }
      >
        {ADJUSTMENTS.map((a) => (
          <Slider
            key={a.key}
            label={a.label}
            value={adj[a.key]}
            min={a.min}
            max={a.max}
            step={a.step ?? 0.01}
            unit={a.unit ?? ''}
            onChange={(v) => setAdj(a.key, v)}
            onCommit={() => setAdj(a.key, adj[a.key] ?? 0, true)}
          />
        ))}
      </Section>

      <Section
        title="Duotone"
        right={<Toggle checked={duo.enabled} onChange={(v) => setSection('duotone', { enabled: v }, true)} label="on" />}
      >
        {duo.enabled && (
          <>
            <div style={S.row}>
              <span style={S.label}>Shadow</span>
              <ColorSwatch value={duo.colorA} fallback="#111111" ColorPicker={ColorPicker} onApply={(hex) => setSection('duotone', { colorA: hex }, true)} />
              <span style={S.label}>Highlight</span>
              <ColorSwatch value={duo.colorB} fallback="#ffffff" ColorPicker={ColorPicker} onApply={(hex) => setSection('duotone', { colorB: hex }, true)} />
            </div>
            <Slider label="Intensity" value={duo.intensity ?? 1} min={0} max={1} onChange={(v) => setSection('duotone', { intensity: v })} onCommit={() => setSection('duotone', { intensity: duo.intensity ?? 1 }, true)} />
          </>
        )}
      </Section>

      <Section
        title="Grain"
        right={<Toggle checked={grain.enabled} onChange={(v) => setSection('grain', { enabled: v }, true)} label="on" />}
      >
        {grain.enabled && (
          <>
            <Slider label="Amount" value={grain.amount ?? 0.4} min={0} max={1} onChange={(v) => setSection('grain', { amount: v })} onCommit={() => setSection('grain', { amount: grain.amount ?? 0.4 }, true)} />
            <Slider label="Size" value={grain.size ?? 1} min={1} max={8} step={0.5} onChange={(v) => setSection('grain', { size: v })} onCommit={() => setSection('grain', { size: grain.size ?? 1 }, true)} />
          </>
        )}
      </Section>

      <Section
        title="Pattern"
        right={<Toggle checked={pat.enabled} onChange={(v) => setSection('pattern', { enabled: v }, true)} label="on" />}
      >
        {pat.enabled && (
          <>
            <div style={S.row}>
              <span style={S.label}>Type</span>
              <select style={S.select} value={pat.type || 'dots'} onChange={(e) => setSection('pattern', { type: e.target.value }, true)}>
                {PATTERN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span style={S.label}>Blend</span>
              <select style={S.select} value={pat.blend || 'normal'} onChange={(e) => setSection('pattern', { blend: e.target.value }, true)}>
                {PATTERN_BLENDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div style={S.row}>
              <span style={S.label}>Color</span>
              <ColorSwatch value={pat.color} fallback="#ffffff" ColorPicker={ColorPicker} onApply={(hex) => setSection('pattern', { color: hex }, true)} />
              <span style={{ ...S.num, flex: 1, textAlign: 'left', opacity: 0.5 }}>tip: dark + multiply</span>
            </div>
            <Slider label="Scale" value={pat.scale ?? 1} min={0.25} max={4} step={0.25} onChange={(v) => setSection('pattern', { scale: v })} onCommit={() => setSection('pattern', { scale: pat.scale ?? 1 }, true)} />
            <Slider label="Opacity" value={pat.opacity ?? 0.5} min={0} max={1} onChange={(v) => setSection('pattern', { opacity: v })} onCommit={() => setSection('pattern', { opacity: pat.opacity ?? 0.5 }, true)} />
          </>
        )}
      </Section>

      <Section title="Mask">
        <div style={S.row}>
          <span style={S.label}>Preset</span>
          <select style={S.select} value={mask.preset || 'none'} onChange={(e) => setSection('mask', { preset: e.target.value }, true)}>
            {MASK_PRESETS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {mask.preset && mask.preset !== 'none' && (
          <Slider label="Strength" value={mask.strength ?? 0.6} min={0} max={1} onChange={(v) => setSection('mask', { strength: v })} onCommit={() => setSection('mask', { strength: mask.strength ?? 0.6 }, true)} />
        )}
      </Section>

      <Section title="Background">
        <div style={{ ...S.row, gap: 10 }}>
          <button
            type="button"
            style={{ ...S.btn, opacity: bgBusy ? 0.6 : 1 }}
            disabled={bgBusy || !onRemoveBackground}
            data-testid="photo-remove-bg"
            onClick={async () => {
              if (!onRemoveBackground) return;
              setBgBusy(true);
              try {
                const res = await onRemoveBackground(asset);
                if (res?.maskAsset) setSection('backgroundRemoved', { enabled: true, maskAsset: res.maskAsset }, true);
              } finally {
                setBgBusy(false);
              }
            }}
          >
            {bgBusy ? 'Removing…' : '✦ Remove Background'}
          </button>
          {bg.maskAsset && (
            <Toggle checked={bg.enabled} onChange={(v) => setSection('backgroundRemoved', { enabled: v }, true)} label="applied" />
          )}
        </div>
      </Section>
    </div>
  );
}

export default PhotoKnobs;
