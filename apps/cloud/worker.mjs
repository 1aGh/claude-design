// Maude Cloud control-plane Worker — Cloud Phase 12, the effects layer.
//
// THIN ON PURPOSE (DDR-196 §1): every branch delegates to a tested decision
// module (reconcile.mjs, stripe-webhook.mjs, db.mjs). If a change adds an
// `if` about business state HERE instead of THERE, the split has failed.
//
// Three routes and a cron. Deliberately no framework: a router for three
// routes is a dependency with no cargo.
//
//   GET  /health           version + D1 reachability
//   POST /webhooks/stripe  verify signature → enqueue a reconcile job. The
//                          webhook NEVER carries an instruction — it names a
//                          project, the reconciler re-derives everything.
//   (cron, hourly)         drain pending jobs + sweep every project.
//
// Queues (Phase 11 unlock) will drain the same jobs table faster; the table —
// not the queue — is the durable record either way.

import { currentAccount, handleAuth } from './auth-routes.mjs';
import { deriveCellSecret, mintProjectToken, secretsMatch } from './cell-token.mjs';
import { handleCheckoutRoutes } from './checkout-routes.mjs';
import {
  audit,
  enqueueReconcile,
  finishJob,
  getProject,
  getProjectBySubscription,
  listProjects,
  pendingJobs,
  saveTenant,
  tenantFromRow,
} from './db.mjs';
import { handleDeviceAuth, personalTokenAccount } from './device-auth.mjs';
import { costOf, harden, isHtml, sameSiteGate, spend } from './edge.mjs';
import { deletionWarningEmail, projectPausedEmail, sendEmail } from './email.mjs';
import { mintInstallationToken } from './github-app.mjs';
import { handleHandoff } from './handoff.mjs';
import { handleInviteRoutes } from './invites.mjs';
import { applySchema } from './migrate.mjs';
import { ACCESS_MESSAGES, decideAccess } from './project-access.mjs';
import { handleProjectAdminRoutes } from './project-admin.mjs';
import { handleProjectRoutes } from './project-routes.mjs';
import { ensureCellDomain, removeCellDomain } from './provision.mjs';
import { purgeTenantObjects } from './purge.mjs';
import { SUSPEND_RETENTION_DAYS, settle } from './reconcile.mjs';
import { handleReport } from './report.mjs';
import { SCHEMA_SQL } from './schema.mjs';
import { projectRefFromEvent, verifyStripeSignature } from './stripe-webhook.mjs';

export const WORKER_VERSION = 'phase-13';

// Token minting + derived-secret helpers live in cell-token.mjs since the
// dashboard grew a second caller (the Phase-20 export trigger).

/**
 * Hand a signed-in person a token for one project.
 *
 * The signing key is the SAME per-cell secret the cell already holds
 * (DDR-199 §6), so no new secret has to exist or be distributed — and the cell
 * can verify without asking anyone.
 */
async function openProject(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid request' }, 400);
  }
  const projectId = String(body?.project ?? '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectId)) {
    return json({ error: ACCESS_MESSAGES['no-access'] }, 404);
  }

  // A device's personal token and a browser's session are the same person
  // through two doors (Phase 23 C2).
  const account =
    (await personalTokenAccount(env, request)) ?? (await currentAccount(request, env));
  let project = null;
  let members = [];
  try {
    project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
    const rows = await env.DB.prepare(
      'SELECT account_id, role FROM project_members WHERE project_id = ?'
    )
      .bind(projectId)
      .all();
    members = rows?.results ?? [];
  } catch {
    /* an unreadable membership list is not access — decideAccess sees [] */
  }

  const verdict = decideAccess({ accountId: account?.id ?? null, project, members });
  if (!verdict.ok) {
    // 404 for everything that is not "sign in", so the response never
    // distinguishes a project that exists from one that does not.
    const status = verdict.reason === 'not-signed-in' ? 401 : 404;
    return json({ error: ACCESS_MESSAGES[verdict.reason] }, status);
  }

  if (!env.CELL_SECRET_MASTER) {
    console.error('[open] CELL_SECRET_MASTER is not configured');
    return json({ error: 'This project cannot be opened right now. Try again shortly.' }, 503);
  }
  // UTF-8-first signing lives in cell-token.mjs — `btoa` throws on any
  // character above U+00FF, so a name with a Czech "ě" would break sign-in
  // for that person and nobody else; the interop test pins this.
  const { token, claims } = await mintProjectToken({
    master: env.CELL_SECRET_MASTER ?? '',
    project: projectId,
    email: account.email,
    role: verdict.role,
  });

  return json({
    token,
    role: verdict.role,
    url: `https://${projectId}.${env.CELL_ZONE ?? 'cloud.maude.sh'}`,
    expiresAt: claims.exp,
  });
}

