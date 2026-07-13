// SettingsPanel.jsx — BYOK AI-media generation settings (feature-ai-media-
// generation, DDR-16x). Manages provider API keys + enable toggles from the UI.
//
// Trust model (load-bearing): a key is POSTed to the PRIVILEGED main-origin
// /_api/generate/keys route and NEVER echoed back — GET returns only a
// { configured: [...] } presence list. So this panel shows a masked "••••
// configured" state, never the key value. The panel lives in the app shell
// (main origin); the untrusted canvas iframe can't reach any of these routes.
//
// Layout mirrors OnboardingWizard's density + the ExportDialog modal shell
// (st-scrim / st-dialog). Icons are local Lucide-line paths (IdentityBar
// precedent); colors are theme tokens only (no hardcoded hex).

import { useCallback, useEffect, useState } from 'react';

function Icon({ name, size = 16 }) {
  const p = {
    x: (
      <>
        <line x1="4" y1="4" x2="12" y2="12" />
        <line x1="12" y1="4" x2="4" y2="12" />
      </>
    ),
    key: (
      <>
        <circle cx="5.5" cy="5.5" r="3" />
        <path d="M7.6 7.6 13 13" />
        <line x1="11" y1="11" x2="12.5" y2="9.5" />
      </>
    ),
    check: <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />,
    external: (
      <>
        <path d="M6 3.5H3.2A.7.7 0 0 0 2.5 4.2v8.6a.7.7 0 0 0 .7.7h8.6a.7.7 0 0 0 .7-.7V10" />
        <line x1="8" y1="8" x2="13" y2="3" />
        <polyline points="9.5 3 13 3 13 6.5" />
      </>
    ),
    cloud: <path d="M4.5 12h6a2.5 2.5 0 0 0 .2-5 3.5 3.5 0 0 0-6.7-1A2.75 2.75 0 0 0 4.5 12Z" />,
  }[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {p}
    </svg>
  );
}

function ProviderCard({ provider, onChanged }) {
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { ok, msg }
  const configured = provider.configured;

  async function save() {
    const key = keyInput.trim();
    if (!key) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/_api/generate/keys', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ provider: provider.id, key }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setKeyInput('');
      setStatus({ ok: true, msg: json.configured ? 'Key saved.' : 'Saved.' });
      onChanged();
    } catch (err) {
      setStatus({ ok: false, msg: err && err.message ? err.message : 'save failed' });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/_api/generate/keys', {
        method: 'DELETE',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ provider: provider.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus({ ok: true, msg: 'Key removed.' });
      onChanged();
    } catch (err) {
      setStatus({ ok: false, msg: err && err.message ? err.message : 'remove failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="st-provider-card">
      <div className="st-provider-hd">
        <span className="st-provider-name">{provider.label}</span>
        <span className={'st-pill' + (provider.kind === 'local' ? ' is-local' : '')}>
          {provider.kind === 'local' ? 'Local' : (
            <>
              <Icon name="cloud" size={12} /> Cloud
            </>
          )}
        </span>
        {configured && (
          <span className="st-provider-configured">
            <Icon name="check" size={12} /> configured
          </span>
        )}
      </div>
      <div className="st-provider-modalities">{provider.modalities.join(' · ')}</div>
      {provider.notes && <div className="st-provider-notes">{provider.notes}</div>}
      {provider.keyUrl && (
        <a className="st-provider-keylink" href={provider.keyUrl} target="_blank" rel="noreferrer">
          Get a key <Icon name="external" size={12} />
        </a>
      )}
      {provider.auth === 'api-key' && (
        <div className="st-provider-keyrow">
          <input
            className="input st-provider-keyinput"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={keyInput}
            placeholder={configured ? '•••••••• configured — paste to replace' : 'paste API key'}
            aria-label={`${provider.label} API key`}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
            }}
          />
          <button type="button" className="st-btn" disabled={busy || !keyInput.trim()} onClick={save}>
            <Icon name="key" size={13} /> Save
          </button>
          {configured && (
            <button type="button" className="st-btn" disabled={busy} onClick={remove}>
              Remove
            </button>
          )}
        </div>
      )}
      {status && (
        <div
          className="st-provider-status"
          style={{ color: status.ok ? 'var(--accent)' : 'var(--danger, #e5484d)' }}
        >
          {status.msg}
        </div>
      )}
    </div>
  );
}

