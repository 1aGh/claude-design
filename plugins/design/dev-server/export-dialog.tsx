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

// ─────────────────────────────────────────────────────────────────────────────
// Types

export type Format = 'png' | 'pdf' | 'svg' | 'html' | 'pptx' | 'canva' | 'zip';
export type Scope = 'selection' | 'artboard' | 'canvas-as-separate' | 'project-raw';

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
  border: 1px solid var(--u-fg-0, #1c1917);
  padding: 0;
  border-radius: 0;
  background: var(--u-bg-2, var(--bg-1, #fff));
  box-shadow: 4px 4px 0 var(--u-fg-0, #1c1917);
  font-family: var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  color: var(--u-fg-0, var(--fg-0, #1a1a1a));
  width: min(640px, 100vw - 48px);
  max-height: min(560px, 100vh - 48px);
  overflow: hidden;
}
.dc-export-dialog::backdrop { background: rgba(20, 20, 30, 0.32); }
.dc-export-dialog header { padding: 16px 20px; border-bottom: 1px solid var(--u-border-subtle, rgba(0,0,0,0.08)); display: flex; justify-content: space-between; align-items: center; }
.dc-export-dialog header h2 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.005em; }
.dc-export-dialog header .dc-ed-close { background: transparent; border: 0; cursor: pointer; padding: 4px 8px; color: var(--fg-1, rgba(40,30,20,0.6)); font: inherit; font-size: 12px; }
.dc-export-dialog .dc-ed-body { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px 20px; }
.dc-export-dialog label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-2, rgba(40,30,20,0.5)); margin-bottom: 6px; }
.dc-export-dialog select { width: 100%; padding: 8px 10px; border-radius: 0; border: 1px solid var(--u-fg-0, rgba(0,0,0,0.12)); background: var(--u-bg-1, var(--bg-0, #fafafa)); font: inherit; font-size: 13px; color: inherit; }
.dc-export-dialog .dc-ed-desc { font-size: 12px; color: var(--fg-1, rgba(40,30,20,0.65)); margin-top: 6px; line-height: 1.4; }
.dc-export-dialog .dc-ed-recent { padding: 12px 20px; border-top: 1px solid var(--u-border-subtle, rgba(0,0,0,0.08)); background: var(--bg-2, rgba(0,0,0,0.02)); }
.dc-export-dialog .dc-ed-recent h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-2, rgba(40,30,20,0.5)); margin: 0 0 8px; }
.dc-export-dialog .dc-ed-recent ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto; }
.dc-export-dialog .dc-ed-recent button { display: flex; justify-content: space-between; gap: 12px; padding: 5px 12px; background: transparent; border: 1px solid transparent; border-radius: 0; cursor: pointer; font: inherit; font-size: 12px; color: inherit; width: 100%; text-align: left; }
.dc-export-dialog .dc-ed-recent button:hover { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.06); }
.dc-export-dialog footer { padding: 12px 20px; border-top: 1px solid var(--u-border-subtle, rgba(0,0,0,0.08)); display: flex; justify-content: flex-end; gap: 8px; }
.dc-export-dialog footer button { padding: 8px 14px; border-radius: 0; border: 1px solid var(--u-fg-0, rgba(0,0,0,0.12)); background: var(--u-bg-1, var(--bg-0, #fafafa)); font: inherit; font-size: 12px; cursor: pointer; color: inherit; }
.dc-export-dialog footer button.dc-ed-primary { background: var(--accent, #1a1a1a); color: var(--accent-fg, #fff); border-color: transparent; }
.dc-export-dialog footer button:disabled { opacity: 0.4; cursor: not-allowed; }
.dc-export-dialog .dc-ed-status { padding: 8px 20px; font-size: 12px; color: var(--fg-1, rgba(40,30,20,0.65)); border-top: 1px solid var(--u-border-subtle, rgba(0,0,0,0.08)); }
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
                    <span style={{ color: 'var(--fg-2, rgba(40,30,20,0.5))' }}>{h.filename}</span>
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
            onClick={() => onSubmit(format, scope, {})}
          >
            {submitting ? 'Exporting…' : 'Export'}
          </button>
        </footer>
      </dialog>
    );
  }
  return Shell;
})();