/**
 * Issue a repository-scoped push token to ONE cell.
 *
 * Two independent checks, and both must hold:
 *   1. the caller proves it is that tenant's cell (derived secret);
 *   2. the repository it asks for is the one THAT tenant has configured.
 *
 * The second is the one that matters. Without it, any cell could ask for a
 * token to any repository the App is installed on — including repositories
 * belonging to other customers — and the first check would happily pass.
 */
async function mintForCell(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid request' }, 400);
  }
  const tenant = String(body?.tenant ?? '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenant)) return json({ error: 'unauthorized' }, 401);

  const offered = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const expected = await deriveCellSecret(env.CELL_SECRET_MASTER ?? '', tenant);
  if (!env.CELL_SECRET_MASTER || !secretsMatch(offered, expected)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let configured;
  try {
    const row = await env.DB.prepare('SELECT mirror_repo FROM projects WHERE id = ?')
      .bind(tenant)
      .first();
    configured = row?.mirror_repo ?? null;
  } catch {
    configured = null;
  }
  if (!configured) return json({ error: 'no mirror is configured for this project' }, 409);

  const asked = String(body?.repository ?? '');
  // Compare against the OWNER/NAME the customer configured, not against
  // whatever the cell sent. The cell may name only the repo half; the owner
  // is never the cell's to choose.
  const [, name] = configured.split('/');
  if (asked !== name && asked !== configured) {
    return json({ error: "that repository is not this project's mirror" }, 403);
  }

  try {
    const minted = await mintInstallationToken({
      privateKeyPem: env.GITHUB_APP_PRIVATE_KEY,
      appId: env.GITHUB_APP_ID,
      installationId: env.GITHUB_APP_INSTALLATION_ID,
      repository: name,
    });
    // Never logged, never stored — issued to one caller and forgotten.
    return json({ token: minted.token, expiresAt: minted.expiresAt });
  } catch (err) {
    console.error(`[mirror-token] ${tenant}: ${err.message}`);
    return json({ error: 'a push credential could not be issued' }, 502);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Every answer leaves through the same door (edge.mjs) — the gates run
    // before the router, the header floor is stamped after it. A route can
    // tighten either; none can forget them.
    if (!sameSiteGate(request, url)) {
      return harden(json({ error: 'That request did not come from Maude Cloud.' }, 403), { url });
    }
    const rule = costOf(url.pathname, request.method);
    if (rule) {
      const budget = await spend(env, request, rule);
      if (!budget.ok) {
        return harden(json({ error: 'Too many attempts. Wait a minute and try again.' }, 429), {
          url,
        });
      }
    }

    const response = await this.route(request, env, url);
    return harden(response, { url, html: isHtml(response) });
  },

  async route(request, env, url) {
    // Identity surface (pages, signup/login, Google, grant mint) — Phase 13.
    const auth = await handleAuth(request, env);
    if (auth) return auth;

    // One session read for every signed-in surface below.
    const account = await currentAccount(request, env);

    // The desktop's lane (Phase 23 C): device sign-in, the Account page, and
    // the Bearer client API.
    const deviceSurface = await handleDeviceAuth(request, env, { account });
    if (deviceSurface) return deviceSurface;

    // The one-time browser→app handoff (Phase 23 B3 / Phase 17): a code in a
    // maude:// URL, a project token only ever in a POST body.
    const handoffSurface = await handleHandoff(request, env, { account });
    if (handoffSurface) return handoffSurface;

    // Per-project control surfaces (Cloud Phase 22 / DDR-204). Before the
    // control-plane routes, because `/projects/...` is theirs.
    const projectSurface = await handleProjectRoutes(request, env, { account });
    if (projectSurface) return projectSurface;

    // Self-administration (Cloud Phase 20 + the Phase 19 settings half):
    // download everything, delete-through-export, the customer-visible
    // activity record, and where the history mirrors to.
    const adminSurface = await handleProjectAdminRoutes(request, env, { account });
    if (adminSurface) return adminSurface;

    // Accepting an invitation (Cloud Phase 22). The invite is the account:
    // one link signs somebody up AND lands them in the project.
    const inviteSurface = await handleInviteRoutes(request, env, { account });
    if (inviteSurface) return inviteSurface;

    // Starting a project + billing (Cloud Phase 14 / DDR-203): the wizard,
    // the Checkout return, the waiting room that settles provision-first,
    // and the Stripe-hosted billing portal handoff.
    const checkoutSurface = await handleCheckoutRoutes(request, env, { account });
    if (checkoutSurface) return checkoutSurface;

    // Opening a project (Cloud Phase 22 / DDR-204).
    //
    // The control plane is the identity provider: it decides whether this
    // person may open this project, and hands them a short-lived token the
    // cell can verify OFFLINE. The cell never decides access, and a
    // control-plane outage never locks anyone out of a token they already
    // hold — only out of getting a new one.
    if (request.method === 'POST' && url.pathname === '/projects/open') {
      return openProject(request, env);
    }

    // The mirror credential boundary (Cloud Phase 19).
    //
    // The App private key can mint for EVERY repository the App is installed
    // on. It lives here and only here; a cell asks, presenting its own derived
    // secret, and receives a token scoped to one repository for about an hour.
    // A compromised cell is then worth exactly its own mirror.
    if (request.method === 'POST' && url.pathname === '/internal/mirror-token') {
      return mintForCell(request, env);
    }

    // A cell asking who IT is (Cloud Phase 24 B1).
    //
    // THE MOST DANGEROUS THING THIS PHASE FIXED. `cellEnv()` used to read
    // `MAUDE_SEED_REPO`, `PROJECT_NAME` and `PILOT_ADMIN_EMAIL` from the
    // cells-Worker's own environment — values shared by every tenant on the
    // platform. A second customer's FIRST boot could therefore clone the
    // first customer's repository, and their workspace could be seeded with
    // somebody else's admin address. It was survivable only because there has
    // never been a second customer.
    //
    // Same derived-secret gate as the mirror endpoints: a cell can ask about
    // itself and about nothing else, because the secret it must present is
    // computed from the tenant id in the query.
    if (request.method === 'GET' && url.pathname === '/internal/cell-config') {
      const tenant = String(url.searchParams.get('tenant') ?? '');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenant)) return json({ error: 'unauthorized' }, 401);
      const offered = (request.headers.get('authorization') ?? '')
        .replace(/^Bearer\s+/i, '')
        .trim();
      const expected = await deriveCellSecret(env.CELL_SECRET_MASTER ?? '', tenant);
      if (!env.CELL_SECRET_MASTER || !secretsMatch(offered, expected)) {
        return json({ error: 'unauthorized' }, 401);
      }
      let row = null;
      try {
        row = await env.DB.prepare(
          `SELECT p.name, p.seed_repo, p.state, a.email AS owner_email
             FROM projects p JOIN accounts a ON a.id = p.account_id
            WHERE p.id = ?`
        )
          .bind(tenant)
          .first();
      } catch {
        /* an unreadable row is "no per-tenant config", never another tenant's */
      }
      // Absent is a real answer, and the cell's fail-closed default. It must
      // never be filled in from a shared value — that is the bug this exists
      // to close.
      //
      // A PURGED tenant is described to nobody. "Everything is erased from our
      // computers" is the sentence on the delete screen; continuing to hand
      // out that project's name, seed repository and owner address afterwards
      // makes it not quite true (attacker review, 2026-08-01).
      if (row?.state === 'purged') {
        return json({ projectName: null, seedRepo: null, adminEmail: null });
      }
      return json({
        projectName: row?.name ?? null,
        seedRepo: row?.seed_repo ?? null,
        adminEmail: row?.owner_email ?? null,
      });
    }

    // A cell asking which repository it mirrors to (Cloud Phase 19). The cell
    // holds no config of its own — connecting a mirror in the dashboard needs
    // no cell restart, because the clock asks this on every tick.
    if (request.method === 'GET' && url.pathname === '/internal/mirror-config') {
      const tenant = String(url.searchParams.get('tenant') ?? '');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenant)) return json({ error: 'unauthorized' }, 401);
      const offered = (request.headers.get('authorization') ?? '')
        .replace(/^Bearer\s+/i, '')
        .trim();
      const expected = await deriveCellSecret(env.CELL_SECRET_MASTER ?? '', tenant);
      if (!env.CELL_SECRET_MASTER || !secretsMatch(offered, expected)) {
        return json({ error: 'unauthorized' }, 401);
      }
      let row = null;
      try {
        row = await env.DB.prepare('SELECT mirror_repo, mirror_branch FROM projects WHERE id = ?')
          .bind(tenant)
          .first();
      } catch {
        /* an unreadable row is "no mirror", not an error the clock can act on */
      }
      return json({ repository: row?.mirror_repo ?? null, branch: row?.mirror_branch ?? 'main' });
    }

    // A cell asking whose live sessions must die (Phase 23 B2). Same derived-
    // secret gate as the mirror endpoints; the answer is emails + timestamps,
    // never tokens. `since` bounds the read — the sweep asks for a window a
    // little wider than the longest token it could have minted.
    if (request.method === 'GET' && url.pathname === '/internal/revocations') {
      const tenant = String(url.searchParams.get('tenant') ?? '');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenant)) return json({ error: 'unauthorized' }, 401);
      const offered = (request.headers.get('authorization') ?? '')
        .replace(/^Bearer\s+/i, '')
        .trim();
      const expected = await deriveCellSecret(env.CELL_SECRET_MASTER ?? '', tenant);
      if (!env.CELL_SECRET_MASTER || !secretsMatch(offered, expected)) {
        return json({ error: 'unauthorized' }, 401);
      }
      const since = Number(url.searchParams.get('since') ?? 0) || 0;
      let rows = [];
      try {
        const res = await env.DB.prepare(
          'SELECT email, revoked_at FROM member_revocations WHERE project_id = ? AND revoked_at >= ? ORDER BY revoked_at'
        )
          .bind(tenant, since)
          .all();
        rows = res?.results ?? [];
      } catch {
        /* an unreadable table is an empty sweep, not an error the clock can act on */
      }
      return json({ revocations: rows.map((r) => ({ email: r.email, at: r.revoked_at })) });
    }

    // Bug-report intake (feature-bug-report-button). Deliberately BEFORE any
    // signed-in surface check — reporters need no account. report.mjs owns
    // validation, quotas, and the kill switch; the issue lands in the private
    // intake repo, never here.
    const reportSurface = await handleReport(request, env);
    if (reportSurface) return reportSurface;

    if (request.method === 'GET' && url.pathname === '/health') {
      let d1 = 'unreachable';
      try {
        await env.DB.prepare('SELECT version FROM schema_migrations LIMIT 1').first();
        d1 = 'ok';
      } catch {
        /* reported below — health never throws */
      }
      return json({ ok: d1 === 'ok', version: WORKER_VERSION, d1 });
    }

    if (request.method === 'POST' && url.pathname === '/webhooks/stripe') {
      const rawBody = await request.text();
      const verdict = await verifyStripeSignature(
        rawBody,
        request.headers.get('stripe-signature'),
        env.STRIPE_WEBHOOK_SECRET
      );
      if (!verdict.ok) {
        // One bare 400 for every failure mode; the reason goes to logs only.
        console.warn(`[webhook] rejected: ${verdict.reason}`);
        return json({ ok: false }, 400);
      }

      let event;
      try {
        event = JSON.parse(rawBody);
      } catch {
        return json({ ok: false }, 400);
      }

      const ref = projectRefFromEvent(event);
      if (!ref) return json({ ok: true, handled: false }); // acked, not acted on

      const row = ref.projectId
        ? await getProject(env.DB, ref.projectId)
        : await getProjectBySubscription(env.DB, ref.subscriptionId);
      if (!row) {
        // An event for a project we don't know is worth an alert, not a retry
        // loop — 200-ack it and record it.
        await audit(env.DB, {
          actor: 'system',
          action: 'webhook-unknown-project',
          detail: JSON.stringify({ type: event.type, ref }),
        });
        return json({ ok: true, handled: false });
      }

      await enqueueReconcile(env.DB, { projectId: row.id, reason: 'webhook' });
      return json({ ok: true, handled: true });
    }

    return json({ ok: false, error: 'not found' }, 404);
  },

  async scheduled(_event, env) {
    // Pending migrations run BEFORE the sweep. Workers have no boot hook, so
    // the hourly cron is the only place a deploy can reliably meet its own
    // schema. Phase 13 shipped without this and the live D1 stayed on v1 while
    // the code expected v2 — every signup 400'd on a missing column, and the
    // friendly error message hid it.
    try {
      await applySchema(env.DB, SCHEMA_SQL);
    } catch (err) {
      console.error(`[migrate] failed: ${err.message}`);
      return; // never reconcile against a schema we could not establish
    }
    await reconcileSweep(env);
  },
};

