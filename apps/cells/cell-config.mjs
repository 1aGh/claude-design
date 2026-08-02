// What a cell IS, decided without a container — Cloud Phase 15, split out in
// Phase 24 (B1).
//
// SPLIT FROM cell-do.mjs SO IT CAN BE TESTED. `cell-do.mjs` imports
// `@cloudflare/containers`, which does not resolve under plain Node, so the
// most dangerous mapping on the platform — the one where a mistake means one
// tenant reading another's data — had no tests at all. It does now
// (cell-do.test.mjs), and the split is what makes that possible without a
// workerd harness. Same rule as the control plane's decision modules
// (DDR-196 §1): the reviewable part takes data and returns data.
//
// WHY PER-TENANT SECRETS ARE DERIVED, NOT SHARED. A cell needs an operator
// credential (HUB_SECRET) and it needs one that is ITS OWN: handing every cell
// the same value would make one leaked cell an operator credential for every
// other project on the platform. Deriving it — HMAC(master, tenant) — gives a
// distinct, unguessable value per tenant from a single stored secret, so
// rotating the master rotates every cell and no per-tenant secret store has to
// exist. The master itself never enters a container.

/** The port the cell image listens on. Matches its EXPOSE / PORT. */
export const CELL_PORT = 1234;

/**
 * The header the Worker uses to tell a DO which tenant it is.
 *
 * Safe ONLY because a Durable Object is unreachable from the internet — the
 * sole caller is our own Worker, which derives the value from the hostname it
 * was routed on. If a DO ever becomes directly addressable this stops being
 * trustworthy input, so it is named to make that obvious.
 */
export const TENANT_HEADER = 'x-maude-internal-tenant';

/** The operator route: `POST /_cell/restart`, authorized by the cell's own secret. */
export const RESTART_PATH = '/_cell/restart';

/** Same charset the cell entrypoint enforces — the id becomes an R2 prefix. */
const TENANT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidTenantId(raw) {
  return typeof raw === 'string' && raw.length > 0 && raw.length <= 63 && TENANT_ID.test(raw);
}

/**
 * Derive this tenant's operator credential from the platform master.
 *
 * Hex, 64 chars — the same shape `workspace-up` generates, so a cell cannot
 * tell (and must not care) whether the platform or a self-hoster provisioned it.
 */
