// The cell as a Durable Object — Cloud Phase 15 Tasks 1/2.
//
// One project, one container, one DO. The DO is the lifecycle owner (start,
// idle-sleep, wake); the container is the tenant's Maude workspace, which is
// the SAME image as the self-hosted hub plus tenant scoping (DDR-195).
//
// WHY PER-TENANT SECRETS ARE DERIVED, NOT SHARED. A cell needs an operator
// credential (HUB_SECRET) and it needs one that is ITS OWN: handing every cell
// the same value would make one leaked cell an operator credential for every
// other project on the platform. Deriving it — HMAC(master, tenant) — gives a
// distinct, unguessable value per tenant from a single stored secret, so
// rotating the master rotates every cell and no per-tenant secret store has to
// exist. The master itself never enters a container.
//
// CONTAINMENT (DDR-193 §2) is an image property, asserted at CI time, at build
// time and at boot. Nothing here can re-enable rendering; the image has no
// renderer in it.

import { Container } from '@cloudflare/containers';

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
 * Environment for one tenant's cell.
 *
 * PURE and exported, because this mapping is where a mistake means one tenant
 * reading another's data — and that must be reviewable without booting a
 * container (DDR-196 §1).
 */
export async function cellEnv({ tenantId, env, hostname }) {
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
    // Where this cell's platform lives (Cloud Phases 19/20/22). Powers the
    // mirror clock and — once enabled per-cell — cloud identity.
    //
    // WITHDRAWN 2026-07-30, deliberately: `cloudIdentityEnabled()` in the hub
    // keys on MAUDE_CONTROL_PLANE_URL && MAUDE_TENANT_ID, so passing the URL
    // for the MIRROR silently flipped the live cell into cloud-identity mode
    // — and with no browser consumer for the project token yet, that made the
    // cell unreachable in a browser (the derived password was refused with
    // "sign in at the dashboard", and the dashboard had nothing to hand over).
    // One env var was doubling as two switches. Until the browser handoff
    // lands (and identity gets its own explicit switch), the URL stays out:
    // the mirror clock sleeps, the tenant keeps their working sign-in.
    // MAUDE_CONTROL_PLANE_URL: env.CONTROL_PLANE_URL ?? 'https://cloud.maude.sh',
    // Object storage. The entrypoint derives per-tenant key prefixes from
    // MAUDE_TENANT_ID — one bucket, one prefix per tenant.
    MAUDE_S3_ENDPOINT: env.MAUDE_R2_ENDPOINT ?? '',
    MAUDE_S3_BUCKET: env.MAUDE_R2_BUCKET ?? 'maude-cloud-assets',
    MAUDE_S3_ACCESS_KEY_ID: env.MAUDE_R2_ACCESS_KEY_ID ?? '',
    MAUDE_S3_SECRET_ACCESS_KEY: env.MAUDE_R2_SECRET_ACCESS_KEY ?? '',
    MAUDE_S3_REGION: 'auto',
    // Checkpoint cadence. A cell's disk is ephemeral and the platform migrates
    // instances freely, so the gap between checkpoints IS the window of
    // possible loss. Ten minutes is the current trade against R2 write cost.
    MAUDE_BACKUP_INTERVAL_MS: String(10 * 60 * 1000),
    // The project this cell starts from, on FIRST boot only. The cell refuses
    // to seed over an existing checkout, so this is inert on every later wake.
    ...(env.MAUDE_SEED_REPO ? { MAUDE_SEED_REPO: env.MAUDE_SEED_REPO } : {}),
    // The first person who can sign in.
    //
    // The password is DERIVED, not stored: the platform already holds the
    // master, so a per-tenant secret store would add a place to leak from
    // without adding a secret the platform did not already know. It is an
    // INITIAL credential — the same status as the one `workspace-up` prints —
    // and the person is told to change it.
    ...(env.PILOT_ADMIN_EMAIL
      ? {
          MAUDE_ADMIN_EMAIL: env.PILOT_ADMIN_EMAIL,
          MAUDE_ADMIN_PASSWORD: await deriveSecret(
            env.CELL_SECRET_MASTER,
            tenantId,
            'initial-admin-password'
          ),
        }
      : {}),
  };
}

