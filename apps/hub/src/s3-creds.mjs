// Refreshing S3 credentials — Cloud Phase 25 A-1, the hub half.
//
// In a platform cell the storage credentials are TEMPORARY: minted per tenant
// by the control plane (scoped to `tenants/<id>/`, TTL-bounded) and injected
// at container start. A cell that lives past the TTL would watch its backups
// and asset reads start failing, so the hub refreshes its own credentials
// before expiry — with the derived secret it already holds (HUB_SECRET
// authorizes `/internal/cell-r2-credentials`; it is the same derivation).
//
// A SELF-HOSTED hub is exactly the old behavior: static keys from env, no
// refresh URL, nothing to do. This module exists so every S3 consumer asks
// "what are the credentials NOW" instead of remembering boot-time values.

import { s3ConfigFromEnv } from './s3.mjs';

/** Treat credentials as stale this long before their stated expiry. */
export const REFRESH_MARGIN_MS = 10 * 60 * 1000;

/**
 * Build a config source over `env`.
 *
 * Returned shape: `{ configured, config(): Promise<S3Config|null> }`.
 * `configured` is static — it answers "does this hub have object storage at
 * all", which gates schedulers at boot. `config()` answers per operation.
 */
export function createS3ConfigSource(env = process.env, { fetchImpl = fetch, log = console } = {}) {
  const initial = s3ConfigFromEnv(env);
  const refreshUrl = env.MAUDE_S3_CREDS_URL || null;

  if (!refreshUrl) {
    // Static credentials (self-hosted, or the legacy migration window).
    return { configured: Boolean(initial), config: async () => initial };
  }

  let current = initial;
  let expiresAt = Number(env.MAUDE_S3_CREDS_EXPIRES_AT ?? 0) || 0;
  let inFlight = null;

  async function refresh() {
    const res = await fetchImpl(refreshUrl, {
      headers: { authorization: `Bearer ${env.HUB_SECRET ?? ''}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body?.accessKeyId || !body?.secretAccessKey) throw new Error('malformed credentials');
    current = {
      endpoint: String(body.endpoint ?? current?.endpoint ?? '').replace(/\/+$/, ''),
      bucket: body.bucket ?? current?.bucket,
      accessKeyId: body.accessKeyId,
      secretAccessKey: body.secretAccessKey,
      region: 'auto',
      ...(body.sessionToken ? { sessionToken: body.sessionToken } : {}),
    };
    expiresAt = Number(body.expiresAt ?? 0) || 0;
    log.log?.(
      `[hub] refreshed object-storage credentials${expiresAt ? ` (valid until ${new Date(expiresAt).toISOString()})` : ''}`
    );
  }

  return {
    configured: Boolean(initial),
    async config() {
      if (expiresAt && Date.now() > expiresAt - REFRESH_MARGIN_MS) {
        // One refresh at a time; concurrent callers share it. A failed
        // refresh KEEPS the current credentials — they may still have life
        // in them, and serving with possibly-stale credentials plus a loud
        // log beats failing every operation the moment the control plane
        // has a bad minute.
        inFlight ??= refresh().finally(() => {
          inFlight = null;
        });
        try {
          await inFlight;
        } catch (err) {
          log.error?.(`[hub] credential refresh FAILED (keeping current): ${err.message}`);
        }
      }
      return current;
    },
  };
}

let _defaultSource = null;

/** Process-wide source over `process.env` — what the server and cell-ops share. */
export function defaultS3Source() {
  _defaultSource ??= createS3ConfigSource(process.env);
  return _defaultSource;
}

/** Test seam. */
export function _resetDefaultS3Source() {
  _defaultSource = null;
}

const _sources = new WeakMap();

/**
 * A memoized source for an arbitrary env object — the refresh cache must
 * survive across calls or every operation would re-mint. `process.env` maps
 * to the shared default source.
 */
export function s3SourceFor(env = process.env) {
  if (env === process.env) return defaultS3Source();
  let source = _sources.get(env);
  if (!source) {
    source = createS3ConfigSource(env);
    _sources.set(env, source);
  }
  return source;
}
