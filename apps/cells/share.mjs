// The read-only browser surface — Cloud Phase 18. DECISION half, pure.
//
// WHAT THIS IS FOR. Someone gets a link on a phone. Today that dead-ends at
// "install a desktop app", which for the persona this whole arc is staked on
// (DDR-193 §5) converts to zero. They need to SEE the work and to SAY
// something about it. Neither requires anyone to run the tenant's code.
//
// CONTAINMENT (DDR-193 §2, narrowed by DDR-197). The vendor serves PNG and
// JPEG bytes out of a bucket and comment text out of a document. It does not
// render, bundle, transpile or evaluate anything the tenant authored — there
// is no code path here that could, because the only inputs are images and
// strings.
//
// SVG IS EXCLUDED, and that is the sharpest line in this file. An SVG is a
// document: it can carry <script> and <foreignObject>, so serving one on the
// share origin would hand tenant-authored markup a same-origin execution
// context. Every other image format is inert. This is why the allowlist is a
// list of formats rather than "images".
//
// THE VIEW NEVER IMPLIES LIVENESS. A snapshot is published from a member's own
// machine, so it is always as-of some moment. A gallery that renders like a
// live app but is four days stale is a lie told by omission — every view is
// stamped, and a canvas with no snapshot says so rather than rendering empty.

/** Formats the share origin will serve. Inert bytes only — see the header. */
export const SHAREABLE_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'avif'];

const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};

/**
 * Content type for a snapshot key, or null when the format is not shareable.
 *
 * Never sniffed and never taken from the request. A format this does not know
 * is a format that does not get served, which is what keeps the allowlist
 * meaningful.
 */
export function snapshotContentType(key) {
  const ext = String(key ?? '').split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? null;
}

/** `view-<tenant>.cloud.maude.sh` — the share origin for one project. */
export const VIEW_PREFIX = 'view-';

/**
 * The tenant whose SHARE VIEW a hostname addresses, or null.
 *
 * A SEPARATE ORIGIN from the workspace, deliberately. The workspace holds
 * sessions and an operator credential; the share view is reachable by anyone
 * holding a link. Same origin would mean a flaw in the surface anyone can
 * reach borrows the trust of the surface only members can.
 */
export function viewTenantFromHostname(hostname, zone) {
  const h = String(hostname ?? '').toLowerCase();
  const suffix = `.${String(zone ?? '').toLowerCase()}`;
  if (!zone || !h.endsWith(suffix)) return null;
  const label = h.slice(0, -suffix.length);
  if (!label.startsWith(VIEW_PREFIX)) return null;
  const tenant = label.slice(VIEW_PREFIX.length);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenant) && tenant.length <= 63 ? tenant : null;
}

/** Where a project's snapshots live. Same tenant scoping as everything else. */
export function snapshotPrefix(tenant) {
  return `tenants/${tenant}/snapshots/`;
}

/** A snapshot key must not be able to address anything but a snapshot. */
const SNAPSHOT_NAME = /^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._-]{0,63}(?:\/[A-Za-z0-9][A-Za-z0-9._-]{0,63}){0,3}$/;

export function snapshotObjectKey(tenant, name) {
  const n = String(name ?? '');
  if (!SNAPSHOT_NAME.test(n) || !snapshotContentType(n)) return null;
  return `${snapshotPrefix(tenant)}${n}`;
}

/**
 * The manifest a share view renders from.
 *
 * PURE: takes the listing, returns the gallery. The staleness language lives
 * here because it is the part that can quietly start lying.
 *
 * @param {{key: string, size: number, lastModified?: string}[]} objects
 * @param {string} tenant
 * @param {number} now
 */
export function buildGallery(objects, tenant, now = 0) {
  const prefix = snapshotPrefix(tenant);
  const items = [];
  for (const o of objects) {
    if (!o.key.startsWith(prefix)) continue;
    const name = o.key.slice(prefix.length);
    if (!snapshotContentType(name)) continue;
    const published = o.lastModified ? Date.parse(o.lastModified) : Number.NaN;
    items.push({
      name,
      title: prettyTitle(name),
      bytes: o.size,
      publishedAt: Number.isFinite(published) ? published : null,
      // Computed once, here, so every surface says the same thing about the
      // same snapshot. A per-template "x ago" is how two parts of one page end
      // up disagreeing about how old something is.
      age: Number.isFinite(published) ? describeAge(now - published) : 'at an unknown time',
    });
  }
  items.sort((a, b) => a.title.localeCompare(b.title));
  const newest = items.reduce((m, i) => Math.max(m, i.publishedAt ?? 0), 0);
  return {
    tenant,
    count: items.length,
    items,
    newestAt: newest || null,
    // The whole-gallery honesty line. Rendered even when everything is fresh —
    // a stamp that appears only when stale trains people to ignore its absence.
    asOf: newest ? describeAge(now - newest) : null,
  };
}

/** `ui-alligators-moodboard-v3.png` → `ui / alligators moodboard v3`. */
export function prettyTitle(name) {
  return String(name)
    .replace(/\.[A-Za-z0-9]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\//g, ' / ')
    .trim();
}

/**
 * Plain language, never a bare timestamp.
 *
 * "2026-07-29T17:04:11Z" makes a reader do arithmetic to answer the only
 * question they have, which is whether they are looking at something current.
 */
export function describeAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

/**
 * Security headers for the share origin.
 *
 * `script-src 'none'` is not caution, it is the invariant: this surface exists
 * BECAUSE it does not execute tenant-authored anything, and a CSP that admits
 * script would quietly make that untrue. The inline stylesheet is allowed by
 * hash-free `'unsafe-inline'` for style only — style cannot execute, and the
 * alternative (an external stylesheet) adds a request for no safety.
 */
export const SHARE_CSP = [
  "default-src 'none'",
  "img-src 'self' data:",
  "style-src 'unsafe-inline'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

export const SHARE_HEADERS = {
  'Content-Security-Policy': SHARE_CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};
