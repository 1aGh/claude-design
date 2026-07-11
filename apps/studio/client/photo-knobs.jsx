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

// Theme tokens — the REAL shell tokens (client/styles/1-tokens.css), defined
// for both `:root`/`[data-theme="light"]` and `[data-theme="dark"]`. Earlier
// this used invented `--st-*` names (--st-fg/--st-border/--st-btn-bg/--st-mono)
// that were never actually declared anywhere in the stylesheet, so every rule
// silently fell back to its hardcoded dark-mode default — the panel looked
// fine in dark mode purely by coincidence and was low-contrast/washed out in
// light mode.
const S = {
  body: { fontSize: 12, color: 'var(--fg-0)', overflowY: 'auto' },
  sec: { marginBottom: 'var(--space-4)' },
  secHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-wide)',
    color: 'var(--fg-2)',
    margin: '4px 0 8px',
  },
  row: { display: 'flex', alignItems: 'center', gap: 8, margin: 'var(--space-2) 0' },
  label: { flex: '0 0 78px', fontSize: 11, color: 'var(--fg-1)' },
  num: {
    flex: 'none',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    fontSize: 11,
    color: 'var(--fg-2)',
    padding: '0 var(--space-2)',
  },
  reset: {
    font: 'inherit',
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 'var(--radius-xs)',
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--fg-2)',
    cursor: 'pointer',
  },
};

