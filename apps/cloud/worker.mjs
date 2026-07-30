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
import { mintInstallationToken } from './github-app.mjs';
import { handleHandoff } from './handoff.mjs';
import { handleInviteRoutes } from './invites.mjs';
import { applySchema } from './migrate.mjs';
import { ACCESS_MESSAGES, decideAccess } from './project-access.mjs';
import { handleProjectAdminRoutes } from './project-admin.mjs';
import { handleProjectRoutes } from './project-routes.mjs';
import { settle } from './reconcile.mjs';
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

/**
 * Refuse a state-changing request that a browser tells us came from another
 * SITE (validate 2026-07-30, defender F1).
 *
 * `SameSite=Lax` is same-SITE, not same-ORIGIN, and every workspace lives at
 * `<project>.cloud.maude.sh` — the same registrable domain as the dashboard.
 * A workspace page therefore ships the session cookie on a cross-origin POST
 * here, and workspace pages render customer-authored canvas content, which
 * DDR-054 designates untrusted. Fetch-Metadata closes it: browsers always
 * stamp `Sec-Fetch-Site`, and non-browser clients (the desktop app, the CLI,
 * curl, tests) never do — so a MISSING header is allowed and only an explicit
 * cross-site/same-site claim is refused. `same-site` is refused too: that is
 * precisely the sibling-subdomain case.
 *
 * The `/internal/*` and webhook lanes are exempt — they authenticate with a
 * derived secret or a signature, never with a cookie, so a browser's opinion
 * about them is irrelevant.
 */
function crossSiteStateChange(request, url) {
  if (request.method === 'GET' || request.method === 'HEAD') return false;
  if (url.pathname.startsWith('/internal/') || url.pathname.startsWith('/webhooks/')) return false;
  const site = request.headers.get('sec-fetch-site');
  if (!site) return false; // non-browser client
  return site !== 'same-origin' && site !== 'none';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (crossSiteStateChange(request, url)) {
      return json({ error: 'That request did not come from Maude Cloud.' }, 403);
    }

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
    const detail = actions.length ? JSON.stringify(actions) : null;
    if (jobId) await finishJob(env.DB, jobId, 'ok', detail, { now });
    if (actions.length) {
      await audit(env.DB, {
        projectId,
        actor: 'system',
        action: 'reconcile',
        detail,
      });
    }
    return { projectId, outcome: 'ok', actions };
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

async function fetchSubscription(env, subscriptionId) {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (res.status === 404) return null; // deleted at Stripe — a real answer
  if (!res.ok) throw new Error(`subscription fetch ${res.status}`);
  return res.json();
}
