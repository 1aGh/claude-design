// Per-tenant R2 credentials — Cloud Phase 25 A-1.
//
// THE BUCKET-WIDE KEY NEVER ENTERS A CONTAINER AGAIN. Until this module, every
// cell was handed the same R2 access key (fleet-wide Worker secrets, passed
// through `cellEnv`), and tenant isolation was an application-level prefix —
// one path-handling bug in any cell away from another tenant's data, and, once
// a cell BUILDS tenant-authored source (Phase 25 A0/A1), one build-time file
// read away from a credential for every tenant's data at once.
//
// The control plane now mints R2 TEMPORARY ACCESS CREDENTIALS per tenant:
// scoped to ONE bucket and ONE `tenants/<id>/` prefix, TTL-bounded, signed by
// Cloudflare against a parent key that only the control plane holds. A leaked
// cell credential is then: one tenant's own objects, for a bounded time —
// exactly the blast radius a cell already has by existing.
//
// Pure-ish: takes env + fetchImpl, returns data. The Worker route (worker.mjs)
// and the DO (cell-do.mjs via /internal/cell-r2-credentials) are the callers.

/**
 * Default credential lifetime. Long enough that an active cell (which sleeps
 * after 20 minutes idle and re-mints on every wake) never sees an expiry
 * mid-session in practice; short enough that a leaked credential dies the
 * same day. The hub also refreshes itself before expiry (s3-creds.mjs), so
 * this is a ceiling, not a cliff.
 */
export const DEFAULT_TTL_SECONDS = 12 * 60 * 60;

/** Refresh margin the consumers use: treat creds as stale this long before expiry. */
export const REFRESH_MARGIN_MS = 10 * 60 * 1000;

/** The R2 prefix a tenant's credentials are scoped to. Mirrors entrypoint.sh. */
export function tenantPrefix(tenantId) {
  return `tenants/${tenantId}/`;
}

/**
 * Is minting configured at all? Absent config is a real state (fresh deploy,
 * self-hosted control plane without R2) and the route answers 503 for it —
 * never a silent fall-back to a shared key, which is the bug A-1 removes.
 */
export function mintingConfigured(env) {
  return Boolean(
    (env.R2_CREDS_TOKEN || env.CF_PROVISION_TOKEN) &&
      env.CF_ACCOUNT_ID &&
      env.R2_PARENT_ACCESS_KEY_ID &&
      (env.MAUDE_R2_BUCKET || env.R2_BUCKET)
  );
}

/**
 * Mint one tenant's temporary R2 credentials.
 *
 * @returns {Promise<{ok: true, credentials: object} | {ok: false, error: string, status?: number}>}
 */
export async function mintTenantCredentials({
  env,
  tenantId,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  fetchImpl = fetch,
  now = Date.now(),
}) {
  if (!mintingConfigured(env)) {
    return { ok: false, error: 'R2 credential minting is not configured', status: 503 };
  }
  const token = env.R2_CREDS_TOKEN || env.CF_PROVISION_TOKEN;
  const bucket = env.MAUDE_R2_BUCKET || env.R2_BUCKET;
  let res;
  try {
    res = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/r2/temp-access-credentials`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          bucket,
          parentAccessKeyId: env.R2_PARENT_ACCESS_KEY_ID,
          permission: 'object-read-write',
          prefixes: [tenantPrefix(tenantId)],
          ttlSeconds,
        }),
        signal: AbortSignal.timeout(15_000),
      }
    );
  } catch (err) {
    return { ok: false, error: `temp-credentials request failed: ${err.message}`, status: 502 };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* handled below */
  }
  const result = body?.result;
  if (!res.ok || !body?.success || !result?.accessKeyId || !result?.secretAccessKey) {
    const detail = body?.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    return { ok: false, error: `temp-credentials mint refused: ${detail}`, status: 502 };
  }
  return {
    ok: true,
    credentials: {
      // Everything a cell needs to talk to R2 — endpoint and bucket included,
      // so the cells Worker no longer carries ANY storage configuration of
      // its own beyond the account id already needed to mint.
      endpoint: env.MAUDE_R2_ENDPOINT || `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      bucket,
      accessKeyId: result.accessKeyId,
      secretAccessKey: result.secretAccessKey,
      sessionToken: result.sessionToken ?? null,
      // Consumers refresh against THIS, never by parsing the token.
      expiresAt: now + ttlSeconds * 1000,
      prefix: tenantPrefix(tenantId),
    },
  };
}