function Section({ title, right, children }) {
  return (
    <section style={S.sec}>
      <div style={S.secHead}>
        <h3 style={{ margin: 0, font: 'inherit' }}>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

// Bordered drag-scrub numeric field (feature-photo-editor follow-up debt,
// Task 9) — mirrors app.jsx's `num()` DOM shape (`.st-cp-num`/`.st-cp-numin
// .st-cp-scrub`/`.st-cp-step`), replacing the bare native `<input
// type="range">` this used to be. `makePhotoScrub` adapts `makeScrub`'s
// pointer-move algorithm (same 3px-threshold-before-drag, same shift=×10 /
// alt=×0.1 step modifiers) to a value clamped to `[min, max]` — PhotoKnobs'
// fields have real bounds, unlike most CSS props `makeScrub` drives.
function makePhotoScrub(min, max, step, onChange, onCommit) {
  return (e) => {
    if (e.button !== 0) return;
    const input = e.currentTarget;
    const startX = e.clientX;
    const baseN = Number.parseFloat(input.value) || 0;
    const precision = step >= 1 ? 0 : 2;
    const snap = (n) => {
      const clamped = Math.min(max, Math.max(min, n));
      return Number((Math.round(clamped / step) * step).toFixed(precision));
    };
    const fmt = (n) => (step >= 1 ? String(Math.round(n)) : n.toFixed(2));
    let scrubbing = false;
    let last = baseN;
    const move = (ev) => {
      const dx = ev.clientX - startX;
      if (!scrubbing && Math.abs(dx) < 3) return;
      if (!scrubbing) {
        scrubbing = true;
        document.body.classList.add('st-scrubbing');
      }
      ev.preventDefault();
      const granular = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      last = snap(baseN + dx * step * granular);
      input.value = fmt(last);
      onChange(last);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (!scrubbing) return;
      document.body.classList.remove('st-scrubbing');
      onCommit(last);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
}

function Slider({ label, value, min, max, step = 0.01, unit = '', onChange, onCommit }) {
  const v = value ?? (min < 0 ? 0 : min);
  const ref = useRef(null);
  const fmt = (n) => (step >= 1 ? String(Math.round(n)) : n.toFixed(2));
  // Sync the uncontrolled input from an EXTERNAL value change (Reset section,
  // undo/redo) — but never while the field itself is focused, so this doesn't
  // fight the imperative `input.value` writes `makePhotoScrub` makes mid-drag
  // (PhotoKnobs, unlike CssKnobs, updates `value` on every onChange — keying
  // the input on `value` would force a remount on every drag step instead).
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = fmt(v);
  }, [v]);
  const clamp = (n) => Math.min(max, Math.max(min, n));
  const commitTyped = (raw) => {
    const n = Number.parseFloat(raw);
    if (Number.isNaN(n)) return;
    onCommit(clamp(n));
  };
  const bump = (d) => onCommit(clamp(Number((v + d * step).toFixed(step >= 1 ? 0 : 2))));
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <div className="st-cp-num">
        <input
          ref={ref}
          className="st-cp-numin st-cp-scrub"
          defaultValue={fmt(v)}
          aria-label={label}
          onPointerDown={makePhotoScrub(min, max, step, onChange, onCommit)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={(e) => commitTyped(e.currentTarget.value)}
        />
        {unit ? (
          <span style={S.num} aria-hidden="true">
            {unit}
          </span>
        ) : null}
        <span className="st-cp-step">
          <button
            type="button"
            className="st-cp-stepb"
            tabIndex={-1}
            aria-label={`increase ${label}`}
            onClick={() => bump(1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="st-cp-stepb"
            tabIndex={-1}
            aria-label={`decrease ${label}`}
            onClick={() => bump(-1)}
          >
            ▼
          </button>
        </span>
      </div>
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

function ColorSwatch({ value, fallback, ColorPicker, label, onApply }) {
  const hex = value || fallback;
  if (ColorPicker) return <ColorPicker seed={hex} label={label} onApply={onApply} />;
  return (
    <input
      type="color"
      value={hex}
      onChange={(e) => onApply(e.target.value)}
      style={{ width: 28, height: 20, padding: 0, border: 'none', background: 'none' }}
      aria-label={label || 'color'}
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
 * @param {Function} [p.StIcon]         Injected shell icon component (optional).
 */
export function PhotoKnobs({ asset, initialEdit, ColorPicker, onEdit, onRemoveBackground, onRecordEdit, StIcon }) {
  const [edit, setEditState] = useState(() => clone(initialEdit));
  const [loading, setLoading] = useState(!initialEdit);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [bgBusy, setBgBusy] = useState(false);
  // sr-only live-region text for the background-removal busy state (Task 19).
  const [bgAnnounce, setBgAnnounce] = useState('');
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

  // Shared by both the initial "Remove Background" and the "redo" button —
  // drives the busy state + the sr-only live-region announcement (Task 19).
  const runRemoveBackground = async () => {
    if (!onRemoveBackground) return;
    setBgBusy(true);
    setBgAnnounce('Removing background…');
    try {
      const res = await onRemoveBackground(asset);
      if (res?.maskAsset) {
        setSection('backgroundRemoved', { enabled: true, maskAsset: res.maskAsset }, true);
        setBgAnnounce('Background removed');
      } else {
        setBgAnnounce('Background removal failed');
      }
    } catch {
      setBgAnnounce('Background removal failed');
    } finally {
      setBgBusy(false);
    }
  };

  if (loading) return <div style={{ ...S.body, opacity: 0.6 }}>Loading photo edit…</div>;

  const adj = edit.adjustments || {};
  const duo = edit.duotone || {};
  const grain = edit.grain || {};
  const pat = edit.pattern || {};
  const mask = edit.mask || {};
  const bg = edit.backgroundRemoved || {};

  return (
    <div style={S.body} data-testid="photo-knobs">
      <div style={{ ...S.secHead, marginTop: 0, color: 'var(--fg-2)', textTransform: 'none', letterSpacing: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10 }}>{asset}</span>
        <span style={{ fontSize: 10, color: saveState === 'error' ? 'var(--status-error)' : undefined }}>
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
            onCommit={(v) => setAdj(a.key, v, true)}
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
              <ColorSwatch value={duo.colorA} fallback="#111111" ColorPicker={ColorPicker} label="Shadow" onApply={(hex) => setSection('duotone', { colorA: hex }, true)} />
              <span style={S.label}>Highlight</span>
              <ColorSwatch value={duo.colorB} fallback="#ffffff" ColorPicker={ColorPicker} label="Highlight" onApply={(hex) => setSection('duotone', { colorB: hex }, true)} />
            </div>
            <Slider label="Intensity" value={duo.intensity ?? 1} min={0} max={1} onChange={(v) => setSection('duotone', { intensity: v })} onCommit={(v) => setSection('duotone', { intensity: v }, true)} />
          </>
        )}
      </Section>

      <Section
        title="Grain"
        right={<Toggle checked={grain.enabled} onChange={(v) => setSection('grain', { enabled: v }, true)} label="on" />}
      >
        {grain.enabled && (
          <>
            <Slider label="Amount" value={grain.amount ?? 0.4} min={0} max={1} onChange={(v) => setSection('grain', { amount: v })} onCommit={(v) => setSection('grain', { amount: v }, true)} />
            <Slider label="Size" value={grain.size ?? 1} min={1} max={8} step={0.5} onChange={(v) => setSection('grain', { size: v })} onCommit={(v) => setSection('grain', { size: v }, true)} />
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
              <select
                className="st-cp-nsel"
                aria-label="Pattern type"
                value={pat.type || 'dots'}
                onChange={(e) => setSection('pattern', { type: e.target.value }, true)}
              >
                {PATTERN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span style={S.label}>Blend</span>
              <select
                className="st-cp-nsel"
                aria-label="Pattern blend"
                value={pat.blend || 'normal'}
                onChange={(e) => setSection('pattern', { blend: e.target.value }, true)}
              >
                {PATTERN_BLENDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div style={S.row}>
              <span style={S.label}>Color</span>
              <ColorSwatch value={pat.color} fallback="#ffffff" ColorPicker={ColorPicker} label="Pattern color" onApply={(hex) => setSection('pattern', { color: hex }, true)} />
              <span style={{ ...S.num, flex: 1, textAlign: 'left', color: 'var(--fg-2)' }}>tip: dark + multiply</span>
            </div>
            <Slider label="Scale" value={pat.scale ?? 1} min={0.25} max={4} step={0.25} onChange={(v) => setSection('pattern', { scale: v })} onCommit={(v) => setSection('pattern', { scale: v }, true)} />
            <Slider label="Opacity" value={pat.opacity ?? 0.5} min={0} max={1} onChange={(v) => setSection('pattern', { opacity: v })} onCommit={(v) => setSection('pattern', { opacity: v }, true)} />
          </>
        )}
      </Section>

      <Section title="Mask">
        <div style={S.row}>
          <span style={S.label}>Preset</span>
          <select
            className="st-cp-nsel"
            aria-label="Mask preset"
            value={mask.preset || 'none'}
            onChange={(e) => setSection('mask', { preset: e.target.value }, true)}
          >
            {MASK_PRESETS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {mask.preset && mask.preset !== 'none' && (
          <Slider label="Strength" value={mask.strength ?? 0.6} min={0} max={1} onChange={(v) => setSection('mask', { strength: v })} onCommit={(v) => setSection('mask', { strength: v }, true)} />
        )}
      </Section>

      <Section title="Background">
        <div style={{ ...S.row, gap: 10 }} aria-busy={bgBusy || undefined}>
          {bg.maskAsset ? (
            <>
              <Toggle checked={bg.enabled} onChange={(v) => setSection('backgroundRemoved', { enabled: v }, true)} label="applied" />
              <button
                type="button"
                style={{ ...S.reset, opacity: bgBusy ? 0.6 : 1 }}
                disabled={bgBusy || !onRemoveBackground}
                title="Run background removal again"
                onClick={() => runRemoveBackground()}
              >
                {bgBusy ? 'removing…' : 'redo'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="st-btn"
              style={{ opacity: bgBusy ? 0.6 : 1 }}
              disabled={bgBusy || !onRemoveBackground}
              data-testid="photo-remove-bg"
              onClick={() => runRemoveBackground()}
            >
              {StIcon ? <StIcon name="sparkle" size={14} /> : null}
              {bgBusy ? 'Removing…' : 'Remove Background'}
            </button>
          )}
        </div>
        <span aria-live="polite" className="sr-only">
          {bgAnnounce}
        </span>
      </Section>
    </div>
  );
}

export default PhotoKnobs;
