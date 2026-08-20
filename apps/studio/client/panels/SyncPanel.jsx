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

/** Consent-class notices (feature-before-first-external-users Task 1), or []
 *  when the shape can't be trusted. Absent is the norm — the payload carries
 *  `notices` only when a boot raised one (shared-doc ON, TSX bodies). */
function readNotices(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n) => n && typeof n.id === 'string' && typeof n.text === 'string');
}

/** DeliveryState → plain words for the doručenka rows (file-ledger.ts owns the
 *  union; unknown states render verbatim so a NEWER producer stays readable). */
const DELIVERY_WORD = {
  conflict: 'conflict — older copy in _trash/',
  stuck: 'stuck',
  'referenced-but-unoffered': 'referenced, never received',
  'local-only': 'only on this machine',
  pushing: 'uploading…',
  'on-hub': 'on the workspace',
  durable: 'backed up',
  'at-peer': 'reached a teammate',
  'ui-healed': 'healed',
  everywhere: 'everywhere',
};

/** States where a person has to look — always-visible rows; the rest folds. */
const DELIVERY_ATTENTION = new Set(['conflict', 'stuck', 'referenced-but-unoffered', 'local-only']);

/** The per-file doručenka map split into attention/fine [rel, state] lists,
 *  fail-closed like every other reader here. */
function readDelivery(raw) {
  const attention = [];
  const fine = [];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [rel, state] of Object.entries(raw)) {
      if (typeof rel !== 'string' || typeof state !== 'string') continue;
      (DELIVERY_ATTENTION.has(state) ? attention : fine).push([rel, state]);
    }
    attention.sort((a, b) => a[0].localeCompare(b[0]));
    fine.sort((a, b) => a[0].localeCompare(b[0]));
  }
  return { attention, fine };
}

/** safeDetail's sanitation with a paragraph-sized cap — a consent notice is a
 *  full explanation by design and `MAX_DETAIL_LEN`'s 160 chars would cut it
 *  mid-sentence. Still bounded: the payload is read back off `_sync.json`. */
function safeNoticeText(raw) {
  const s = String(raw ?? '')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > 600 ? `${s.slice(0, 600)}…` : s;
}

/**
 * Machine-local dismiss ack, keyed per (hub url) → list of dismissed notice
 * ids — the `mdcc-whatsnew-seen` convention. Per-hub on purpose: dismissing
 * "shared-doc is ON for hub A" must not silence the same notice when the
 * project is re-linked to hub B; what leaves this machine changed again.
 */