// Task 2.6 — the subtitle/transcription engine is an EXPLICIT user choice, never
// an automatic fallback. This radio persists to generation.transcription.provider
// (the /_api/generate/prefs route); `maude design transcribe` reads the same
// default. Local whisper is free/offline/no-key; the cloud engines need a key
// (managed in the provider cards above).
const TRANSCRIPTION_ENGINES = [
  {
    id: 'whisper',
    label: 'Local whisper.cpp',
    note: 'Free · offline · no key · runs on your hardware',
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs Scribe',
    note: 'Cloud · accuracy · needs an ElevenLabs key',
  },
  { id: 'groq', label: 'Groq Whisper', note: 'Cloud · fast · needs a Groq key' },
];

function TranscriptionEngineCard() {
  const [engine, setEngine] = useState(null); // null = loading
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/_api/generate/prefs')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setEngine(d?.transcriptionProvider || 'whisper'))
      .catch(() => setEngine('whisper'));
  }, []);

  async function choose(id) {
    if (id === engine) return;
    const prev = engine;
    setEngine(id);
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/_api/generate/prefs', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ transcriptionProvider: id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus({ ok: true, msg: 'Saved.' });
    } catch (err) {
      setEngine(prev); // revert on failure — no silent state drift
      setStatus({ ok: false, msg: err && err.message ? err.message : 'save failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="st-provider-card">
      <div className="st-provider-hd">
        <span className="st-provider-name">Subtitles — transcription engine</span>
      </div>
      <div className="st-provider-notes">
        Which engine turns audio into subtitles. This is an explicit choice — Maude never silently
        switches engines; a chosen-but-unavailable engine tells you how to fix it.
      </div>
      <div className="st-engine-radios" role="radiogroup" aria-label="Transcription engine">
        {TRANSCRIPTION_ENGINES.map((e) => (
          <label key={e.id} className={'st-engine-radio' + (engine === e.id ? ' is-selected' : '')}>
            <input
              type="radio"
              name="transcription-engine"
              value={e.id}
              checked={engine === e.id}
              disabled={busy || engine === null}
              onChange={() => choose(e.id)}
            />
            <span className="st-engine-radio-body">
              <span className="st-engine-radio-label">{e.label}</span>
              <span className="st-engine-radio-note">{e.note}</span>
            </span>
          </label>
        ))}
      </div>
      {status && (
        <div
          className="st-provider-status"
          style={{ color: status.ok ? 'var(--accent)' : 'var(--danger, #e5484d)' }}
        >
          {status.msg}
        </div>
      )}
    </div>
  );
}

// Task 2.7 (approach A) — one-click local whisper.cpp models. The engine binary
// is still a soft dep, but the MODEL half is one click: download a ggml model
// into a Maude-managed cache and `--provider whisper` auto-resolves it. Polls
// the download progress from the privileged /_api/generate/whisper-model route.
function WhisperModelCard() {
  const [state, setState] = useState(null); // { models, downloading } | null
  const [err, setErr] = useState(null);

  const load = useCallback(() => {
    fetch('/_api/generate/whisper-model')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setState)
      .catch((e) => setErr(e && e.message ? e.message : 'failed to load models'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while a download is in flight.
  useEffect(() => {
    if (!state?.downloading) return undefined;
    const t = setInterval(load, 1000);
    return () => clearInterval(t);
  }, [state?.downloading, load]);

  async function download(id) {
    setErr(null);
    try {
      const res = await fetch('/_api/generate/whisper-model', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(await res.text());
      load();
    } catch (e) {
      setErr(e && e.message ? e.message : 'download failed');
    }
  }

  async function remove(id) {
    setErr(null);
    try {
      const res = await fetch('/_api/generate/whisper-model', {
        method: 'DELETE',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(await res.text());
      load();
    } catch (e) {
      setErr(e && e.message ? e.message : 'remove failed');
    }
  }

  const dl = state?.downloading;
  const pctOf = (r, t) => (t > 0 ? Math.min(100, Math.round((r / t) * 100)) : 0);

  return (
    <div className="st-provider-card">
      <div className="st-provider-hd">
        <span className="st-provider-name">Local subtitle models (whisper.cpp)</span>
      </div>
      <div className="st-provider-notes">
        Download a model once and local subtitles work offline, free, with no key. Requires the
        whisper.cpp binary (<code>brew install whisper-cpp</code>). Models are stored on this machine
        only and never committed.
      </div>
      {err && (
        <div className="st-provider-status" style={{ color: 'var(--danger, #e5484d)' }}>
          {err}
        </div>
      )}
      {dl?.error && (
        <div className="st-provider-status" style={{ color: 'var(--danger, #e5484d)' }}>
          Download of {dl.id} failed: {dl.error}
        </div>
      )}
      {state === null && !err && <div className="st-settings-intro">Loading…</div>}
      <div className="st-model-list">
        {(state?.models || []).map((m) => {
          const busy = dl && !dl.error && dl.id === m.id;
          return (
            <div key={m.id} className="st-model-row">
              <div className="st-model-info">
                <span className="st-model-label">
                  {m.label}
                  <span className={'st-pill' + (m.multilingual ? '' : ' is-local')}>
                    {m.multilingual ? 'multilingual' : 'English-only'}
                  </span>
                  <span className="st-model-size">~{m.sizeMB} MB</span>
                </span>
                <span className="st-engine-radio-note">{m.note}</span>
                {busy && (
                  <span className="st-model-progress">
                    Downloading… {pctOf(dl.received, dl.total)}%
                  </span>
                )}
              </div>
              <div className="st-model-actions">
                {m.downloaded ? (
                  <>
                    <span className="st-provider-configured">
                      <Icon name="check" size={12} /> ready
                    </span>
                    <button type="button" className="st-btn" onClick={() => remove(m.id)}>
                      Remove
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="st-btn"
                    disabled={!!(dl && !dl.error)}
                    onClick={() => download(m.id)}
                  >
                    {busy ? 'Downloading…' : 'Download'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// feature-unified-settings-modal — one modal for every Maude preference, laid
// out as a left vertical tab rail + an internally-scrolling pane. Categories:
const TABS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'canvas-view', label: 'Canvas & View' },
  { id: 'layout', label: 'Layout' },
  { id: 'ai-generation', label: 'AI generation' },
  { id: 'subtitles', label: 'Subtitles' },
];
const SETTINGS_TAB_STORE = 'mdcc-settings-tab';

// feature-configurable-panel-docking — the panels the Layout tab can dock. Order
// = display order. (Assistant is native-only; moving it is a no-op in the browser.)
const LAYOUT_PANELS = [
  { id: 'tree', label: 'Files' },
  { id: 'layers', label: 'Layers' },
  { id: 'inspector', label: 'Inspector' },
  { id: 'comments', label: 'Comments' },
  { id: 'changes', label: 'Changes' },
  { id: 'assistant', label: 'Assistant' },
];

function SideToggle({ value, disabled, onChange }) {
  return (
    <span className="st-sidetoggle" role="radiogroup" aria-label="Panel side">
      {['left', 'right'].map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          disabled={disabled}
          className={'st-sidebtn' + (value === s ? ' is-active' : '')}
          onClick={() => onChange(s)}
        >
          {s === 'left' ? 'Left' : 'Right'}
        </button>
      ))}
    </span>
  );
}

const LAYERS_MODE_OPTIONS = [
  { id: 'separate', label: 'Separate panel', note: 'Layers docks on its own (default: left).' },
  { id: 'in-inspector', label: 'Inside Inspector', note: 'Layers is a tab within the Inspector.' },
];
function LayoutTab({ panelSide, onSetPanelSide, layersMode, onSetLayersMode }) {
  return (
    <>
      <div className="st-provider-card">
        <div className="st-provider-hd">
          <span className="st-provider-name">Layers panel</span>
        </div>
        <div className="st-provider-notes">
          Show Layers as its own dockable panel, or as a tab inside the Inspector.
        </div>
        <div className="st-engine-radios" role="radiogroup" aria-label="Layers mode">
          {LAYERS_MODE_OPTIONS.map((o) => (
            <label
              key={o.id}
              className={'st-engine-radio' + (layersMode === o.id ? ' is-selected' : '')}
            >
              <input
                type="radio"
                name="layers-mode"
                checked={layersMode === o.id}
                onChange={() => onSetLayersMode(o.id)}
              />
              <span className="st-engine-radio-body">
                <span className="st-engine-radio-label">{o.label}</span>
                <span className="st-engine-radio-note">{o.note}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="st-provider-card">
        <div className="st-provider-hd">
          <span className="st-provider-name">Panel positions</span>
        </div>
        <div className="st-provider-notes">
          Dock each panel to the left or right side. Each side shows one panel at a time, with tabs
          to switch between the panels docked there.
        </div>
        {LAYOUT_PANELS.map((p) => {
          const disabled = p.id === 'layers' && layersMode !== 'separate';
          return (
            <div key={p.id} className={'st-pref-row' + (disabled ? ' is-disabled' : '')}>
              <span className="st-pref-body">
                <span className="st-pref-label">{p.label}</span>
                {disabled && (
                  <span className="st-pref-note">
                    Layers is inside the Inspector — choose “Separate panel” above to dock it.
                  </span>
                )}
              </span>
              <SideToggle
                value={panelSide?.[p.id] || 'left'}
                disabled={disabled}
                onChange={(s) => onSetPanelSide(p.id, s)}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

// A labeled switch row. The `checked`/`onChange` are owned by app.jsx state
// (single source of truth) so the modal and the View menu never diverge.
function PrefToggleRow({ label, note, checked, disabled, reason, onChange }) {
  return (
    <label className={'st-pref-row' + (disabled ? ' is-disabled' : '')}>
      <span className="st-pref-body">
        <span className="st-pref-label">{label}</span>
        {(reason || note) && <span className="st-pref-note">{disabled && reason ? reason : note}</span>}
      </span>
      <input
        type="checkbox"
        className="st-switch"
        role="switch"
        aria-checked={!!checked}
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </label>
  );
}

// Appearance — theme control. Reuses the transcription-engine radio density so
// the whole modal reads as one system. Wired to app.jsx `theme` + `onSetTheme`.
const THEME_OPTIONS = [
  { id: 'light', label: 'Light', note: 'Bright shell chrome' },
  { id: 'dark', label: 'Dark', note: 'Dim shell chrome' },
];
function AppearanceTab({ theme, onSetTheme }) {
  return (
    <div className="st-provider-card">
      <div className="st-provider-hd">
        <span className="st-provider-name">Theme</span>
      </div>
      <div className="st-provider-notes">
        Controls Maude’s own chrome — menubar, sidebar, canvas plane, minimap, zoom HUD. Artboards
        keep their own design-system theme.
      </div>
      <div className="st-engine-radios" role="radiogroup" aria-label="Theme">
        {THEME_OPTIONS.map((o) => (
          <label key={o.id} className={'st-engine-radio' + (theme === o.id ? ' is-selected' : '')}>
            <input
              type="radio"
              name="maude-theme"
              value={o.id}
              checked={theme === o.id}
              onChange={() => onSetTheme?.(o.id)}
            />
            <span className="st-engine-radio-body">
              <span className="st-engine-radio-label">{o.label}</span>
              <span className="st-engine-radio-note">{o.note}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPanel({
  onClose,
  initialTab,
  theme,
  onSetTheme,
  minimapVisible,
  onToggleMinimap,
  zoomCtlVisible,
  onToggleZoomCtl,
  annotationsVisible,
  onToggleAnnotations,
  autoOpenInspector,
  onToggleAutoOpenInspector,
  hasCanvas = false,
  panelSide,
  onSetPanelSide,
  layersMode,
  onSetLayersMode,
}) {
  const [providers, setProviders] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(() => {
    if (initialTab && TABS.some((t) => t.id === initialTab)) return initialTab;
    try {
      const v = localStorage.getItem(SETTINGS_TAB_STORE);
      if (v && TABS.some((t) => t.id === v)) return v;
    } catch {}
    return 'appearance';
  });

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_TAB_STORE, tab);
    } catch {}
  }, [tab]);

  const load = useCallback(() => {
    fetch('/_api/generate/providers')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setProviders(Array.isArray(d?.providers) ? d.providers : []))
      .catch((err) => setError(err && err.message ? err.message : 'failed to load providers'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Vertical roving focus over the tab rail (native-menu parity).
  function onRailKey(e) {
    const idx = TABS.findIndex((t) => t.id === tab);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      setTab(TABS[(idx + 1) % TABS.length].id);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setTab(TABS[(idx - 1 + TABS.length) % TABS.length].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setTab(TABS[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      setTab(TABS[TABS.length - 1].id);
    }
  }

  // Minimap / zoom-controls are canvas-scoped — mirror the View menu's
  // `disabled: !activePath || isSystem` gate and say why inline.
  const canvasReason = !hasCanvas ? 'Open a canvas to use this.' : undefined;

  return (
    <div
      className="st-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="st-dialog is-settings" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="st-dialog-hd">
          <span className="st-dialog-title">Settings</span>
          <button type="button" className="st-iconbtn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="st-settings-tabs">
          <div
            className="st-settings-rail"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Settings categories"
            onKeyDown={onRailKey}
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`st-stab-${t.id}`}
                aria-controls={`st-spanel-${t.id}`}
                aria-selected={tab === t.id}
                tabIndex={tab === t.id ? 0 : -1}
                className={'st-settings-tab' + (tab === t.id ? ' is-active' : '')}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="st-settings-pane">
            {/* Appearance */}
            <section
              role="tabpanel"
              id="st-spanel-appearance"
              aria-labelledby="st-stab-appearance"
              hidden={tab !== 'appearance'}
            >
              <div className="st-rp-hd">Appearance</div>
              <AppearanceTab theme={theme} onSetTheme={onSetTheme} />
            </section>

            {/* Canvas & View — the persistent View-menu prefs, one canonical home. */}
            <section
              role="tabpanel"
              id="st-spanel-canvas-view"
              aria-labelledby="st-stab-canvas-view"
              hidden={tab !== 'canvas-view'}
            >
              <div className="st-rp-hd">Canvas &amp; View</div>
              <PrefToggleRow
                label="Minimap"
                note="Show the canvas minimap overlay."
                checked={minimapVisible}
                disabled={!hasCanvas}
                reason={canvasReason}
                onChange={() => onToggleMinimap?.()}
              />
              <PrefToggleRow
                label="Zoom controls"
                note="Show the floating zoom controls on the canvas."
                checked={zoomCtlVisible}
                disabled={!hasCanvas}
                reason={canvasReason}
                onChange={() => onToggleZoomCtl?.()}
              />
              <PrefToggleRow
                label="Annotations"
                note="Show annotation pins and overlays on the canvas."
                checked={annotationsVisible}
                onChange={() => onToggleAnnotations?.()}
              />
              <PrefToggleRow
                label="Auto-open Inspector on select"
                note="Open the Inspector automatically when you select an element."
                checked={autoOpenInspector}
                onChange={() => onToggleAutoOpenInspector?.()}
              />
            </section>

            {/* Layout — dock panels left/right + Layers mode. */}
            <section
              role="tabpanel"
              id="st-spanel-layout"
              aria-labelledby="st-stab-layout"
              hidden={tab !== 'layout'}
            >
              <div className="st-rp-hd">Layout</div>
              <LayoutTab
                panelSide={panelSide}
                onSetPanelSide={onSetPanelSide}
                layersMode={layersMode}
                onSetLayersMode={onSetLayersMode}
              />
            </section>

            {/* AI generation — BYOK provider keys (kept mounted so the fetch runs once). */}
            <section
              role="tabpanel"
              id="st-spanel-ai-generation"
              aria-labelledby="st-stab-ai-generation"
              hidden={tab !== 'ai-generation'}
            >
              <div className="st-rp-hd">Provider keys</div>
              <p className="st-settings-intro">
                Bring your own API keys to generate images (and, soon, audio + video) inside Maude.
                Keys are stored on this machine only — in your OS keychain or a private{' '}
                <code>~/.config/maude/keys.json</code> (mode 0600) — sent straight to the provider,
                and never committed, logged, or exposed to a canvas.
              </p>
              {error && (
                <div className="st-provider-status" style={{ color: 'var(--danger, #e5484d)' }}>
                  {error}
                </div>
              )}
              {providers === null && !error && <div className="st-settings-intro">Loading…</div>}
              {providers?.map((p) => (
                <ProviderCard key={p.id} provider={p} onChanged={load} />
              ))}
              {providers?.length === 0 && (
                <div className="st-settings-intro">No providers registered.</div>
              )}
            </section>

            {/* Subtitles — kept mounted so WhisperModelCard's download poll survives
                a tab switch (unmounting mid-download would drop the interval). */}
            <section
              role="tabpanel"
              id="st-spanel-subtitles"
              aria-labelledby="st-stab-subtitles"
              hidden={tab !== 'subtitles'}
            >
              <div className="st-rp-hd">Subtitles</div>
              <TranscriptionEngineCard />
              <WhisperModelCard />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
