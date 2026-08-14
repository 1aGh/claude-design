// feature-sync-progress-modal — the per-file Sync panel (right dock).
//
// Pure surfacing of the `sync:status` payload: the DDR-102 per-document
// `items` list plus the DDR-217 asset lane's live progress. No new sync
// semantics and NO new sync words — the header sentence comes from
// `syncPresentation` (the one rule the status-bar chip and the cloud rail
// already share), and rows map DocSyncState onto that same vocabulary:
// pending → syncing, connected → synced, auth-rejected → refused.
//
// DDR-054 — slugs are local canvas identifiers and asset keys are local
// paths, but everything renders through safeName anyway: this payload is
// read back off disk (`_sync.json`), and a bounded text-only row is free.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { safeDetail, safeName, syncPresentation } from '../../sync/presentation.ts';

/**
 * How long Resync stays disabled after a cycle finishes.
 *
 * A resync is `syncControl.restart()`: it tears every provider down and
 * re-authenticates EVERY document — 76 WS auths on the project this was built
 * for, since auth fires once per document. The valid-token bucket is 600/min
 * per label (DDR-102), so roughly eight presses inside a minute would pin the
 * very bucket the incident behind this feature was about. Ten seconds caps an
 * impatient person at six presses a minute and keeps them well under it. The
 * hub's own 429 remains the real backstop — this is politeness, not security.
 */
const RESYNC_COOLDOWN_MS = 10_000;

/** DocSyncState → the presentation vocabulary (never invent a new word). */
const STATE_WORD = {
  pending: 'syncing',
  connected: 'synced',
  'auth-rejected': 'refused',
};

/** AuthFailureClass → plain words for the refused-row detail. */
const REASON_WORD = {
  'rate-limit': 'rate limited',
  'not-authorized': 'not authorized',
  'invalid-token': 'sign-in expired',
  generic: 'refused by the hub',
};

function Row({ item }) {
  const name = safeName(item.slug, '(unnamed)');
  const state = STATE_WORD[item.state] || 'syncing';
  const reason = item.state === 'auth-rejected' ? REASON_WORD[item.reason] || REASON_WORD.generic : null;
  return (
    <li className={'sp-row is-' + item.state} data-testid={'sync-row-' + item.slug}>
      <span className="sp-row-dot" aria-hidden="true" />
      <span className="sp-row-name" title={name}>
        {name}
      </span>
      <span className="sp-row-state">{reason ? `refused — ${reason}` : state}</span>
    </li>
  );
}

/** Which declared canvas group a slug belongs to (slugs collapse '/' → '-'). */
function groupOf(slug, groupPaths) {
  for (const p of groupPaths) {
    const g = p.replace(/\//g, '-');
    if (slug === g || slug.startsWith(g + '-')) return p;
  }
  return null;
}

// FAIL CLOSED, like presentation.ts `readCounts`: this payload is JSON.parse
// of `_sync.json` with no schema, so a partial write / older producer must
// degrade to "nothing to show", never crash the render or print NaN.

const isCount = (n) => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** The per-doc rows, or [] when the shape can't be trusted. */
function readItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((i) => i && typeof i.slug === 'string' && typeof i.state === 'string');
}

/** The asset lane, or null when any count is unreadable. */
function readAssets(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (![raw.total, raw.done, raw.pushed, raw.skipped, raw.failedCount].every(isCount)) return null;
  const failures = Array.isArray(raw.failures)
    ? raw.failures.filter((f) => f && typeof f.key === 'string')
    : [];
  return { ...raw, failures };
}

/** The file plane (feature-sync-file-plane), or null when unreadable/absent —
 *  absent is the norm: the payload carries `files` only once a flag-on pull
 *  has run this boot. */
function readFiles(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (![raw.synced, raw.pulled, raw.conflicts].every(isCount)) return null;
  return raw;
}

