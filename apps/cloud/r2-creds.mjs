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

/**
 * Where an absent/unparsable upstream `Retry-After` lands, and the ceiling we
 * will ever ask a caller to wait.
 *
 * Cloudflare's API answers 429 without always saying for how long. A default
 * that is too short reproduces the storm this whole path exists to stop; one
 * that is too long turns a five-second blip into a minutes-long outage for a
 * cell that could have started. A minute is the same figure the hub's own
 * rate limiter uses (`file-door.mjs` sends `Retry-After: 60`), and five is a
 * hard cap so a hostile or confused upstream cannot park the fleet.
 */
export const DEFAULT_RETRY_AFTER_MS = 60_000;
export const MAX_RETRY_AFTER_MS = 5 * 60_000;

/** `Retry-After: <seconds>` → ms, clamped. Delta-seconds only — the HTTP-date
 *  form would need clock-skew guessing, which makes the pause less predictable
 *  rather than more (same call `apps/studio/sync/retry-after.ts` makes). */
export function retryAfterMsFrom(header) {
  const secs = Number(String(header ?? '').trim());
  if (!Number.isFinite(secs) || secs <= 0) return DEFAULT_RETRY_AFTER_MS;
  return Math.min(secs * 1000, MAX_RETRY_AFTER_MS);
}

/**
 * Is this refusal one the caller should come BACK from, or one it should
 * report?
 *
 * The distinction is the whole point of this pass. A 429 is an instruction
 * ("not now"), a 5xx is usually transient, and a 4xx that is not 429 means the
 * request itself is wrong — retrying that one is how a client turns its own
 * bug into an outage. Flattening all three into 502, which this module used to
 * do, left the cell unable to tell "wait" from "broken": it fail-closed,
 * restarted, and re-minted immediately, at 30 container starts per 10 seconds.
 */
export function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

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
 * @returns {Promise<{ok: true, credentials: object} | {ok: false, error: string, status?: number, retryable?: boolean, retryAfterMs?: number}>}
 */
export async function mintTenantCredentials({
  env,
  tenantId,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  fetchImpl = fetch,
  now = Date.now(),
}) {
  if (!mintingConfigured(env)) {
    // NOT retryable, and the 503 stays distinct from the 502s below. That
    // distinction is a working diagnostic: seeing 502 rather than 503 is how
    // the 2026-09-03 investigation proved minting WAS configured and the fault
    // was upstream. Collapsing them would cost that for nothing.
    return {
      ok: false,
      error: 'R2 credential minting is not configured',
      status: 503,
      retryable: false,
    };
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
    // A transport failure never reached Cloudflare, so there is no upstream
    // status to honour — but it IS the transient class, and the caller should
    // come back rather than treat it as a broken deployment.
    return {
      ok: false,
      error: `temp-credentials request failed: ${err.message}`,
      status: 502,
      retryable: true,
      retryAfterMs: DEFAULT_RETRY_AFTER_MS,
    };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* handled below */
  }
  const result = body?.result;
  if (!res.ok || !body?.success || !result?.accessKeyId || !result?.secretAccessKey) {
    // BOUNDED AT THE PRODUCER. The consumer (`cell-config.mjs`) also caps this,
    // but a length guarantee that lives only downstream is the consumer's
    // property, not this function's — and this string is built from an upstream
    // response body.
    const detail = (body?.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`).slice(
      0,
      200
    );
    // PROPAGATE THE UPSTREAM STATUS FOR THE RETRYABLE CLASSES.
    //
    // This line used to be an unconditional 502, and that is how an account
    // rate limit became a restart loop: the cell saw a 502, could not tell it
    // from a broken deployment, refused to start, and the next request minted
    // again. A 429 carries an instruction and must survive the hop.
    //
    // ONLY the retryable classes are forwarded. A 403 upstream means the
    // CONTROL PLANE's parent token is wrong — forwarding it would tell the
    // cell "you are forbidden", which is a different and misleading fault
    // (the route already spends 401/403 on the cell's own credential). Those
    // stay 502: a fault to report, not an instruction to act on.
    //
    // A 200-with-`success:false` (Cloudflare's shape for an application error)
    // has no status worth forwarding either, and retrying a request the API
    // accepted and rejected on its merits is the storm this is preventing.
    const retryable = !res.ok && isRetryableStatus(res.status);
    const upstream = retryable ? res.status : 502;
    return {
      ok: false,
      error: `temp-credentials mint refused: ${detail}`,
      status: upstream,
      retryable,
      ...(retryable ? { retryAfterMs: retryAfterMsFrom(res.headers?.get?.('retry-after')) } : {}),
    };
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
