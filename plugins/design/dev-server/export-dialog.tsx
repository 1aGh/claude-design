/**
 * @file       export-dialog.tsx — Phase 6.5 T8 export dialog.
 * @scope      plugins/design/dev-server/export-dialog.tsx
 * @purpose    Native `<dialog>`-based export modal. Three controls — format,
 *             scope, per-format options — plus a Recent tab populated by
 *             `/_api/export-history`. Submit fires `POST /_api/export`, the
 *             response is piped to a Blob URL anchor download. `⌘E` opens
 *             the dialog from anywhere inside the canvas; `⌘⇧E` re-runs the
 *             most recent export without opening (T10 fast path).
 *
 *             Mounts inside the canvas runtime alongside tool-palette and
 *             context-menu; consumer wraps the canvas with
 *             `<ExportDialogProvider>` to make `useExportDialog()` available.
 */

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useSelectionSetOptional } from './use-selection-set.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Types

// ─── cross-origin export bridge ──────────────────────────────────────────────
// This dialog renders INSIDE the canvas iframe. Since phase-9.1 the canvas is
// served from a segregated origin (default ON) whose CSP is `connect-src 'self'`
// and whose route allowlist deliberately excludes the privileged /_api/export +
// /_api/export-history (DDR-060). A direct in-iframe fetch therefore 403s
// ("Forbidden (canvas origin)"). When the parent is cross-origin we ask the
// trusted main shell (app.jsx onMessage) to run the request same-origin via a
// `dgn` postMessage — the channel comments/selection already use. When the split
// is OFF (same-origin iframe) we fall through to the direct fetch.

/** True when framed by a different origin (the canvas-origin split is on). */
function isCrossOriginFramed(): boolean {
  if (typeof window === 'undefined' || window.parent === window) return false;
  try {
    // Same-origin parent → this read succeeds → split is OFF, use direct fetch.
    void window.parent.location.href;
    return false;
  } catch {
    return true;
  }
}

/** Parent (main shell) origin, for postMessage targeting. */
function parentOrigin(): string {
  try {
    if (document.referrer) return new URL(document.referrer).origin;
  } catch {
    /* fall through to wildcard */
  }
  return '*';
}

let bridgeSeq = 0;

/**
 * Post one request to the parent shell and resolve with its matching reply.
 * Only accepts a reply from the parent window (source check) with the matching
 * id; rejects on a 60 s timeout so a dropped reply can't hang the dialog.
 */
function bridgeRequest<T>(
  reqDgn: string,
  resDgn: string,
  extra: Record<string, unknown>
): Promise<T> {
  bridgeSeq += 1;
  const id = `exp-${bridgeSeq}`;
  return new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const m = e.data as { dgn?: string; id?: string } | null;
      if (!m || typeof m !== 'object' || m.dgn !== resDgn || m.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
      resolve(m as unknown as T);
    };
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMsg);
      reject(new Error('export bridge timed out'));
    }, 60_000);
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ dgn: reqDgn, id, ...extra }, parentOrigin());
  });
}

export type Format = 'png' | 'pdf' | 'svg' | 'html' | 'pptx' | 'canva' | 'zip';
export type Scope = 'selection' | 'artboard' | 'canvas-as-separate' | 'project-raw';

// ─── PNG size presets (item 1) ───────────────────────────────────────────────
// Resolution multiplier applied as Chromium `deviceScaleFactor`. The native
// artboard is 1440×900; 2× → 2880×1800. Default 2× because a single-scale PNG
// was uselessly small. The shim clamps deviceScaleFactor ≤ 4.
type PngScale = 1 | 2 | 3;
const PNG_SCALES: ReadonlyArray<{ value: PngScale; label: string }> = [
  { value: 1, label: '1× (native)' },
  { value: 2, label: '2× (retina)' },
  { value: 3, label: '3× (max)' },
];
const DEFAULT_PNG_SCALE: PngScale = 2;

/**
 * The artboard under the viewport centre — the export dialog's notion of "the
 * active artboard" when nothing is selected. getBoundingClientRect is in
 * screen coords (post-zoom) so the centre-distance metric is zoom-invariant.
 * Returns undefined off-DOM (tests) or when the canvas has no artboards.
 */
