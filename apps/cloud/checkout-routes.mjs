// Starting a project, the effects — Cloud Phase 14 (DDR-203).
//
// Every decision is imported: what may be a project (checkout.mjs), whether a
// charge is permitted (provisioning.mjs), what the person sees
// (checkout-pages.mjs), what things cost (pricing-core.mjs + the bundled
// catalog). What is left here is Stripe calls, D1 rows, and redirects.
//
// THE ORDERING, END TO END:
//   wizard → Checkout (card collected, trial started, NOTHING charged)
//   → return (subscription recorded, address routed)
//   → waiting room (each visit asks the workspace itself, then lets
//     `decideCheckout` say charge / void / keep waiting).
//
// The waiting room drives settlement rather than a background job, and that
// is deliberate: the person watching IS the poller, the hourly sweep is the
// backstop for the person who closed the tab, and there is no third machine
// to go wrong.

import { STATE_COPY } from './dashboard.mjs';
import { audit } from './db.mjs';
import {
  attemptFromRow,
  checkoutSessionParams,
  validateNewProject,
} from './checkout.mjs';
import { allCheckoutHtml, billingPage, newProjectPage, waitingRoomPage } from './checkout-pages.mjs';
import { priceIdFor, publicPricing, stripeMode } from './pricing-core.mjs';
import pricingCatalog from './pricing.json' with { type: 'json' };
import { ACCESS_MESSAGES, can, decideAccess } from './project-access.mjs';
import { decideCheckout, waitingRoom } from './provisioning.mjs';
import { ensureCellDomain, probeCell } from './provision.mjs';

export { allCheckoutHtml, pricingCatalog };

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
      'referrer-policy': 'no-referrer',
    },
  });
}

function redirect(to) {
  return new Response(null, { status: 303, headers: { location: to } });
}

