// Platform-facing cell operations — Cloud Phase 20 (export) + Phase 19 (mirror).
//
// Two things a cell does FOR the platform rather than for a connected peer:
//
//   POST /api/export   build the full take-your-work-home bundle (export.mjs)
//                      and put it in object storage, where the dashboard's
//                      "Download everything" serves it from. Authenticated by
//                      a project access token with the OWNER role — the same
//                      offline verification the sign-in path uses (DDR-204),
//                      so the control plane can ask on the owner's behalf and
//                      a control-plane outage still cannot forge one.
//
//   the mirror tick    push the checkout to the customer's GitHub on a clock.
//                      The cell holds no GitHub credential and does not even
//                      hold the mirror CONFIG — it asks the control plane
//                      which repository is configured (presenting its own
//                      derived secret) and gets a one-repository, one-hour
//                      token back (DDR-201). A cell that is told "no mirror"
//                      simply goes back to sleep.
//
// Both report rather than throw: they run inside a serving hub, and a failed
// export or push must cost exactly that operation, never the workspace.

import { projectTokenKey, verifyAccessToken } from './cloud-identity.mjs';
import { buildExport } from './export.mjs';
import { pushMirror } from './mirror-push.mjs';
import { recordRevocations } from './revocations.mjs';
import { putObject, s3ConfigFromEnv } from './s3.mjs';

/**
 * Handle `POST /api/export`. Returns true when the route was ours.
 *
 * @param {object} ctx
 * @param {string} ctx.path
 * @param {string} ctx.method
 * @param {any} ctx.request
 * @param {(status: number, payload: unknown) => void} ctx.respondJson
 * @param {string|null} ctx.repoDir
 * @param {Function|null} ctx.run           git runner
 * @param {object} [ctx.env]
 */
