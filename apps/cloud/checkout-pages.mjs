// Starting a project, as the person sees it — Cloud Phase 14.
//
// Three pages: the wizard, the waiting room, and billing. Server-rendered, no
// script — the waiting room "polls" with a meta refresh, because a page whose
// whole job is to be honest while infrastructure is uncertain should not
// depend on any of it working.

import { PAGE_CSS, lockup } from './brand.mjs';
import { PROVISION_STEPS } from './provisioning.mjs';

const CSS = PAGE_CSS + `
  main { max-width: 34rem; }
  .plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin: var(--space-4) 0 var(--space-2); }
  .plan {
    display: block; cursor: pointer;
    background: var(--bg-1); border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg); padding: var(--space-5);
    transition: border-color var(--dur-soft) var(--ease-out);
  }
  .plan:hover { border-color: var(--border-default); }
  .plan input { accent-color: var(--accent); margin-right: var(--space-2); }
  .plan .price { font-family: var(--font-display); font-size: var(--type-xl); line-height: var(--lh-xl); font-weight: 600; margin: var(--space-2) 0 0; }
  .plan .per { color: var(--fg-2); font-size: var(--type-sm); }
  .interval { display: flex; gap: var(--space-5); margin: var(--space-4) 0; font-size: var(--type-base); }
  .steps { list-style: none; margin: var(--space-6) 0; padding: 0; }
  .steps li { padding: var(--space-3) 0 var(--space-3) var(--space-6); position: relative; color: var(--fg-2); }
  .steps li::before { content: ''; position: absolute; left: var(--space-2); top: 50%; translate: 0 -50%; width: 8px; height: 8px; border-radius: var(--radius-pill); background: var(--bg-4); }
  .steps li.now { color: var(--fg-0); font-weight: 600; }
  .steps li.now::before { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-tint); }
  .steps li.done { color: var(--fg-1); }
  .steps li.done::before { background: var(--status-success); }
  .reassure { border-color: color-mix(in oklab, var(--status-success) 30%, transparent); }
`;

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function page(title, body, { refreshSeconds = null } = {}) {
  const refresh = refreshSeconds ? `<meta http-equiv="refresh" content="${refreshSeconds}">` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${refresh}<title>${esc(title)} — Maude</title><style>${CSS}</style></head><body><main>${lockup()}${body}</main></body></html>`;
}

function euros(minor) {
  if (minor === null || minor === undefined) return null;
  const major = minor / 100;
  return `€${Number.isInteger(major) ? major : major.toFixed(2)}`;
}

/**
 * The wizard. One page: name, plan, billing rhythm. The id the name becomes is
 * decided server-side and shown on the NEXT page rather than live — no script.
 */
export function newProjectPage({ pricing, error = null, values = {} }) {
  const plans = pricing.plans
    .map((p, i) => {
      const monthly = euros(p.amounts.monthlyMinor);
      return `<label class="plan">
        <input type="radio" name="plan" value="${esc(p.id)}" ${((values.plan ?? pricing.plans[0].id) === p.id) ? 'checked' : ''} required>
        <strong>${esc(p.name)}</strong>
        <span class="quiet" style="display:block">${esc(p.summary)}</span>
        <p class="price">${monthly}<span class="per"> / month</span></p>
      </label>`;
    })
    .join('\n');
  return page(
    'Start a project',
    `<h1>Start a project</h1>
     <p class="quiet">One project is one workspace with its own address, its own people,
       and its own design system. The first ${pricing.trialDays} days are free — your card
       is not charged until the trial ends, and you can stop any time before that.</p>
     ${error ? `<p class="error">${esc(error)}</p>` : ''}
     <form method="post" action="/projects/new">
       <label for="name">What is the project called?</label>
       <input type="text" id="name" name="name" required minlength="3" maxlength="60"
              value="${esc(values.name ?? '')}" placeholder="e.g. Brno Alligators">
       <div class="plan-grid">${plans}</div>
       <div class="interval">
         <label><input type="radio" name="interval" value="monthly" ${values.interval !== 'annual' ? 'checked' : ''}> Monthly</label>
         <label><input type="radio" name="interval" value="annual" ${values.interval === 'annual' ? 'checked' : ''}> Annual — two months free</label>
       </div>
       <button type="submit">Continue to payment details</button>
       <p class="quiet" style="margin-top:var(--space-4)">Payment details are handled by Stripe.
         Nothing is charged today.</p>
     </form>`
  );
}

/**
 * The waiting room. Named steps, never a percentage (DDR-203), and the
 * "you have not been charged" answer on the screen itself.
 */
export function waitingRoomPage({ project, room }) {
  const items = (() => {
    const stepIndex = PROVISION_STEPS.findIndex((s) => s.key === room.step);
    return PROVISION_STEPS.map((s, i) => {
      const cls = room.step === null ? '' : i < stepIndex ? 'done' : i === stepIndex ? 'now' : '';
      return `<li class="${cls}">${esc(s.label)}</li>`;
    }).join('\n');
  })();

  if (room.done && room.step === 'ready') {
    return page(
      `${project.name} is ready`,
      `<h1>${esc(project.name)} is ready</h1>
       <p class="quiet">${esc(room.note ?? '')}</p>
       <p><a class="btn" href="/projects/${esc(project.id)}/connect">Open your project</a></p>
       <p class="quiet"><a href="/">Back to your projects</a></p>`
    );
  }
  if (room.done) {
    return page(
      'Something went wrong',
      `<h1>Something went wrong</h1>
       <div class="card"><p style="margin:0">${esc(room.note ?? '')}</p></div>
       <p style="margin-top:var(--space-5)"><a class="btn" href="/projects/new">Try again</a>
         <a href="/" style="margin-left:var(--space-5)">Back to your projects</a></p>`
    );
  }
  return page(
    `Setting up ${project.name}`,
    `<h1>Setting up ${esc(project.name)}</h1>
     <ul class="steps">${items}</ul>
     <div class="card reassure"><p style="margin:0">${esc(room.note ?? '')}</p></div>
     <p class="quiet" style="margin-top:var(--space-5)">This page checks again every few seconds by itself.</p>`,
    { refreshSeconds: 5 }
  );
}

/**
 * Billing, per project. The numbers live at Stripe; this page states the
 * situation and hands over to Stripe's own portal for anything that changes it.
 */
export function billingPage({ project, stateCopy, canPortal }) {
  return page(
    `Billing for ${project.name}`,
    `<h1>Billing for ${esc(project.name)}</h1>
     <p class="crumb" style="margin-bottom:var(--space-6)"><a href="/">← Your projects</a></p>
     <div class="card">
       <h2>${esc(stateCopy.label)}</h2>
       ${stateCopy.note ? `<p class="quiet" style="margin:0">${esc(stateCopy.note)}</p>` : ''}
     </div>
     ${
       canPortal
         ? `<form method="post" action="/projects/${esc(project.id)}/billing/portal" style="margin-top:var(--space-5)">
              <button type="submit">Manage billing at Stripe</button>
            </form>
            <p class="quiet" style="margin-top:var(--space-4)">Cards, invoices, plan changes and
              cancelling all live there — it is your billing relationship, so you hold it directly.</p>`
         : `<p class="quiet" style="margin-top:var(--space-5)">There is no billing set up for this
              project yet.</p>`
     }`
  );
}

/** Every customer-facing string here, for the vocabulary lint. */
export function allCheckoutHtml({ pricing }) {
  const project = { id: 'alligators', name: 'Brno Alligators' };
  return [
    newProjectPage({ pricing }),
    newProjectPage({ pricing, error: 'Pick one of the plans.', values: { name: 'X', interval: 'annual' } }),
    waitingRoomPage({
      project,
      room: { step: 'workspace', steps: PROVISION_STEPS, done: false, note: 'This usually takes a minute or two. Your card has not been charged yet — that happens once your project is up.' },
    }),
    waitingRoomPage({ project, room: { step: 'ready', steps: PROVISION_STEPS, done: true, note: 'Your project is ready.' } }),
    waitingRoomPage({ project, room: { step: null, steps: PROVISION_STEPS, done: true, note: 'We could not set up your project, so you have not been charged.' } }),
    billingPage({ project, stateCopy: { label: 'Ready', note: null }, canPortal: true }),
    billingPage({ project, stateCopy: { label: 'Setting up', note: 'This usually takes a minute or two.' }, canPortal: false }),
  ].join('\n');
}