const NOTICE_ACK_KEY = 'maude-sync-notice-ack';
function readNoticeAcks(url) {
  try {
    const all = JSON.parse(localStorage.getItem(NOTICE_ACK_KEY) || '{}');
    const ids = all[url];
    return Array.isArray(ids) ? ids.filter((i) => typeof i === 'string') : [];
  } catch {
    return [];
  }
}
function writeNoticeAck(url, id) {
  try {
    const all = JSON.parse(localStorage.getItem(NOTICE_ACK_KEY) || '{}');
    const ids = Array.isArray(all[url]) ? all[url] : [];
    if (!ids.includes(id)) ids.push(id);
    all[url] = ids;
    localStorage.setItem(NOTICE_ACK_KEY, JSON.stringify(all));
  } catch {
    /* private mode etc. — the notice simply reappears next boot */
  }
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

  const delivery = useMemo(() => readDelivery(status?.files?.delivery), [status?.files?.delivery]);

  // Sync settings (Task 2) — fetched once on mount; `settings` stays null when
  // no hub is linked, which is also the render gate for the whole section.
  const [settings, setSettings] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsNote, setSettingsNote] = useState('');
  useEffect(() => {
    let gone = false;
    fetch('/_api/sync/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!gone && j && typeof j === 'object') setSettings(j.settings ?? null);
      })
      .catch(() => {
        /* no server / old server — the section simply doesn't render */
      });
    return () => {
      gone = true;
    };
  }, []);
  const changeSetting = useCallback(async (patch) => {
    setSettingsBusy(true);
    setSettingsNote('');
    let json = null;
    try {
      const res = await fetch('/_api/sync/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      json = await res.json().catch(() => null);
    } catch {
      /* said below */
    }
    setSettingsBusy(false);
    if (!json || json.ok !== true) {
      setSettingsNote(safeDetail(json?.detail, 'The setting could not be saved.'));
      return;
    }
    setSettings(json.settings);
    // Saved is a fact; whether it took effect NOW depends on the supervisor —
    // say which of the two happened rather than letting "saved" imply "live".
    setSettingsNote(json.applied ? 'Saved — sync is restarting with the new setting.' : 'Saved — applies the next time sync restarts.');
  }, []);

  // Consent notices minus this machine's dismissals. `ackTick` only forces the
  // re-read after a dismiss — the acks themselves live in localStorage.
  const hubUrl = typeof status?.url === 'string' ? status.url : '';
  const [ackTick, setAckTick] = useState(0);
  const notices = useMemo(() => {
    const acked = readNoticeAcks(hubUrl);
    return readNotices(status?.notices).filter((n) => !acked.includes(n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ackTick invalidates the localStorage read
  }, [status?.notices, hubUrl, ackTick]);
  const dismissNotice = useCallback(
    (id) => {
      writeNoticeAck(hubUrl, id);
      setAckTick((t) => t + 1);
    },
    [hubUrl]
  );

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
        {/* Consent-class notices come FIRST: they say what leaves this machine
            (shared-doc buffer, TSX bodies) and used to live only in a
            console.warn a desktop user never sees. Dismiss is per (notice,
            hub) on this machine — a new hub resurfaces them by design. */}
        {notices.length > 0 && (
          <section aria-label="Notices" data-testid="sync-notices">
            {notices.map((n) => (
              <div key={n.id} className="sp-notice" data-testid={`sync-notice-${n.id}`}>
                <p className="sp-notice-text">{safeNoticeText(n.text)}</p>
                <button
                  type="button"
                  className="sp-notice-dismiss"
                  data-testid={`sync-notice-dismiss-${n.id}`}
                  onClick={() => dismissNotice(n.id)}
                  title="Got it — don't show this again for this hub on this machine"
                >
                  Got it
                </button>
              </div>
            ))}
          </section>
        )}

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
            {/*
              A HELD BREAKER, said out loud. These used to exist only as a
              console.warn, which on a machine whose user never opens a
              terminal is the same as not existing — while the release leaned
              on them as its reason for shipping deletion without a soak.
            */}
            {Array.isArray(files.held) &&
              files.held.map((h) => (
                <div key={h.kind} className="sp-assets-retry" data-testid={`sync-held-${h.kind}`}>
                  <strong>sync paused — nothing was removed.</strong> {h.detail}
                  {h.paths?.length > 0 && (
                    <details className="sp-held-paths">
                      <summary>
                        {h.count} file{h.count === 1 ? '' : 's'}
                      </summary>
                      <ul>
                        {h.paths.slice(0, 50).map((rel) => (
                          <li key={rel}>{rel}</li>
                        ))}
                        {h.paths.length > 50 && <li>…and {h.paths.length - 50} more</li>}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            {/* THE DORUČENKA, per file (DDR-226 §7). The counts above say how
                many are fine; they cannot point at the one that is not — which
                is the question three days of dogfood kept asking. Rows needing
                a person come first and are always visible; the delivered rest
                stays behind a fold so a healthy project reads as one line. */}
            {delivery.attention.length > 0 && (
              <ul className="sp-list" data-testid="sync-delivery-attention">
                {delivery.attention.slice(0, 50).map(([rel, state]) => (
                  <li className="sp-row is-auth-rejected" key={rel}>
                    <span className="sp-row-dot" aria-hidden="true" />
                    <span className="sp-row-name" title={safeName(rel, '(unnamed)')}>
                      {safeName(rel, '(unnamed)')}
                    </span>
                    <span className="sp-row-state">{DELIVERY_WORD[state] || state}</span>
                  </li>
                ))}
                {delivery.attention.length > 50 && (
                  <li className="sp-truncated">…and {delivery.attention.length - 50} more</li>
                )}
              </ul>
            )}
            {delivery.fine.length > 0 && (
              <details className="sp-held-paths" data-testid="sync-delivery-fine">
                <summary>
                  {delivery.fine.length} file{delivery.fine.length === 1 ? '' : 's'} delivered
                </summary>
                <ul>
                  {delivery.fine.slice(0, 200).map(([rel, state]) => (
                    <li key={rel}>
                      {safeName(rel, '(unnamed)')} — {DELIVERY_WORD[state] || state}
                    </li>
                  ))}
                  {delivery.fine.length > 200 && <li>…and {delivery.fine.length - 200} more</li>}
                </ul>
              </details>
            )}
          </section>
        )}

        {/* Settings (feature-before-first-external-users Task 2) — the three
            toggles every breaker remediation used to hand the user as "edit
            linkedHub.* JSON". Rendered only when a hub is linked (the route
            answers settings: null otherwise — dead controls teach nothing). */}
        {settings && (
          <section aria-label="Sync settings" data-testid="sync-settings">
            <div className="gp-sect-label">settings</div>
            <label className="sp-setting" data-testid="sync-setting-syncFiles">
              <input
                type="checkbox"
                checked={settings.syncFiles}
                disabled={settingsBusy}
                onChange={(e) => changeSetting({ syncFiles: e.target.checked })}
              />
              <span>
                Sync project files
                <small>The whole design folder mirrors both ways, not just canvases.</small>
              </span>
            </label>
            <label className="sp-setting" data-testid="sync-setting-propagateDeletes">
              <input
                type="checkbox"
                checked={settings.propagateDeletes}
                disabled={settingsBusy}
                onChange={(e) => changeSetting({ propagateDeletes: e.target.checked })}
              />
              <span>
                Propagate deletions
                <small>
                  Removing a file here removes it everywhere; replaced copies are kept in _trash/.
                </small>
              </span>
            </label>
            <label className="sp-setting sp-setting-select" data-testid="sync-setting-firstAnchor">
              <span>
                First-link conflicts
                <small>When both sides have content the first time a project links.</small>
              </span>
              <select
                value={settings.resolveFirstAnchor}
                disabled={settingsBusy}
                onChange={(e) => changeSetting({ resolveFirstAnchor: e.target.value })}
              >
                <option value="ask">Keep asking</option>
                <option value="keep-local">Keep this machine's</option>
                <option value="keep-cloud">Keep the workspace's</option>
              </select>
            </label>
            {settingsNote && (
              <div className="sp-resync-note" role="status" aria-live="polite">
                {settingsNote}
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