function activeArtboardId(): string | undefined {
  if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
  const screens = Array.from(document.querySelectorAll('[data-dc-screen]'));
  if (!screens.length) return undefined;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  let best: Element | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const el of screens) {
    const r = el.getBoundingClientRect();
    const dx = (r.left + r.right) / 2 - cx;
    const dy = (r.top + r.bottom) / 2 - cy;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = el;
    }
  }
  return best?.getAttribute('data-dc-screen') ?? undefined;
}

/**
 * Snapshot the live canvas selection + active artboard at submit time so the
 * export is independent of whether opening the dialog cleared the persisted
 * `_active.json.selected`. Rides the `options` bag through the cross-origin
 * bridge into `resolveScope` (see scope.ts `ExportScopeHints`). `selSet` is the
 * optional selection-set context — null when the dialog is mounted outside a
 * provider (tests), in which case we still contribute the viewport-centre
 * artboard id.
 */
function captureScopeHints(
  selSet: {
    selected: Array<{ selector?: string; file?: string; artboardId?: string | null }>;
  } | null
): { selection?: { selector: string; file?: string }; artboardId?: string } {
  const out: { selection?: { selector: string; file?: string }; artboardId?: string } = {};
  const sel = selSet?.selected?.[0];
  if (sel?.selector) {
    out.selection = { selector: sel.selector, ...(sel.file ? { file: sel.file } : {}) };
  }
  const artboardId = (sel?.artboardId ?? undefined) || activeArtboardId();
  if (artboardId) out.artboardId = artboardId;
  return out;
}

const FORMAT_META: Record<Format, { label: string; description: string; defaultExt: string }> = {
  png: { label: 'PNG', description: 'Raster image, one per artboard.', defaultExt: '.png' },
  pdf: { label: 'PDF', description: 'Multi-page PDF, one page per artboard.', defaultExt: '.pdf' },
  svg: {
    label: 'SVG',
    description: 'Vector wrapper over rendered HTML. Editable in Illustrator.',
    defaultExt: '.svg',
  },
  html: {
    label: 'HTML',
    description: 'Standalone runnable bundle. Drop into a static host.',
    defaultExt: '.zip',
  },
  pptx: {
    label: 'PPTX',
    description: 'Editable PowerPoint. Opens in Keynote, Google Slides.',
    defaultExt: '.pptx',
  },
  canva: {
    label: 'Canva',
    description: 'PPTX + handoff prompt. Drag into Canva or feed to your Canva MCP.',
    defaultExt: '.zip',
  },
  zip: {
    label: 'ZIP (source)',
    description: 'Entire .design/ as raw source files. No renders.',
    defaultExt: '.zip',
  },
};

const SCOPE_META: Record<Scope, { label: string; description: string }> = {
  selection: { label: 'Selection', description: 'Just the currently-selected element.' },
  artboard: { label: 'Artboard', description: 'The single artboard containing the selection.' },
  'canvas-as-separate': {
    label: 'Canvas → separate',
    description: 'Every artboard on the active canvas as N files.',
  },
  'project-raw': {
    label: 'Project (raw)',
    description: 'The entire `.design/` tree, minus runtime files.',
  },
};

const VALID_SCOPES_PER_FORMAT: Record<Format, Scope[]> = {
  png: ['selection', 'artboard', 'canvas-as-separate'],
  pdf: ['selection', 'artboard', 'canvas-as-separate'],
  svg: ['selection', 'artboard', 'canvas-as-separate'],
  html: ['artboard', 'canvas-as-separate'],
  pptx: ['canvas-as-separate'],
  canva: ['canvas-as-separate'],
  zip: ['project-raw'],
};

export interface ExportHistoryEntry {
  format: Format;
  scope: Scope;
  options?: Record<string, unknown>;
  filename: string;
  at: string;
}

interface OpenOptions {
  /** Pre-fills the scope dropdown (e.g. from context-menu "Export this artboard"). */
  scope?: Scope;
  /** Pre-fills format. */
  format?: Format;
}

interface ExportDialogValue {
  open(opts?: OpenOptions): void;
  close(): void;
  /** Re-run the most recent export without opening the dialog. */
  rerunLast(): Promise<void>;
}

