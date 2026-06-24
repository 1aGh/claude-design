// First-open AI-editing readiness list (DDR-128). Reads GET /_api/preflight and
// renders one row per dependency (claude · maude · plugins · agent-browser) with a
// status glyph, a one-line detail, and a copy-paste remediation when something's
// missing. Detect-and-guide only — it never installs or mutates anything.
//
// Shared by the onboarding wizard (a non-blocking strip) and the ChatPanel
// not-connected explainer (where a user actually hits the wall). Both also use it
// as the persistent re-check surface — `refresh()` re-probes without a reinstall.

import { useCallback, useEffect, useState } from 'react';

/** Fetch + cache the readiness report. `refresh()` re-probes (the re-check button). */
export function useReadiness(enabled = true) {
  const [report, setReport] = useState(null); // { ready, items } | null
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(() => {
    setLoading(true);
    return fetch('/_api/preflight')
      .then((r) => r.json())
      .then((d) => {
        setReport(d && Array.isArray(d.items) ? d : null);
        setLoading(false);
        return d;
      })
      .catch(() => {
        setReport(null);
        setLoading(false);
        return null;
      });
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    fetch('/_api/preflight')
      .then((r) => r.json())
      .then((d) => alive && (setReport(d && Array.isArray(d.items) ? d : null), setLoading(false)))
      .catch(() => alive && (setReport(null), setLoading(false)));
    return () => {
      alive = false;
    };
  }, [enabled]);

  return { report, loading, refresh };
}

function StatusIcon({ status }) {
  if (status === 'present')
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="3 8.4 6.4 11.8 13 4.4" />
      </svg>
    );
  if (status === 'unknown')
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 6a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6 1V10" />
        <circle cx="8" cy="12.4" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    );
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" />
      <line x1="8" y1="5" x2="8" y2="8.6" />
    </svg>
  );
}

/** Render `code`-fenced spans inside a string as <code>, the rest as text. */
function Inline({ text }) {
  const parts = [];
  const re = /`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<code key={parts.length}>{m[1]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Row({ item }) {
  const [copied, setCopied] = useState(false);
  const copyFix = () => {
    const cmds = item.remediation?.replace(/`/g, '') ?? '';
    navigator.clipboard?.writeText(cmds).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  };
  return (
    <li className={`rdy-row rdy-row--${item.status}${item.required ? '' : ' rdy-row--opt'}`}>
      <span className="rdy-ic" aria-hidden="true">
        <StatusIcon status={item.status} />
      </span>
      <span className="rdy-tx">
        <span className="rdy-label">{item.label}</span>
        <span className="rdy-detail">
          <Inline text={item.detail} />
        </span>
        {item.remediation ? (
          <span className="rdy-fix">
            <span className="rdy-fix-tx">
              <Inline text={item.remediation} />
            </span>
            <button type="button" className="rdy-copy" onClick={copyFix} aria-label={`Copy the fix for ${item.label}`}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </span>
        ) : null}
      </span>
    </li>
  );
}

export default function ReadinessList({ report, loading, refresh }) {
  return (
    <div className="rdy">
      <ul className="rdy-list">
        {report?.items?.map((it) => (
          <Row key={it.id} item={it} />
        ))}
      </ul>
      {refresh ? (
        <div className="rdy-foot">
          <button type="button" className="btn btn--ghost btn--sm rdy-recheck" onClick={refresh} disabled={loading}>
            {loading ? 'Checking…' : 'Re-check'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Standalone readiness modal reachable any time from Help ▸ Check AI editing
// readiness… (DDR-128, T6 — the persistent re-check surface, not gated on
// first-run or a disconnected chat). Reuses the shared help-modal chrome (backdrop
// + header + body) so it matches the What's New / Help dialogs, and the same
// ReadinessList. Self-contained: probes only while open (the hook's `enabled` gate),
// re-probes via the list's Re-check button.
export function ReadinessDialog({ open, onClose }) {
  const { report, loading, refresh } = useReadiness(open);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="help-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="help-modal rdy-modal" role="dialog" aria-modal="true" aria-labelledby="rdy-modal-title">
        <header className="help-modal-hd">
          <span className="title" id="rdy-modal-title">
            Check AI editing readiness
          </span>
          <button type="button" className="help-modal-close" aria-label="Close (Esc)" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="help-modal-body">
          <p className="rdy-modal-note">
            The canvas browser, version history, and sharing work with no setup. AI editing
            additionally drives a Claude Code you have installed — here's what it needs:
          </p>
          {report ? (
            <ReadinessList report={report} loading={loading} refresh={refresh} />
          ) : (
            <p className="rdy-modal-note">
              {loading ? 'Checking…' : "Couldn't reach the readiness probe."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