export class MaudeCell extends Container {
  defaultPort = CELL_PORT;

  /**
   * Idle timeout. Long enough that stepping away does not cost a cold start
   * (which pays rehydrate-from-R2); short enough that an idle cell is not
   * billed compute for doing nothing.
   */
  sleepAfter = '20m';

  /**
   * Start with THIS tenant's environment, then proxy.
   *
   * Per-instance, not class-level: `envVars` on the class is identical for
   * every instance, which is exactly what must not happen when the variables
   * include an operator credential and a storage prefix.
   */
  /**
   * Stop the container so the next request starts it fresh.
   *
   * Environment is applied at START. Without this, changing a cell's
   * configuration — its seed repo, its storage credentials, its first user —
   * has no effect until the idle timeout happens to fire, which is a 20-minute
   * wait with no way to tell whether the change took. An operator needs to be
   * able to say "apply it now".
   */
  async restart() {
    if (this.ctx.container?.running) await this.ctx.container.destroy();
    return { restarted: true };
  }

  async fetch(request) {
    const fromHeader = request.headers.get(TENANT_HEADER);
    // Remembered, so a wake triggered by anything other than a routed request
    // still knows who it is.
    const tenantId = fromHeader ?? (await this.ctx.storage.get('tenantId'));
    if (!isValidTenantId(tenantId)) {
      return new Response('this cell has no tenant', { status: 500 });
    }
    if (fromHeader && fromHeader !== (await this.ctx.storage.get('tenantId'))) {
      await this.ctx.storage.put('tenantId', fromHeader);
    }
    this.tenantId = tenantId;

    const hostname = new URL(request.url).hostname;
    await this.startAndWaitForPorts({
      startOptions: { envVars: await cellEnv({ tenantId, env: this.env, hostname }) },
      // A cold start pays a rehydrate from R2 — and a FIRST start also pays a
      // full clone of the tenant's project — before anything listens. The
      // default turns that normal path into a 500; 120 s was still not enough
      // for a ~280 MB seed on a quarter of a vCPU.
      cancellationOptions: { portReadyTimeoutMS: 600_000 },
    });
    return this.containerFetch(request);
  }

  onStart() {
    console.log(`[cell] ${this.tenantId ?? '?'} started`);
  }

  onStop() {
    // Not an error path. The hub flushes SQLite and the pending autosave
    // commit on SIGTERM (Cloud Phase 16), so a sleep is lossless by design.
    console.log(`[cell] ${this.tenantId ?? '?'} stopped`);
  }

  onError(error) {
    console.error(`[cell] ${this.tenantId ?? '?'} error: ${error}`);
  }
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
  return isValidTenantId(label) ? label : null;
}

/** The operator route: `POST /_cell/restart`, authorized by the cell's own secret. */
export const RESTART_PATH = '/_cell/restart';

/**
 * Constant-time compare. A timing oracle on an operator credential is worth
 * closing even when the credential is derived rather than stored.
 */
function secretsMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Route one request to its tenant's cell. */
export async function routeToCell(request, env, tenantId) {
  const id = env.MAUDE_CELL.idFromName(tenantId);
  const stub = env.MAUDE_CELL.get(id);

  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === RESTART_PATH) {
    // Authorized by THIS cell's derived secret — the platform can compute it,
    // nobody else can, and it is different for every tenant. A shared operator
    // key here would make one leak a restart button for every project.
    const offered = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const expected = await deriveSecret(env.CELL_SECRET_MASTER, tenantId);
    if (!secretsMatch(offered, expected)) {
      return new Response('unauthorized\n', { status: 401 });
    }
    return Response.json(await stub.restart());
  }

  const forwarded = new Request(request);
  forwarded.headers.set(TENANT_HEADER, tenantId);
  return stub.fetch(forwarded);
}
