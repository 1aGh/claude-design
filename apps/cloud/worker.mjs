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
import { mintInstallationToken } from './github-app.mjs';
import { ACCESS_MESSAGES, decideAccess } from './project-access.mjs';
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
import { applySchema } from './migrate.mjs';
import { settle } from './reconcile.mjs';
import { SCHEMA_SQL } from './schema.mjs';
import { projectRefFromEvent, verifyStripeSignature } from './stripe-webhook.mjs';

export const WORKER_VERSION = 'phase-13';

/**
 * Derive a cell's own secret. Must match apps/cells/cell-do.mjs exactly — a
 * cell authenticates here with the value that file gave it.
 */
async function deriveCellSecret(master, tenantId) {
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
    new TextEncoder().encode(`maude-cell:hub-secret:${tenantId}`)
  );
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** base64url over raw bytes. Never over a string — see the UTF-8 note below. */
function b64urlBytes(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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

  const account = await currentAccount(request, env);
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

  const secret = await deriveCellSecret(env.CELL_SECRET_MASTER ?? '', projectId);
  const now = Date.now();
  const claims = {
    email: account.email,
    project: projectId,
    role: verdict.role,
    iat: now,
    exp: now + 12 * 60 * 60 * 1000,
  };
  // UTF-8 FIRST. `btoa` throws on any character above U+00FF, so a name with
  // a Czech "ě" or a Polish "ł" — exactly the input nobody tests with — would
  // make sign-in fail for that person and nobody else. Encoding to bytes and
  // base64-ing those is the fix; sanitising the name would be mangling
  // somebody's name to work around our own encoding bug.
  const payload = b64urlBytes(new TextEncoder().encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sig = b64urlBytes(new Uint8Array(mac));

  return json({
    token: `${payload}.${sig}`,
    role: verdict.role,
    url: `https://${projectId}.${env.CELL_ZONE ?? 'cloud.maude.sh'}`,
    expiresAt: claims.exp,
  });
}

/** Constant-time compare — a timing oracle on a per-cell credential still counts. */
function secretsMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
    return json({ error: 'that repository is not this project\'s mirror' }, 403);
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

    // Identity surface (pages, signup/login, Google, grant mint) — Phase 13.
    const auth = await handleAuth(request, env);
    if (auth) return auth;

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