/** One form-encoded call to Stripe. Returns { ok, status, body }. */
async function stripe(env, method, path, params = null) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(params ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/** The customer object this account bills through, created on first need. */
async function ensureCustomer(env, account) {
  if (account.stripe_customer_id) return account.stripe_customer_id;
  const created = await stripe(env, 'POST', '/v1/customers', {
    email: account.email,
    'metadata[account_id]': account.id,
  });
  if (!created.ok) throw new Error(`customer create failed (${created.status})`);
  await env.DB.prepare('UPDATE accounts SET stripe_customer_id = ? WHERE id = ?')
    .bind(created.body.id, account.id)
    .run();
  return created.body.id;
}

async function latestAttempt(env, projectId) {
  return env.DB.prepare(
    'SELECT * FROM checkout_attempts WHERE project_id = ? ORDER BY created_at DESC LIMIT 1'
  )
    .bind(projectId)
    .first();
}

/**
 * Route the checkout + billing surfaces. Returns a Response or null.
 */
export async function handleCheckoutRoutes(request, env, { account }) {
  const url = new URL(request.url);
  const { pathname } = url;
  const pricing = pricingCatalog;

  // -------------------------------------------------------------- the wizard
  if (pathname === '/projects/new') {
    if (!account) return redirect('/login');
    if (request.method === 'GET') return html(newProjectPage({ account, pricing }));
    if (request.method !== 'POST') return html('<p>Not allowed.</p>', 405);

    const form = await request.formData();
    const values = {
      name: String(form.get('name') ?? ''),
      plan: String(form.get('plan') ?? ''),
      interval: String(form.get('interval') ?? ''),
    };
    const verdict = validateNewProject({ ...values, pricing });
    if (!verdict.ok) return html(newProjectPage({ account, pricing, error: verdict.error, values }), 400);

    const taken = await env.DB.prepare('SELECT id FROM projects WHERE id = ?')
      .bind(verdict.id)
      .first();
    if (taken) {
      return html(
        newProjectPage({
          account,
          pricing,
          error: `“${verdict.id}” is already someone's address here. Pick another name.`,
          values,
        }),
        409
      );
    }

    let priceId;
    try {
      priceId = priceIdFor(verdict.plan, verdict.interval, {
        pricing,
        mode: stripeMode(env),
      });
    } catch (err) {
      console.error(`[checkout] price resolution: ${err.message}`);
      return html(
        newProjectPage({ account, pricing, error: 'That plan cannot be started right now.', values }),
        503
      );
    }

    try {
      const customerId = await ensureCustomer(env, account);
      const session = await stripe(
        env,
        'POST',
        '/v1/checkout/sessions',
        checkoutSessionParams({
          projectId: verdict.id,
          projectName: verdict.name,
          plan: verdict.plan,
          priceId,
          trialDays: pricing.trialDays,
          customerId,
          origin: url.origin,
        })
      );
      if (!session.ok || !session.body?.url) {
        console.error(`[checkout] session create: ${session.status} ${JSON.stringify(session.body?.error ?? {}).slice(0, 300)}`);
        return html(
          newProjectPage({ account, pricing, error: 'Payment could not be started. Nothing was created — try again.', values }),
          502
        );
      }
      return redirect(session.body.url);
    } catch (err) {
      console.error(`[checkout] ${err.message}`);
      return html(
        newProjectPage({ account, pricing, error: 'Payment could not be started. Nothing was created — try again.', values }),
        502
      );
    }
  }

  // ------------------------------------------------- returning from Stripe
  if (request.method === 'GET' && pathname === '/checkout/return') {
    if (!account) return redirect('/login');
    const sessionId = String(url.searchParams.get('session_id') ?? '');
    const projectId = String(url.searchParams.get('project') ?? '');
    if (!/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) return redirect('/');

    const session = await stripe(env, 'GET', `/v1/checkout/sessions/${sessionId}`);
    const s = session.body;
    // Everything about this request is attacker-suppliable except what Stripe
    // says about the session — so what Stripe says is the only thing believed:
    // the session must be complete, must belong to THIS account's customer,
    // and must name the same project the query does.
    if (
      !session.ok ||
      s.status !== 'complete' ||
      !s.subscription ||
      s.metadata?.project_id !== projectId ||
      s.customer !== account.stripe_customer_id
    ) {
      return html(`<p>${ACCESS_MESSAGES['no-access']}</p>`, 404);
    }

    const now = Date.now();
    // The project row is born here — an abandoned checkout never squats the
    // address. INSERT OR IGNORE makes a refreshed return page harmless.
    await env.DB.prepare(
      `INSERT OR IGNORE INTO projects (id, account_id, name, state, state_since, subscription_id, plan, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`
    )
      .bind(projectId, account.id, s.metadata.project_name || projectId, now, String(s.subscription), s.metadata.plan || 'project', now)
      .run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO checkout_attempts (session_id, project_id, payment, subscription_id, authorized_at, created_at)
       VALUES (?, ?, 'authorized', ?, ?, ?)`
    )
      .bind(sessionId, projectId, String(s.subscription), now, now)
      .run();
    await audit(env.DB, {
      accountId: account.id,
      projectId,
      actor: `customer:${account.email}`,
      action: 'checkout.authorized',
      detail: JSON.stringify({ session: sessionId }),
    });

    // Route the address now, so the workspace can start answering while the
    // person watches the waiting room. Failure is not fatal here — the waiting
    // room retries it, and the timeout tells the truth if it never lands.
    await ensureCellDomain(env, projectId);

    return redirect(`/projects/${projectId}/setup`);
  }

  // -------------------------------------------------------- the waiting room
  let m = pathname.match(/^\/projects\/([a-z0-9-]+)\/setup$/);
  if (request.method === 'GET' && m) {
    if (!account) return redirect('/login');
    const projectId = m[1];
    const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?')
      .bind(projectId)
      .first();
    if (!project || project.account_id !== account.id) {
      return html(`<p>${ACCESS_MESSAGES['no-access']}</p>`, 404);
    }

    const attempt = await latestAttempt(env, projectId);
    if (!attempt) {
      // No attempt on record (hand-provisioned projects, e.g. the pilot).
      const room = { step: 'ready', steps: [], done: true, note: 'Your project is ready.' };
      return html(waitingRoomPage({ project, room }));
    }

    // Ask the workspace itself, then let the decision module rule.
    const provision =
      attempt.payment === 'authorized' ? await probeCell(env, projectId, { timeoutMs: 4000 }) : 'pending';
    const row = { ...attempt, provision };
    const decision = decideCheckout(attemptFromRow(row));

    if (decision.outcome === 'charge') {
      // "Charge" here means: the trial is allowed to convert. The subscription
      // already exists and Stripe will invoice at trial end; what settles NOW
      // is our promise — the workspace answered, so the money may follow.
      await env.DB.prepare(
        `UPDATE checkout_attempts SET payment = 'charged', settled_at = ? WHERE session_id = ?`
      )
        .bind(Date.now(), attempt.session_id)
        .run();
      await env.DB.prepare(
        `UPDATE projects SET state = 'active', state_since = ?, cell_running = 1 WHERE id = ?`
      )
        .bind(Date.now(), projectId)
        .run();
      await audit(env.DB, {
        accountId: account.id,
        projectId,
        actor: 'system',
        action: 'checkout.settled',
        detail: 'workspace healthy — subscription kept',
      });
    } else if (decision.outcome === 'void') {
      // The workspace did not come up in time: the subscription is cancelled
      // while it has cost nothing. That IS the void.
      const cancelled = await stripe(env, 'DELETE', `/v1/subscriptions/${attempt.subscription_id}`);
      if (!cancelled.ok && cancelled.status !== 404) {
        console.error(`[checkout] void of ${attempt.subscription_id} failed (${cancelled.status})`);
      }
      await env.DB.prepare(
        `UPDATE checkout_attempts SET payment = 'voided', settled_at = ? WHERE session_id = ?`
      )
        .bind(Date.now(), attempt.session_id)
        .run();
      await env.DB.prepare(
        `UPDATE projects SET state = 'suspended', state_since = ? WHERE id = ?`
      )
        .bind(Date.now(), projectId)
        .run();
      await audit(env.DB, {
        accountId: account.id,
        projectId,
        actor: 'system',
        action: 'checkout.voided',
        detail: decision.reason,
      });
      // But keep retrying the route itself — a missing domain is our fault,
      // not theirs, and a later visit may find the infrastructure repaired.
      await ensureCellDomain(env, projectId);
    }

    // Render from THIS visit's decision. Re-deciding after the settlement
    // writes would land in `already-settled`, which deliberately carries no
    // customer sentence — it is the idempotence branch, not a page.
    if (decision.outcome === 'charge') {
      return html(
        waitingRoomPage({ project, room: { step: 'ready', done: true, note: decision.tellCustomer } })
      );
    }
    if (decision.outcome === 'void') {
      return html(
        waitingRoomPage({ project, room: { step: null, done: true, note: decision.tellCustomer } })
      );
    }
    if (decision.outcome === 'already-settled') {
      const room =
        attempt.payment === 'charged'
          ? { step: 'ready', done: true, note: 'Your project is ready.' }
          : {
              step: null,
              done: true,
              note:
                'This project could not be set up, and nothing was charged. ' +
                'Start again whenever you like.',
            };
      return html(waitingRoomPage({ project, room }));
    }
    return html(waitingRoomPage({ project, room: waitingRoom(attemptFromRow(row)) }));
  }

  // ---------------------------------------------------------------- billing
  m = pathname.match(/^\/projects\/([a-z0-9-]+)\/billing(\/portal)?$/);
  if (m) {
    if (!account) return redirect('/login');
    const projectId = m[1];
    const wantsPortal = Boolean(m[2]);
    const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?')
      .bind(projectId)
      .first();
    const rows = await env.DB.prepare(
      'SELECT account_id, role FROM project_members WHERE project_id = ?'
    )
      .bind(projectId)
      .all();
    const verdict = decideAccess({
      accountId: account.id,
      project,
      members: rows?.results ?? [],
    });
    if (!verdict.ok || !can(verdict.role, 'billing')) {
      return html(`<p>${ACCESS_MESSAGES['no-access']}</p>`, 404);
    }

    if (wantsPortal && request.method === 'POST') {
      const portal = await stripe(env, 'POST', '/v1/billing_portal/sessions', {
        customer: account.stripe_customer_id,
        return_url: `${url.origin}/projects/${projectId}/billing`,
      });
      if (!portal.ok || !portal.body?.url) {
        console.error(`[billing] portal create failed (${portal.status})`);
        return html('<p>Billing could not be opened right now. Try again in a minute.</p>', 502);
      }
      return redirect(portal.body.url);
    }
    if (wantsPortal) return html('<p>Not allowed.</p>', 405);

    const stateCopy = STATE_COPY[project.state] ?? { label: project.state, note: null };
    return html(
      billingPage({
        account,
        project,
        stateCopy,
        canPortal: Boolean(account.stripe_customer_id && project.subscription_id),
      })
    );
  }

  return null;
}

/** For tests: the public pricing shape the wizard renders from. */
export function wizardPricing() {
  return publicPricing({ pricing: pricingCatalog });
}
