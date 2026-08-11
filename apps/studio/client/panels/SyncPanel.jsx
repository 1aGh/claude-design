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

import { useMemo } from 'react';

import { safeName, syncPresentation } from '../../sync/presentation.ts';

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

export default function SyncPanel({
  status, // the live `sync:status` payload (never null while mounted)
  project, // display name for the header sentence (hub-supplied → safeName'd)
  groupPaths = [], // declared canvas-group paths, for row grouping
  resizing,
  onClose,
}) {
  const p = syncPresentation(status, { project });
  const items = Array.isArray(status?.items) ? status.items : [];
  const truncated = status?.itemsTruncated || 0;
  const assets = status?.assets;
  const assetFailures = assets?.failures || [];

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

  const docs = status?.docs;
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
          <button type="button" className="gp-x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
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
      </div>
    </aside>
  );
}