/**
 * The hourly truth pass: drain named jobs first, then sweep every project —
 * so a missed webhook costs at most one hour, never correctness (DDR-196).
 *
 * Exported for tests; contains NO decisions — fetch subscription, settle,
 * save, record. Cell side-effects (provision/suspend) become real in Phase 15;
 * until then the settled actions land in the job detail so the record shows
 * what WOULD have been done — visible, never silently dropped.
 */
export async function reconcileSweep(env, { now = Date.now() } = {}) {
  const outcomes = [];
  const seen = new Set();

  const jobs = await pendingJobs(env.DB);
  for (const job of jobs) {
    outcomes.push(await runOne(env, job.project_id, { jobId: job.id, now }));
    seen.add(job.project_id);
  }
  for (const row of await listProjects(env.DB)) {
    if (!seen.has(row.id)) outcomes.push(await runOne(env, row.id, { now }));
  }
  return outcomes;
}

async function runOne(env, projectId, { jobId = null, now }) {
  const row = await getProject(env.DB, projectId);
  if (!row) {
    if (jobId) await finishJob(env.DB, jobId, 'failed', 'project not found', { now });
    return { projectId, outcome: 'failed', detail: 'project not found' };
  }

  let subscription = null;
  if (row.subscription_id) {
    try {
      subscription = await fetchSubscription(env, row.subscription_id);
    } catch (err) {
      // Stripe unreachable → HALT this project, touch nothing. An outage must
      // not read as "subscription gone" (which would start the export clock).
      if (jobId) await finishJob(env.DB, jobId, 'halted', `stripe: ${err.message}`, { now });
      return { projectId, outcome: 'halted', detail: `stripe: ${err.message}` };
    }
  }

  try {
    const { tenant, actions } = settle(tenantFromRow(row), subscription, { now });
    await saveTenant(env.DB, tenant, { now });
    // Cloud Phase 24 B3. Until this line the settled actions were RECORDED and
    // nothing else — "become real in Phase 15" said the comment, through Phase
    // 23. So a tenant who stopped paying kept a serving cell, and the
    // export-before-teardown guarantee (DDR-193 §3) never sent itself.
    //
    // Effects run AFTER the row is saved, deliberately: an effect that fails
    // must leave a state we can re-derive on the next sweep, not a state we
    // never wrote down.
    const performed = await performActions(env, projectId, row, actions, { now });
    const detail = actions.length ? JSON.stringify({ actions, performed }) : null;
    if (jobId) await finishJob(env.DB, jobId, 'ok', detail, { now });
    if (actions.length) {
      await audit(env.DB, {
        projectId,
        actor: 'system',
        action: 'reconcile',
        detail,
      });
    }
    return { projectId, outcome: 'ok', actions, performed };
  } catch (err) {
    // settle() throwing means a flapping loop — the one thing that must page.
    if (jobId) await finishJob(env.DB, jobId, 'failed', err.message, { now });
    await audit(env.DB, {
      projectId,
      actor: 'system',
      action: 'reconcile-failed',
      detail: err.message,
    });
    return { projectId, outcome: 'failed', detail: err.message };
  }
}