export default function SyncPanel({
  status, // the live `sync:status` payload (never null while mounted)
  project, // display name for the header sentence (hub-supplied → safeName'd)
  groupPaths = [], // declared canvas-group paths, for row grouping
  // Present exactly when the hub runs this studio (`/_config`'s `cloud` block);
  // null on the desktop. Decides whether Resync is offered at all — see below.
  cloud = null,
  resizing,
  onClose,
}) {
  const p = syncPresentation(status, { project });
  const [resyncing, setResyncing] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [note, setNote] = useState('');
  const timers = useRef([]);

  // Timers outlive an unmount otherwise — closing the panel mid-cooldown would
  // set state on a gone component.
  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    },
    []
  );

  const resync = useCallback(async () => {
    if (resyncing || cooling) return;
    setResyncing(true);
    setNote('');
    let res = null;
    let json = {};
    try {
      res = await fetch('/_api/sync/resync', { method: 'POST' });
      json = await res.json().catch(() => ({}));
    } catch {
      /* the server went away — say so below rather than throwing into render */
    }
    setResyncing(false);
    if (!res) setNote('Maude could not reach the sync service.');
    else if (res.status === 409) setNote('Already restarting — give it a moment.');
    else if (!res.ok || !json.ok) setNote(json.detail || 'Resync could not start.');
    // A restart that declined is not an error, but it IS the only thing worth
    // saying — the panel's own header keeps reporting the live state.
    else if (json.sync && !json.sync.syncing) setNote(json.sync.detail || '');
    setCooling(true);
    timers.current.push(setTimeout(() => setCooling(false), RESYNC_COOLDOWN_MS));
  }, [resyncing, cooling]);

  const cancelAssets = useCallback(async () => {
    try {
      await fetch('/_api/sync/cancel-assets', { method: 'POST' });
    } catch {
      /* the sweep ends with the server either way */
    }
  }, []);

  const items = readItems(status?.items);
  const truncated = isCount(status?.itemsTruncated) ? status.itemsTruncated : 0;
  const assets = readAssets(status?.assets);
  const assetFailures = assets?.failures || [];
  const files = readFiles(status?.files);

  const { attention, byGroup } = useMemo(() => {
    const attention = items.filter((i) => i.state === 'auth-rejected');
    const rest = items.filter((i) => i.state !== 'auth-rejected');
    const byGroup = new Map();
    for (const item of rest) {
      const g = groupOf(item.slug, groupPaths) ?? 'canvases';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(item);
    }
    return { attention, byGroup };
  }, [items, groupPaths]);

  // Same fail-closed rule for the header chip — readCounts-shaped, so the
  // chip can never say "NaN synced" while the note below fails closed.
  const rawDocs = status?.docs;
  const docs =
    rawDocs && [rawDocs.synced, rawDocs.pending, rawDocs.rejected].every(isCount)
      ? rawDocs
      : null;
  const counts =
    docs &&
    [
      `${docs.synced} synced`,
      docs.pending > 0 ? `${docs.pending} syncing` : null,
      docs.rejected > 0 ? `${docs.rejected} refused` : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <aside
      className={'st-rpanel sp-panel' + (resizing ? ' is-resizing' : '')}
      aria-label="Sync"
      data-testid="sync-panel"
    >
      <div className="gp-head">
        <div className="gp-panel-hd">
          <span className="gp-panel-title">Sync</span>
          {counts && <span className="gp-count">{counts}</span>}
          <span className="gp-spacer" />
          {/* Resync re-runs the WHOLE sync — every canvas and every asset — so
              it lives in the header, not inside the assets section. It is
              `syncControl.restart()`, the same cycle Connect performs.

              NOT IN THE CLOUD. On a cell the sync runtime belongs to the process
              serving the project to EVERYONE, so restarting it is an operator
              action, not a member's — the hub refuses the route there on
              purpose (v0.60.2). Rendering the button anyway meant a cloud member
              could press a control that cannot work by design and be handed an
              error for it; the honest surface is its absence. Discovery is
              continuous now, so nobody needs this button to pick up a new
              canvas — it is a repair tool, and repairing a cell is the hub's
              job. See `.ai/logs/rca/issue-cloud-assets-open-findings.md` §5. */}
          {!cloud && (
            <button
              type="button"
              className="sp-resync"
              data-testid="sync-resync"
              onClick={resync}
              disabled={resyncing || cooling}
              title="Re-check every canvas and asset against the workspace"
            >
              {resyncing ? 'Resyncing…' : 'Resync'}
            </button>
          )}
          <button type="button" className="gp-x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {note && (
          <div className="sp-resync-note" role="status" aria-live="polite">
            {safeDetail(note, '')}
          </div>
        )}
        {/* The one-rule sentence, live — same aria pattern as the rail note:
            a polite announcement when the phase changes, never a focus steal. */}
        {p && (
          <div className="sp-note" role="status" aria-live="polite">
            <span className={'sp-note-dot is-' + p.phase} aria-hidden="true" />
            <span>
              {p.title}
              {p.next ? ` ${p.next}` : ''}
            </span>
          </div>
        )}
      </div>

      <div className="sp-body">
        {items.length === 0 && !assets && (
          <div className="gp-empty">
            <p>No per-file detail yet — it arrives with the first sync report after this panel shipped. If this persists, restart Maude.</p>
          </div>
        )}

        {attention.length > 0 && (
          <section aria-label="Needs attention">
            <div className="gp-sect-label sp-sect-attention">Needs attention</div>
            <ul className="sp-list">
              {attention.map((item) => (
                <Row key={item.slug} item={item} />
              ))}
            </ul>
          </section>
        )}

        {[...byGroup.entries()].map(([group, rows]) => (
          <section key={group} aria-label={group}>
            <div className="gp-sect-label">
              {group} <span className="gp-group-count">{rows.length}</span>
            </div>
            <ul className="sp-list">
              {rows.map((item) => (
                <Row key={item.slug} item={item} />
              ))}
            </ul>
          </section>
        ))}

        {truncated > 0 && (
          <div className="sp-truncated">
            +{truncated} more synced canvas{truncated === 1 ? '' : 'es'} not listed.
          </div>
        )}

        {assets && (
          <section aria-label="Assets" data-testid="sync-assets">
            <div className="gp-sect-label">
              assets <span className="gp-group-count">{assets.total}</span>
            </div>
            <div className="sp-assets-line">
              {assets.finished
                ? `${assets.pushed} pushed · ${assets.skipped} already there` +
                  (assets.failedCount > 0 ? ` · ${assets.failedCount} failed` : '')
                : `Pushing assets — ${assets.done} of ${assets.total}…`}
              {/* Cancel is scoped to the SWEEP — interrupting an upload is a
                  real gesture; interrupting a reconnect mid-handshake is not.
                  Safe to press: uploads are idempotent and the hub writes
                  temp-then-rename, so nothing half-written can survive. */}
              {!assets.finished && (
                <button
                  type="button"
                  className="sp-assets-cancel"
                  data-testid="sync-assets-cancel"
                  onClick={cancelAssets}
                >
                  Cancel
                </button>
              )}
            </div>
            {!assets.finished && assets.active && (
              <div className="sp-assets-active" title={safeName(assets.active, '')}>
                ↑ {safeName(assets.active, '')}
              </div>
            )}
            {assets.failedCount > 0 && (
              <ul className="sp-list">
                {assetFailures.map((f) => (
                  <li className="sp-row is-auth-rejected" key={f.key}>
                    <span className="sp-row-dot" aria-hidden="true" />
                    <span className="sp-row-name" title={safeName(f.key, '(unnamed)')}>
                      {safeName(f.key, '(unnamed)')}
                    </span>
                    <span className="sp-row-state">{safeName(f.reason, 'failed')}</span>
                  </li>
                ))}
                {assets.failedCount > assetFailures.length && (
                  <li className="sp-truncated">
                    +{assets.failedCount - assetFailures.length} more failed. All retry on the next
                    launch.
                  </li>
                )}
              </ul>
            )}
            {assets.failedCount > 0 && assets.finished && (
              <div className="sp-assets-retry">Failed assets retry on the next launch.</div>
            )}
          </section>
        )}

        {files && (
          <section aria-label="Project files" data-testid="sync-files">
            <div className="gp-sect-label">
              project files <span className="gp-group-count">{files.synced}</span>
            </div>
            <div className="sp-assets-line">
              {`${files.synced} synced` + (files.pulled > 0 ? ` · ${files.pulled} pulled` : '')}
            </div>
            {files.conflicts > 0 && (
              <div className="sp-assets-retry" data-testid="sync-files-conflicts">
                {files.conflicts} conflict{files.conflicts === 1 ? '' : 's'} — the older copies are
                kept in _trash/.
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