export async function deriveSecret(master, tenantId, purpose = 'hub-secret') {
  if (!master) throw new Error('CELL_SECRET_MASTER is not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(master),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`maude-cell:${purpose}:${tenantId}`)
  );
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time compare. A timing oracle on an operator credential is worth
 * closing even when the credential is derived rather than stored.
 */
export function secretsMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The tenant a request is for.
 *
 * From the HOSTNAME, never a header or a path: the hostname is routed by our
 * own DNS; the others are attacker-controlled. `<tenant>.cloud.maude.sh`.
 *
 * HOW THIS HOSTNAME EXISTS AT ALL. Not a wildcard route — Cloudflare accepts a
 * wildcard only at the START of a hostname pattern, and free Universal SSL
 * covers the apex plus ONE level, so `<tenant>.cloud.maude.sh` is neither
 * routable by `cell-*.maude.sh/*` nor on the certificate. Both were tried; the
 * TLS failure has no HTTP status to read, which is why it is written down.
 *
 * A Worker CUSTOM DOMAIN solves both at once: it provisions the DNS record and
 * an edge certificate for any hostname in the zone, at any depth. So a cell's
 * hostname is created per tenant at provision time (`maude cell up`) rather
 * than pre-declared, which is also what `cellResources()` already modelled —
 * `dns` and `worker-route` as per-cell resources, not global config.
 */
export function tenantFromHostname(hostname, zone) {
  const h = String(hostname ?? '').toLowerCase();
  const suffix = `.${String(zone ?? '').toLowerCase()}`;
  if (!zone || !h.endsWith(suffix)) return null;
  const label = h.slice(0, -suffix.length);
  // THE GALLERY IS GONE (Cloud Phase 25 C5) — and deleting its ROUTES is not
  // the same as deleting its ADDRESS. `view-<project>` is a valid tenant-id
  // shape, so a leftover custom domain would resolve here and start a cell
  // literally named "view-alligators": a brand new empty project, at a URL
  // that used to be a real page, with autosave ready to commit over it. This
  // is not hypothetical — the hostname was still live in production after C5
  // shipped, because a Worker route and a Worker custom domain are different
  // objects and only one of them is in the repo.
  if (label.startsWith('view-')) return null;
  return isValidTenantId(label) ? label : null;
}

/** The single hostname label the canvas origin lives on, fleet-wide. */
const CANVAS_LABEL = 'canvas';

/**
 * Is this a canvas-origin request, and if so which project is it for?
 *
 * Returns `null` when the hostname is not the canvas origin (so the caller
 * falls through to normal per-project hostname routing), or
 * `{ tenant, rest }` where `rest` is the path with the tenant segment removed.
 * A canvas-origin URL with no project segment yields `{ tenant: null }` — a
 * refusal, never a fall-through to a cell.
 */
export function canvasOriginTenant(url, zone) {
  if (!zone) return null;
  if (String(url.hostname).toLowerCase() !== `${CANVAS_LABEL}.${String(zone).toLowerCase()}`) {
    return null;
  }
  const [, first, ...rest] = url.pathname.split('/');
  if (!first) return { tenant: null, rest: '/' };
  return { tenant: first, rest: `/${rest.join('/')}` };
}

/** Nothing known about this tenant. The fail-closed default, and never a shared value. */
const NO_CONFIG = Object.freeze({ projectName: null, seedRepo: null, adminEmail: null });

/**
 * Ask the control plane who THIS tenant is (Cloud Phase 24 B1).
 *
 * WHY THIS FUNCTION EXISTS AT ALL. `cellEnv` used to read the project's name,
 * its seed repository and its first admin address out of the cells-Worker's
 * own environment — three values shared by every tenant on the platform. A
 * second customer's FIRST boot could therefore clone the first customer's
 * repository, because "the seed repo" was a global. This was the single most
 * dangerous finding of the 2026-07-31 readiness audit and it blocked customer
 * number two absolutely.
 *
 * The authorization IS the isolation: the secret a cell must present is
 * derived from the tenant id it asks about, so a cell can ask about itself and
 * about nothing else. Same gate as `/internal/mirror-config`.
 *
 * FAIL CLOSED, ALWAYS. An unreachable control plane yields the last answer we
 * cached for THIS tenant, and failing that, nothing. Falling back to a shared
 * value is precisely the bug, so there is no fallback.
 */
export async function fetchTenantConfig({ tenantId, env, storage = null, fetchImpl = fetch }) {
  if (!env.CELL_SECRET_MASTER) return { ...NO_CONFIG };
  const controlPlane = env.CONTROL_PLANE_URL ?? 'https://cloud.maude.sh';
  try {
    const secret = await deriveSecret(env.CELL_SECRET_MASTER, tenantId);
    const res = await fetchImpl(
      `${controlPlane}/internal/cell-config?tenant=${encodeURIComponent(tenantId)}`,
      { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const config = {
      projectName: body?.projectName ?? null,
      seedRepo: body?.seedRepo ?? null,
      adminEmail: body?.adminEmail ?? null,
    };
    // Cached against the NEXT cold start, which may happen during an outage —
    // and a cell that cannot learn its seed repo on first boot comes up empty
    // with nothing in the response saying why.
    // KEYED BY TENANT. `cell-do.mjs` contains a branch that rebinds a DO's
    // tenant id, and while `idFromName()` makes it unreachable today, an
    // unkeyed cache would hand the new tenant the OLD tenant's seedRepo during
    // a control-plane outage — B1's bug, re-entering through the fallback that
    // exists to be safe.
    if (storage) await storage.put(`config:${tenantId}`, config);
    return config;
  } catch (err) {
    console.error(`[cell] ${tenantId} could not read its config: ${err.message}`);
    if (storage) {
      const cached = await storage.get(`config:${tenantId}`);
      if (cached) return cached;
    }
    return { ...NO_CONFIG };
  }
}

/**
 * This tenant's OWN object-storage credentials (Cloud Phase 25 A-1).
 *
 * Minted by the control plane as R2 TEMPORARY credentials scoped to
 * `tenants/<id>/`, TTL-bounded. The bucket-wide key that used to ride in as a
 * fleet-wide Worker secret never enters a container again — in a cell that
 * BUILDS tenant-authored source (Phase 25 A1), a build-time file read must
 * reach at most this tenant's own objects, for a bounded time.
 *
 * FAIL CLOSED — but loudly, in the caller. `null` here means "no storage",
 * and a cell that boots without storage on a cold start comes up EMPTY, which
 * autosave would then commit over real work. So cell-do treats null as a
 * refusal to start (unless the legacy shared-key fallback is still configured
 * during the migration window), never as "run local-only".
 */
export async function fetchTenantS3Credentials({ tenantId, env, fetchImpl = fetch }) {
  if (!env.CELL_SECRET_MASTER) return null;
  const controlPlane = env.CONTROL_PLANE_URL ?? 'https://cloud.maude.sh';
  try {
    const secret = await deriveSecret(env.CELL_SECRET_MASTER, tenantId);
    const res = await fetchImpl(
      `${controlPlane}/internal/cell-r2-credentials?tenant=${encodeURIComponent(tenantId)}`,
      { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body?.accessKeyId || !body?.secretAccessKey) throw new Error('malformed credentials');
    return body;
  } catch (err) {
    console.error(`[cell] ${tenantId} could not mint R2 credentials: ${err.message}`);
    return null;
  }
}

/**
 * Environment for one tenant's cell.
 *
 * PURE and exported, because this mapping is where a mistake means one tenant
 * reading another's data — and that must be reviewable without booting a
 * container (DDR-196 §1). Everything tenant-specific arrives in `config`,
 * resolved by `fetchTenantConfig`; nothing tenant-specific is read from `env`,
 * which is shared by the whole fleet.
 */
export async function cellEnv({ tenantId, env, hostname, config = NO_CONFIG, s3Creds = null }) {
  if (!isValidTenantId(tenantId)) throw new Error(`invalid tenant id: ${tenantId}`);
  return {
    // EVERYTHING THE CELL NEEDS, EXPLICITLY.
    //
    // `startOptions.envVars` REPLACES the image's ENV, it does not merge with
    // it. Relying on the Dockerfile's values cost a debugging cycle: the cell
    // booted, answered /health, and quietly had no MAUDE_REPO_DIR and no
    // workspace mode — so no checkout, no history, no seed, and nothing in the
    // response that said so. Anything the cell needs is listed here, even when
    // the image also sets it.
    NODE_ENV: 'production',
    DATA_DIR: '/data',
    MAUDE_REPO_DIR: '/repo',
    HUB_WORKSPACE_MODE: '1',
    MAUDE_WORKSPACE_MODE: '1',
    MAUDE_TENANT_ID: tenantId,
    PORT: String(CELL_PORT),
    // The cell terminates TLS at the edge, so it sees http:// and must be told
    // the https:// name it actually answers as.
    HUB_PUBLIC_URL: `https://${hostname}`,
    HUB_SECRET: await deriveSecret(env.CELL_SECRET_MASTER, tenantId),
    // Behind Cloudflare every request arrives from the edge. Without this the
    // per-client rate limiter buckets the entire internet as one client.
    HUB_TRUSTED_PROXIES: '0.0.0.0/0,::/0',
    // Where this cell's platform lives — powers the mirror clock (Phase 19).
    // Safe to pass again since Phase 23 B1: identity is keyed on its OWN
    // explicit switch below, never inferred from this URL (the 2026-07-30
    // regression: one env var was doubling as two switches).
    MAUDE_CONTROL_PLANE_URL: env.CONTROL_PLANE_URL ?? 'https://cloud.maude.sh',
    // HYBRID cloud identity (Phase 23 B1/B2): the cell accepts control-plane
    // project tokens IN ADDITION to its local user store, so the workspace
    // password keeps working while the dashboard/desktop lanes migrate.
    // Flip CELL_IDENTITY_MODE=strict (worker var) once the handoff lanes have
    // carried real sign-ins — a deliberate act, never inferred (B1's lesson).
    MAUDE_CLOUD_IDENTITY: env.CELL_IDENTITY_MODE === 'strict' ? 'strict' : '1',
    // Project tokens verify against their OWN derived key (B4) — never
    // HUB_SECRET, which is already the admin bearer and a peer token.
    MAUDE_PROJECT_TOKEN_KEY: await deriveSecret(env.CELL_SECRET_MASTER, tenantId, 'project-token'),
    // The return leg for the cell's own pages (B5). A NEW variable, so it can
    // never re-trip the identity switch.
    HUB_DASHBOARD_URL: env.DASHBOARD_URL ?? 'https://cloud.maude.sh',
    // The customer-facing landing shows THIS, not a generic default. Absent,
    // the cell prettifies its own tenant slug — it never falls back to the
    // operator placeholder a customer should never meet, and (since B1) never
    // to another tenant's name.
    ...(config.projectName ? { MAUDE_PROJECT_NAME: config.projectName } : {}),
    // Object storage — PER-TENANT credentials (Cloud Phase 25 A-1).
    //
    // `s3Creds` are temporary credentials the control plane minted for THIS
    // tenant, scoped to `tenants/<id>/` and TTL-bounded. The legacy branch —
    // the fleet-wide MAUDE_R2_* Worker secrets — exists only for the
    // migration window and logs its own retirement; once the secrets are
    // deleted from the Worker it is dead code. The entrypoint still derives
    // the per-tenant key prefix from MAUDE_TENANT_ID either way (belt AND
    // braces: scoped credentials fail hard on a prefix bug that the
    // app-level prefix would have papered over).
    ...(s3Creds
      ? {
          MAUDE_S3_ENDPOINT: s3Creds.endpoint ?? env.MAUDE_R2_ENDPOINT ?? '',
          MAUDE_S3_BUCKET: s3Creds.bucket ?? env.MAUDE_R2_BUCKET ?? 'maude-cloud-assets',
          MAUDE_S3_ACCESS_KEY_ID: s3Creds.accessKeyId,
          MAUDE_S3_SECRET_ACCESS_KEY: s3Creds.secretAccessKey,
          ...(s3Creds.sessionToken ? { MAUDE_S3_SESSION_TOKEN: s3Creds.sessionToken } : {}),
          ...(s3Creds.expiresAt ? { MAUDE_S3_CREDS_EXPIRES_AT: String(s3Creds.expiresAt) } : {}),
          // The hub refreshes its own credentials before they expire, with
          // the SAME derived secret it already holds (HUB_SECRET authorizes
          // /internal/cell-r2-credentials — it is the same derivation).
          MAUDE_S3_CREDS_URL: `${env.CONTROL_PLANE_URL ?? 'https://cloud.maude.sh'}/internal/cell-r2-credentials?tenant=${encodeURIComponent(tenantId)}`,
        }
      : {
          MAUDE_S3_ENDPOINT: env.MAUDE_R2_ENDPOINT ?? '',
          MAUDE_S3_BUCKET: env.MAUDE_R2_BUCKET ?? 'maude-cloud-assets',
          MAUDE_S3_ACCESS_KEY_ID: env.MAUDE_R2_ACCESS_KEY_ID ?? '',
          MAUDE_S3_SECRET_ACCESS_KEY: env.MAUDE_R2_SECRET_ACCESS_KEY ?? '',
        }),
    MAUDE_S3_REGION: 'auto',
    // Checkpoint cadence. A cell's disk is ephemeral and the platform migrates
    // instances freely, so the gap between checkpoints IS the window of
    // possible loss. Ten minutes is the current trade against R2 write cost.
    MAUDE_BACKUP_INTERVAL_MS: String(10 * 60 * 1000),
    // The project this cell starts from, on FIRST boot only. The cell refuses
    // to seed over an existing checkout, so this is inert on every later wake.
    //
    // PER-TENANT SINCE B1. As a Worker global this was the platform's worst
    // latent bug: one seed repo for the whole fleet, applied to whichever
    // tenant booted first.
    ...(config.seedRepo ? { MAUDE_SEED_REPO: config.seedRepo } : {}),
    // The first person who can sign in — the project's OWNER, as the control
    // plane knows them, never a fleet-wide `PILOT_ADMIN_EMAIL`.
    //
    // The password is DERIVED, not stored: the platform already holds the
    // master, so a per-tenant secret store would add a place to leak from
    // without adding a secret the platform did not already know. It is an
    // INITIAL credential — the same status as the one `workspace-up` prints —
    // and the person is told to change it.
    // Retired under strict (Phase 23 B6): a cloud-identity cell takes every
    // sign-in from the control plane, so seeding a local password would
    // recreate the credential class strict exists to end.
    ...(config.adminEmail && env.CELL_IDENTITY_MODE !== 'strict'
      ? {
          MAUDE_ADMIN_EMAIL: config.adminEmail,
          MAUDE_ADMIN_PASSWORD: await deriveSecret(
            env.CELL_SECRET_MASTER,
            tenantId,
            'initial-admin-password'
          ),
        }
      : {}),
  };
}