/**
 * Turn the reconciler's ACTIONS into effects — Cloud Phase 24 B3.
 *
 * THE ORDER IS NOT THE ARRAY'S ORDER, and that is the point. `reconcile()`
 * emits `suspend-cell` before `send-export` because it computes compute before
 * guarantees; performing them in that order would take the workspace away and
 * only then try to build the copy we promised — from a workspace that is no
 * longer reachable. So the export goes FIRST, always, and the teardown steps
 * go last. DDR-193 §3 is an ordering, and orderings belong in one place.
 *
 * Every effect is best-effort and reported. A sweep that throws stops the rest
 * of the fleet; a sweep that records what failed gets re-derived next hour,
 * which is the whole reason the reconciler is a fixed point.
 */
async function performActions(env, projectId, row, actions, { now }) {
  const kinds = new Set(actions.map((a) => a.kind));
  const performed = [];
  // The sweep's clock, not the wall clock. `audit()` defaults to `Date.now()`,
  // and the "have we already warned" guard below compares an audit row's `at`
  // against `state_since` — which the sweep wrote with THIS `now`. Let the two
  // diverge and the guard silently stops matching, re-sending a "two days
  // left" email on every hourly tick. Production never noticed because both
  // clocks are the wall clock there; a Stripe test-clock run is where it shows
  // up, which is also the only place anybody would try to prove the guard.
  const record = async (action, outcome, detail = null) => {
    performed.push({ action, outcome });
    await audit(env.DB, { projectId, actor: 'system', action: `do.${action}`, detail }, { now });
  };

  // 1. The guarantee, before anything that could make it impossible.
  if (kinds.has('send-export')) {
    const built = await prepareExportFor(env, projectId, row);
    if (built.ok) {
      await env.DB.prepare('UPDATE projects SET export_sent_at = ? WHERE id = ?')
        .bind(now, projectId)
        .run();
    }
    const told = built.ok
      ? await notifyOwner(env, projectId, row, 'paused', {
          deletesAt: now + SUSPEND_RETENTION_DAYS * 24 * 3600_000,
        })
      : { ok: false, error: 'no export to send' };
    await record('send-export', built.ok && told.ok ? 'ok' : 'failed', built.reason ?? told.error);
  }

  // 2. The last-chance notice. Once — the cron runs hourly and the action
  //    recurs for two days, so the audit log is the idempotence.
  if (kinds.has('warn-deletion')) {
    const warning = actions.find((a) => a.kind === 'warn-deletion');
    const already = await env.DB.prepare(
      `SELECT 1 AS x FROM audit_log
        WHERE project_id = ? AND action = 'do.warn-deletion' AND at >= ?`
    )
      .bind(projectId, Number(row.state_since ?? 0))
      .first()
      .catch(() => null);
    if (!already) {
      const told = await notifyOwner(env, projectId, row, 'warning', {
        deletesAt: warning.deletesAt,
      });
      await record('warn-deletion', told.ok ? 'ok' : 'failed', told.error);
    }
  }

  // 3. Compute. `resume` and `provision` both mean "this address must answer".
  if (kinds.has('resume-cell') || kinds.has('provision-cell')) {
    const routed = await ensureCellDomain(env, projectId);
    await record('resume-cell', routed.ok ? 'ok' : 'failed', routed.error);
  }

  // 4. Teardown, last.
  //
  // Suspension detaches the ADDRESS and stops the container. It deliberately
  // does not touch storage: the customer's prepared copy is served by the
  // control plane straight out of object storage (`/projects/<id>/download`),
  // so "one-click export, always — including while suspended" stays true even
  // though the workspace itself is gone.
  if (kinds.has('suspend-cell')) {
    await stopCell(env, projectId);
    const detached = await removeCellDomain(env, projectId);
    await record('suspend-cell', detached.ok ? 'ok' : 'failed', detached.error);
  }

  // 5. The promised deletion. B4's purge, on the automatic path.
  //
  // ASSERTED, NOT ASSUMED. `reconcile()` decides this from a flag; here we
  // check the artefact. DDR-193 §3 makes `purged` reachable only through a
  // delivered export, and the gap between "the state machine believes one went
  // out" and "one is sitting in storage" is the gap between a guarantee and a
  // comment. A missing generation stops the destruction and says so; the next
  // sweep re-derives, and an operator can see why in the audit log.
  if (kinds.has('purge-data')) {
    const held = await listExportGenerations(env, projectId);
    if (held === null) {
      await record('purge-data', 'failed', 'could not confirm an export — refusing to purge');
    } else if (held === 0) {
      await record('purge-data', 'failed', 'no export in storage — refusing to purge');
    } else {
      const purged = await purgeTenantObjects(env.EXPORTS, projectId);
      await record(
        'purge-data',
        purged.ok ? 'ok' : 'failed',
        purged.reason ?? `${purged.deleted} objects`
      );
      if (purged.ok) await removeCellDomain(env, projectId);
    }
  }

  return performed;
}

