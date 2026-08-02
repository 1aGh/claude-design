// The cell as a Durable Object — Cloud Phase 15 Tasks 1/2.
//
// One project, one container, one DO. The DO is the lifecycle owner (start,
// idle-sleep, wake); the container is the tenant's Maude workspace, which is
// the SAME image as the self-hosted hub plus tenant scoping (DDR-195).
//
// THE RUNTIME HALF ONLY. Everything decidable without a container — the tenant
// grammar, the derived secrets, the env mapping, and (since Phase 24 B1) the
// per-tenant config fetch — lives in `cell-config.mjs`, because this file
// imports `@cloudflare/containers` and that does not resolve under plain Node.
// The split is what makes the mapping testable at all; it is re-exported here
// so every existing importer is unaffected.
//
// CONTAINMENT (DDR-193 §2) is an image property, asserted at CI time, at build
// time and at boot. Nothing here can re-enable rendering; the image has no
// renderer in it.

import { Container } from '@cloudflare/containers';

import {
  CELL_PORT,
  cellEnv,
  deriveSecret,
  fetchTenantConfig,
  fetchTenantS3Credentials,
  isValidTenantId,
  RESTART_PATH,
  secretsMatch,
  TENANT_HEADER,
} from './cell-config.mjs';

export {
  CELL_PORT,
  cellEnv,
  deriveSecret,
  fetchTenantConfig,
  fetchTenantS3Credentials,
  isValidTenantId,
  RESTART_PATH,
  secretsMatch,
  TENANT_HEADER,
  tenantFromHostname,
} from './cell-config.mjs';

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
    // Who this tenant is, asked of the control plane rather than read from a
    // fleet-wide variable (B1). Resolved per start; the DO's own storage is
    // the offline fallback, never another tenant's value.
    const config = await fetchTenantConfig({
      tenantId,
      env: this.env,
      storage: this.ctx.storage,
    });
    // This tenant's OWN storage credentials (Phase 25 A-1) — minted fresh on
    // every container start, so a wake always carries a full TTL. FAIL CLOSED:
    // a cell that cannot get credentials AND has no legacy shared key must not
    // start, because a cold start without storage rehydrates nothing and comes
    // up as an empty project — indistinguishable from a deleted one.
    const s3Creds = await fetchTenantS3Credentials({ tenantId, env: this.env });
    if (!s3Creds && !this.env.MAUDE_R2_ACCESS_KEY_ID) {
      return new Response(
        'this cell could not obtain storage credentials — refusing to start empty\n',
        { status: 503 }
      );
    }
    await this.startAndWaitForPorts({
      startOptions: {
        envVars: await cellEnv({ tenantId, env: this.env, hostname, config, s3Creds }),
      },
      // A cold start pays a rehydrate from R2 — and a FIRST start also pays a
      // full clone of the tenant's project — before anything listens. The
      // default turns that normal path into a 500; 120 s was still not enough
      // for a ~280 MB seed on a quarter of a vCPU.
      // 30 MINUTES, and the number is evidence rather than taste.
      //
      // The entrypoint rehydrates the whole working set from R2 BEFORE the hub
      // binds its port, so this deadline is really "how big may a project be".
      // At 1.1 GiB on a half vCPU, alligators does not finish inside 600 s —
      // and the failure mode is vicious: the deadline fires, the DO starts
      // over on an empty disk, and every retry re-downloads from zero. The
      // project had been fine for weeks only because its disk stayed warm; the
      // first instance migration turned a working project into a permanent
      // restart loop, with the platform reporting the container as `running`
      // throughout (2026-08-03 incident).
      //
      // THE REAL FIX IS TO BIND FIRST AND RESTORE BEHIND a "restoring" page,
      // so availability stops being a function of project size. Until that
      // exists this number must stay ahead of the largest tenant.
      cancellationOptions: { portReadyTimeoutMS: 1_800_000 },
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