export async function handleExportRoute(ctx) {
  const { path, method, respondJson, env = process.env } = ctx;
  if (path !== '/api/export') return false;
  if (method !== 'POST') {
    respondJson(405, { error: 'method not allowed' });
    return true;
  }

  const tenant = env.MAUDE_TENANT_ID ?? '';
  const secret = projectTokenKey(env);
  const auth = (ctx.request?.headers?.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  const verdict = verifyAccessToken(auth, secret, { tenantId: tenant || undefined });
  if (!tenant || !secret || !verdict.ok || verdict.user.role !== 'owner') {
    respondJson(401, { error: 'an export can only be started by the project owner' });
    return true;
  }

  if (!ctx.repoDir || !ctx.run) {
    respondJson(409, {
      error: 'this workspace keeps no history here, so there is nothing to export',
    });
    return true;
  }

  const built = await buildExport({ repoDir: ctx.repoDir, tenant, run: ctx.run });
  if (!built.ok) {
    respondJson(409, { error: built.reason });
    return true;
  }

  let cfg;
  try {
    cfg = s3ConfigFromEnv(env);
  } catch (err) {
    respondJson(502, { error: `the export was built but has nowhere to go: ${err.message}` });
    return true;
  }

  const files = [];
  for (const f of built.files) {
    const key = `${built.prefix}${f.name}`;
    try {
      await putObject(cfg, key, f.body);
    } catch (err) {
      // A partial export is worse than a failed one — the reader cannot tell
      // which kind they have. Report the first failure and offer nothing.
      respondJson(502, { error: `the export could not be stored (${f.name}: ${err.message})` });
      return true;
    }
    files.push({ name: f.name, bytes: f.body.length, key });
  }

  respondJson(200, { ok: true, stamp: built.stamp, prefix: built.prefix, files });
  return true;
}

/**
 * Ask the control plane which repository this cell mirrors to.
 * `{ repository, branch }`, or `{ repository: null }` for "no mirror".
 */
export async function fetchMirrorConfig(
  { controlPlaneUrl, tenantId, cellSecret },
  { fetchImpl = fetch } = {}
) {
  try {
    const res = await fetchImpl(
      `${controlPlaneUrl.replace(/\/+$/, '')}/internal/mirror-config?tenant=${encodeURIComponent(tenantId)}`,
      { headers: { authorization: `Bearer ${cellSecret}` } }
    );
    if (!res.ok) return { repository: null, reason: `HTTP ${res.status}` };
    const body = await res.json();
    return { repository: body?.repository ?? null, branch: body?.branch ?? 'main' };
  } catch (err) {
    return { repository: null, reason: err.message };
  }
}

/**
 * The mirror clock. Ticks quietly forever; a cell with no mirror configured
 * costs one config lookup per tick and nothing else.
 *
 * The first tick runs shortly after boot rather than a full interval later, so
 * connecting a repository shows a result while the person is still looking.
 */
export function scheduleMirror({
  repoDir,
  run,
  env = process.env,
  intervalMs = Number(env.MAUDE_MIRROR_INTERVAL_MS ?? 60 * 60 * 1000),
  firstDelayMs = 90 * 1000,
  log = console,
  fetchImpl = fetch,
}) {
  const controlPlaneUrl = env.MAUDE_CONTROL_PLANE_URL ?? '';
  const tenantId = env.MAUDE_TENANT_ID ?? '';
  const cellSecret = env.HUB_SECRET ?? '';
  if (!controlPlaneUrl || !tenantId || !cellSecret || !repoDir || !run) {
    return { stop() {}, enabled: false };
  }

  let running = false;
  const tick = async () => {
    if (running) return null; // a slow push must not stack a second one
    running = true;
    try {
      const config = await fetchMirrorConfig(
        { controlPlaneUrl, tenantId, cellSecret },
        { fetchImpl }
      );
      if (!config.repository) return null;
      return await pushMirror(
        {
          repoDir,
          repository: config.repository,
          branch: config.branch,
          controlPlaneUrl,
          tenantId,
          cellSecret,
          run,
          log,
        },
        { fetchImpl }
      );
    } catch (err) {
      // Never let the clock die — a mirror is a copy, and the copy failing
      // must cost nothing but this tick.
      log.error?.(`[mirror] tick failed: ${err.message}`);
      return null;
    } finally {
      running = false;
    }
  };

  const first = setTimeout(tick, firstDelayMs);
  const timer = setInterval(tick, intervalMs);
  first.unref?.();
  timer.unref?.();
  return {
    enabled: true,
    tick, // exposed for tests and for a future "push now" button
    stop() {
      clearTimeout(first);
      clearInterval(timer);
    },
  };
}

/**
 * Ask the control plane whose live sessions must die (Phase 23 B2).
 * `{ revocations: [{email, at}] }` — emails and timestamps, never tokens.
 */
export async function fetchRevocations(
  { controlPlaneUrl, tenantId, cellSecret, since },
  { fetchImpl = fetch } = {}
) {
  try {
    const res = await fetchImpl(
      `${controlPlaneUrl.replace(/\/+$/, '')}/internal/revocations?tenant=${encodeURIComponent(tenantId)}&since=${encodeURIComponent(since)}`,
      { headers: { authorization: `Bearer ${cellSecret}` } }
    );
    if (!res.ok) return { revocations: [], reason: `HTTP ${res.status}` };
    const body = await res.json();
    return { revocations: Array.isArray(body?.revocations) ? body.revocations : [] };
  } catch (err) {
    return { revocations: [], reason: err.message };
  }
}

/**
 * The revocation sweep (Phase 23 B2) — the missing half of "removal lands
 * within 12 hours". The TTL merely BOUNDS how long an already-open session
 * survives a removal; this clock actively ends it, usually within minutes.
 *
 * Idempotent by construction: the window always reaches back past the longest
 * token the cell could have minted, and revoking an already-revoked owner is
 * a no-op — so a restart never misses a removal and never double-counts one.
 */
export function scheduleRevocationSweep({
  dataDir,
  revokeForOwner,
  kickLabel,
  env = process.env,
  intervalMs = Number(env.MAUDE_REVOCATION_INTERVAL_MS ?? 10 * 60 * 1000),
  firstDelayMs = 60 * 1000,
  windowMs = 26 * 60 * 60 * 1000,
  log = console,
  fetchImpl = fetch,
  nowFn = Date.now,
}) {
  const controlPlaneUrl = env.MAUDE_CONTROL_PLANE_URL ?? '';
  const tenantId = env.MAUDE_TENANT_ID ?? '';
  const cellSecret = env.HUB_SECRET ?? '';
  if (!controlPlaneUrl || !tenantId || !cellSecret || !dataDir || !revokeForOwner) {
    return { stop() {}, enabled: false };
  }

  let running = false;
  const tick = async () => {
    if (running) return null;
    running = true;
    try {
      const { revocations } = await fetchRevocations(
        { controlPlaneUrl, tenantId, cellSecret, since: nowFn() - windowMs },
        { fetchImpl }
      );
      // Persist BEFORE killing sessions: the registry is what stops the
      // holder re-opening what the kick just closed, so it must be in place
      // even if the kick half throws.
      recordRevocations(dataDir, revocations);
      let revokedTotal = 0;
      for (const r of revocations) {
        if (typeof r?.email !== 'string' || !r.email) continue;
        const labels = revokeForOwner(dataDir, r.email.trim().toLowerCase());
        for (const label of labels) kickLabel?.(label);
        if (labels.length) {
          revokedTotal += labels.length;
          log.log?.(`[revocation] ended ${labels.length} session(s) for a removed member`);
        }
      }
      return { seen: revocations.length, revoked: revokedTotal };
    } catch (err) {
      log.error?.(`[revocation] tick failed: ${err.message}`);
      return null;
    } finally {
      running = false;
    }
  };

  const first = setTimeout(tick, firstDelayMs);
  const timer = setInterval(tick, intervalMs);
  first.unref?.();
  timer.unref?.();
  return {
    enabled: true,
    tick,
    stop() {
      clearTimeout(first);
      clearInterval(timer);
    },
  };
}