/**
 * How many export generations this tenant actually has in storage.
 *
 * `null` means WE COULD NOT TELL (no binding, or the listing failed) — which
 * the caller must treat as "do not destroy anything", not as zero.
 */
async function listExportGenerations(env, projectId) {
  if (!env.EXPORTS) return null;
  try {
    const listed = await env.EXPORTS.list({
      prefix: `tenants/${projectId}/exports/`,
      limit: 1,
    });
    return (listed?.objects ?? []).length;
  } catch (err) {
    console.error(`[reconcile] ${projectId}: export listing failed — ${err.message}`);
    return null;
  }
}

/** Ask a tenant's own cell to build the take-your-work-home copy. */
async function prepareExportFor(env, projectId, row) {
  if (!env.CELL_SECRET_MASTER) return { ok: false, reason: 'no cell secret configured' };
  const owner = await ownerEmail(env, row);
  const { token } = await mintProjectToken({
    master: env.CELL_SECRET_MASTER,
    project: projectId,
    email: owner ?? 'system@maude.sh',
    role: 'owner',
    ttlMs: 10 * 60 * 1000,
  });
  try {
    const res = await fetch(
      `https://${projectId}.${env.CELL_ZONE ?? 'cloud.maude.sh'}/api/export`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(120_000),
      }
    );
    if (!res.ok) return { ok: false, reason: `export HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

async function ownerEmail(env, row) {
  try {
    const found = await env.DB.prepare('SELECT email FROM accounts WHERE id = ?')
      .bind(row.account_id)
      .first();
    return found?.email ?? null;
  } catch {
    return null;
  }
}

/** One of the two lifecycle emails (canvas board E0). */
async function notifyOwner(env, projectId, row, which, { deletesAt }) {
  const to = await ownerEmail(env, row);
  if (!to) return { ok: false, error: 'no owner address' };
  const dashboard = env.DASHBOARD_URL ?? 'https://cloud.maude.sh';
  const body = {
    projectName: row.name || projectId,
    downloadUrl: `${dashboard}/projects/${projectId}/download`,
    deletesAt,
  };
  const message = which === 'paused' ? projectPausedEmail(body) : deletionWarningEmail(body);
  return sendEmail(env, { to, ...message });
}

/**
 * Stop the container so a non-paying tenant is not billed compute.
 *
 * `/_cell/restart` destroys the running container; with the address detached
 * nothing wakes it again. Best-effort: a cell that was already asleep, or a
 * data plane that is briefly unreachable, must not fail the sweep.
 */
async function stopCell(env, projectId) {
  if (!env.CELL_SECRET_MASTER) return;
  try {
    const secret = await deriveCellSecret(env.CELL_SECRET_MASTER, projectId);
    await fetch(`https://${projectId}.${env.CELL_ZONE ?? 'cloud.maude.sh'}/_cell/restart`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.warn(`[reconcile] ${projectId}: could not stop the cell — ${err.message}`);
  }
}

async function fetchSubscription(env, subscriptionId) {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (res.status === 404) return null; // deleted at Stripe — a real answer
  if (!res.ok) throw new Error(`subscription fetch ${res.status}`);
  return res.json();
}
