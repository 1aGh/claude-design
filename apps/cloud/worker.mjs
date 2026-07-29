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

import { handleAuth } from './auth-routes.mjs';
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
import { projectRefFromEvent, verifyStripeSignature } from './stripe-webhook.mjs';

export const WORKER_VERSION = 'phase-13';

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
      await applySchema(env.DB);
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