const ExportDialogContext = createContext<ExportDialogValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// CSS — visual language mirrors tool-palette + context-menu (8 px radius,
// hairline border, soft shadow). Scoped to .dc-export-dialog.

const DIALOG_CSS = `
.dc-export-dialog {
  border: 1px solid var(--maude-chrome-fg-0, #1c1917);
  padding: 0;
  border-radius: 8px;
  background: var(--maude-chrome-bg-0, #fff);
  box-shadow: 0 6px 24px var(--maude-chrome-shadow, color-mix(in oklab, #1c1917 10%, transparent));
  font-family: var(--maude-chrome-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  color: var(--maude-chrome-fg-0, #1a1a1a);
  width: min(640px, 100vw - 48px);
  max-height: min(560px, 100vh - 48px);
  overflow: hidden;
}
.dc-export-dialog::backdrop { background: rgba(20, 20, 30, 0.32); }
.dc-export-dialog header { padding: 16px 20px; border-bottom: 1px solid var(--maude-chrome-border, rgba(0,0,0,0.08)); display: flex; justify-content: space-between; align-items: center; }
.dc-export-dialog header h2 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.005em; }
.dc-export-dialog header .dc-ed-close { background: transparent; border: 0; cursor: pointer; padding: 4px 8px; color: var(--maude-chrome-fg-1, rgba(40,30,20,0.6)); font: inherit; font-size: 12px; }
.dc-export-dialog .dc-ed-body { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px 20px; }
.dc-export-dialog label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--maude-chrome-fg-1, rgba(40,30,20,0.5)); margin-bottom: 6px; }
.dc-export-dialog select { width: 100%; padding: 8px 10px; border-radius: 0; border: 1px solid var(--maude-chrome-fg-0, rgba(0,0,0,0.12)); background: var(--maude-chrome-bg-1, #fafafa); font: inherit; font-size: 13px; color: inherit; }
.dc-export-dialog .dc-ed-desc { font-size: 12px; color: var(--maude-chrome-fg-1, rgba(40,30,20,0.65)); margin-top: 6px; line-height: 1.4; }
.dc-export-dialog .dc-ed-recent { padding: 12px 20px; border-top: 1px solid var(--maude-chrome-border, rgba(0,0,0,0.08)); background: var(--maude-chrome-bg-2, rgba(0,0,0,0.02)); }
.dc-export-dialog .dc-ed-recent h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--maude-chrome-fg-1, rgba(40,30,20,0.5)); margin: 0 0 8px; }
.dc-export-dialog .dc-ed-recent ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto; }
.dc-export-dialog .dc-ed-recent button { display: flex; justify-content: space-between; gap: 12px; padding: 5px 12px; background: transparent; border: 1px solid transparent; border-radius: 0; cursor: pointer; font: inherit; font-size: 12px; color: inherit; width: 100%; text-align: left; }
.dc-export-dialog .dc-ed-recent button:hover { background: color-mix(in oklab, var(--maude-chrome-fg-0, #1c1917) 5%, transparent); border-color: color-mix(in oklab, var(--maude-chrome-fg-0, #1c1917) 8%, transparent); }
.dc-export-dialog footer { padding: 12px 20px; border-top: 1px solid var(--maude-chrome-border, rgba(0,0,0,0.08)); display: flex; justify-content: flex-end; gap: 8px; }
.dc-export-dialog footer button { padding: 8px 14px; border-radius: 0; border: 1px solid var(--maude-chrome-fg-0, rgba(0,0,0,0.12)); background: var(--maude-chrome-bg-1, #fafafa); font: inherit; font-size: 12px; cursor: pointer; color: inherit; }
.dc-export-dialog footer button.dc-ed-primary { background: var(--maude-hud-accent, #1a1a1a); color: var(--maude-hud-accent-fg, #fff); border-color: transparent; }
.dc-export-dialog footer button:disabled { opacity: 0.4; cursor: not-allowed; }
.dc-export-dialog .dc-ed-status { padding: 8px 20px; font-size: 12px; color: var(--maude-chrome-fg-1, rgba(40,30,20,0.65)); border-top: 1px solid var(--maude-chrome-border, rgba(0,0,0,0.08)); }
.dc-export-dialog .dc-ed-status.is-error { color: var(--status-error, #c0392b); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Provider

export function ExportDialogProvider({ children }: { children: ReactNode }): ReactNode {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [openState, setOpenState] = useState<OpenOptions | null>(null);
  const [history, setHistory] = useState<ExportHistoryEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);

  const open = useCallback((opts?: OpenOptions) => {
    setStatus(null);
    setOpenState(opts ?? {});
  }, []);
  const close = useCallback(() => {
    setOpenState(null);
    dialogRef.current?.close();
  }, []);

  // Pre-load history when the dialog opens; refresh after each export.
  const loadHistory = useCallback(async () => {
    try {
      if (isCrossOriginFramed()) {
        const res = await bridgeRequest<{ history?: ExportHistoryEntry[] }>(
          'export-history-request',
          'export-history-result',
          {}
        );
        setHistory(Array.isArray(res.history) ? res.history : []);
        return;
      }
      const r = await fetch('/_api/export-history');
      if (!r.ok) return;
      const data = (await r.json()) as { history: ExportHistoryEntry[] };
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch {
      /* ignore — history is best-effort */
    }
  }, []);

  useEffect(() => {
    if (!openState) return;
    void loadHistory();
    dialogRef.current?.showModal();
  }, [openState, loadHistory]);

  // ⌘E / Ctrl+E to open; ⌘⇧E / Ctrl+Shift+E to re-run last.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'e') return;
      e.preventDefault();
      if (e.shiftKey) void rerunLast();
      else open();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Phase 6.5 T9 — context-menu entries dispatch `maude:open-export` so they
  // don't have to prop-drill the dialog handle through every consumer.
  useEffect(() => {
    function onCustom(e: Event) {
      const detail = (e as CustomEvent<{ scope?: Scope; format?: Format }>).detail ?? {};
      open(detail);
    }
    window.addEventListener('maude:open-export', onCustom as EventListener);
    return () => window.removeEventListener('maude:open-export', onCustom as EventListener);
  }, [open]);

  // ─── submit handlers ─────────────────────────────────────────────────────
  const submit = useCallback(
    async (format: Format, scope: Scope, options: Record<string, unknown>) => {
      setSubmitting(true);
      setStatus(null);
      try {
        if (isCrossOriginFramed()) {
          // Bridge through the main shell — the iframe can't reach /_api/export
          // (canvas origin 403s it). The parent runs the export + triggers the
          // download, then replies with the saved filename or an error string.
          const res = await bridgeRequest<{ ok?: boolean; filename?: string; error?: string }>(
            'export-request',
            'export-result',
            { payload: { format, scope, options } }
          );
          if (!res.ok) {
            setStatus({ text: `Export failed: ${res.error || 'unknown'}`, isError: true });
            return;
          }
          setStatus({ text: `Saved ${res.filename ?? 'export'}`, isError: false });
          void loadHistory();
          return;
        }
        const r = await fetch('/_api/export', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ format, scope, options }),
        });
        if (!r.ok) {
          const text = await r.text();
          setStatus({ text: `Export failed: ${text || r.status}`, isError: true });
          return;
        }
        const disp = r.headers.get('Content-Disposition') ?? '';
        const filename =
          /filename="([^"]+)"/.exec(disp)?.[1] ?? `export${FORMAT_META[format].defaultExt}`;
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus({ text: `Saved ${filename}`, isError: false });
        void loadHistory();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({ text: `Export failed: ${msg}`, isError: true });
      } finally {
        setSubmitting(false);
      }
    },
    [loadHistory]
  );

  const rerunLast = useCallback(async () => {
    await loadHistory();
    const last = history[0];
    if (!last) return;
    await submit(last.format, last.scope, last.options ?? {});
  }, [history, loadHistory, submit]);

  const ctxValue = useMemo<ExportDialogValue>(
    () => ({ open, close, rerunLast }),
    [open, close, rerunLast]
  );

  return (
    <ExportDialogContext.Provider value={ctxValue}>
      <style>{DIALOG_CSS}</style>
      {children}
      <DialogShell
        ref={dialogRef}
        openState={openState}
        onClose={close}
        onSubmit={submit}
        history={history}
        submitting={submitting}
        status={status}
      />
    </ExportDialogContext.Provider>
  );
}

export function useExportDialog(): ExportDialogValue | null {
  return useContext(ExportDialogContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner shell — pure form. Pulled out so the provider stays focused on state.

const DialogShell = (() => {
  function Shell(props: {
    ref: React.Ref<HTMLDialogElement>;
    openState: OpenOptions | null;
    onClose: () => void;
    onSubmit: (format: Format, scope: Scope, options: Record<string, unknown>) => void;
    history: ExportHistoryEntry[];
    submitting: boolean;
    status: { text: string; isError: boolean } | null;
  }) {
    const { ref, openState, onClose, onSubmit, history, submitting, status } = props;
    const [format, setFormat] = useState<Format>('png');
    const [scope, setScope] = useState<Scope>('artboard');
    const [pngScale, setPngScale] = useState<PngScale>(DEFAULT_PNG_SCALE);
    // Optional — the dialog can be mounted in tests without a provider.
    const selSet = useSelectionSetOptional();

    // Build the options bag at submit time: snapshot the live selection /
    // active artboard (items 3 & 5) plus the PNG size (item 1).
    const handleSubmit = useCallback(() => {
      const options: Record<string, unknown> = {};
      const hints = captureScopeHints(selSet);
      if (hints.selection) options.selection = hints.selection;
      if (hints.artboardId) options.artboardId = hints.artboardId;
      if (format === 'png') options.scale = pngScale;
      onSubmit(format, scope, options);
    }, [selSet, format, scope, pngScale, onSubmit]);

    useEffect(() => {
      if (!openState) return;
      if (openState.format) setFormat(openState.format);
      if (openState.scope) setScope(openState.scope);
    }, [openState]);

    // Keep the scope valid against the chosen format.
    useEffect(() => {
      const valid = VALID_SCOPES_PER_FORMAT[format];
      if (!valid.includes(scope)) {
        setScope(valid[0] ?? 'artboard');
      }
    }, [format, scope]);

    if (!openState) {
      return <dialog ref={ref} className="dc-export-dialog" onClose={onClose} />;
    }

    return (
      <dialog ref={ref} className="dc-export-dialog" onClose={onClose}>
        <header>
          <h2>Export</h2>
          <button type="button" className="dc-ed-close" onClick={onClose}>
            Esc
          </button>
        </header>
        <div className="dc-ed-body">
          <div>
            <label htmlFor="dc-ed-format">Format</label>
            <select
              id="dc-ed-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
            >
              {(Object.keys(FORMAT_META) as Format[]).map((f) => (
                <option key={f} value={f}>
                  {FORMAT_META[f].label}
                </option>
              ))}
            </select>
            <p className="dc-ed-desc">{FORMAT_META[format].description}</p>
          </div>
          <div>
            <label htmlFor="dc-ed-scope">Scope</label>
            <select
              id="dc-ed-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
            >
              {VALID_SCOPES_PER_FORMAT[format].map((s) => (
                <option key={s} value={s}>
                  {SCOPE_META[s].label}
                </option>
              ))}
            </select>
            <p className="dc-ed-desc">{SCOPE_META[scope].description}</p>
          </div>
          {format === 'png' && (
            <div>
              <label htmlFor="dc-ed-png-scale">Size</label>
              <select
                id="dc-ed-png-scale"
                value={pngScale}
                onChange={(e) => setPngScale(Number(e.target.value) as PngScale)}
              >
                {PNG_SCALES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="dc-ed-desc">
                Resolution multiplier. 2× ≈ 2880×1800 for a 1440×900 artboard.
              </p>
            </div>
          )}
        </div>
        {history.length > 0 && (
          <div className="dc-ed-recent">
            <h3>Recent</h3>
            <ul>
              {history.slice(0, 5).map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setFormat(h.format);
                      setScope(h.scope);
                    }}
                  >
                    <span>
                      {FORMAT_META[h.format].label} · {SCOPE_META[h.scope].label}
                    </span>
                    <span style={{ color: 'var(--maude-chrome-fg-1, rgba(40,30,20,0.5))' }}>
                      {h.filename}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {status && (
          <div className={`dc-ed-status${status.isError ? ' is-error' : ''}`}>{status.text}</div>
        )}
        <footer>
          <button type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="dc-ed-primary"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Exporting…' : 'Export'}
          </button>
        </footer>
      </dialog>
    );
  }
  return Shell;
})();
