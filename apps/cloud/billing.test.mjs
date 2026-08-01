// The billing decisions — Cloud Phase 24 A10 + A11 + D2.
//
// Pure module, so these are pure tests: what Stripe said in, what the page
// shows out. The date arithmetic behind a deletion countdown belongs here
// rather than in a route test, because it is the one number in the product
// whose being wrong is a broken promise rather than a bug.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cancelSchedule,
  currentVatId,
  customerParams,
  formatDay,
  invoiceRows,
  money,
  pauseClock,
  RETENTION_DAYS,
  subscriptionView,
  validateBillingDetails,
} from './billing.mjs';
import { SUSPEND_RETENTION_DAYS } from './reconcile.mjs';

const DAY = 24 * 3600_000;

// ------------------------------------------------------------------ retention

test('the retention number is the one already published, not a shorter new one', () => {
  // Phase 24 A11 proposed 7 days. The Trust page publishes 30 and the
  // reconciler enforces 30 — shortening a published retention promise is the
  // exact breach A11 warns about, so the ladder adopts what is promised.
  assert.equal(RETENTION_DAYS, SUSPEND_RETENTION_DAYS);
  assert.equal(RETENTION_DAYS, 30);
});

// ------------------------------------------------------------------- invoices

test('invoice rows drop drafts and anything with no PDF', () => {
  const rows = invoiceRows([
    { id: 'in_1', status: 'paid', created: 100, total: 2900, currency: 'eur', invoice_pdf: 'a' },
    { id: 'in_2', status: 'draft', created: 200, total: 2900, currency: 'eur', invoice_pdf: 'b' },
    { id: 'in_3', status: 'paid', created: 300, total: 2900, currency: 'eur' },
    null,
  ]);
  assert.deepEqual(
    rows.map((r) => r.id),
    ['in_1']
  );
});

test('invoice rows are newest first and name what an unpaid one is', () => {
  const rows = invoiceRows([
    { id: 'old', status: 'paid', created: 100, total: 2900, currency: 'eur', invoice_pdf: 'a' },
    { id: 'new', status: 'open', created: 900, total: 7900, currency: 'eur', invoice_pdf: 'b' },
  ]);
  assert.deepEqual(
    rows.map((r) => r.id),
    ['new', 'old']
  );
  assert.equal(rows[0].unpaid, true);
  assert.equal(rows[1].unpaid, false);
  assert.equal(rows[0].amount, '€79.00');
});

test('an unknown currency still reads as money rather than a bare number', () => {
  assert.equal(money(150000, 'sek'), '1500.00 SEK');
  assert.equal(money(2900, 'eur'), '€29.00');
});

test('a line description is used when Stripe gives one, and never left blank', () => {
  const [withLine] = invoiceRows([
    {
      id: 'a',
      status: 'paid',
      created: 1,
      total: 1,
      currency: 'eur',
      invoice_pdf: 'p',
      lines: { data: [{ description: 'Cloud Project — monthly' }] },
    },
  ]);
  const [without] = invoiceRows([
    { id: 'b', status: 'paid', created: 1, total: 1, currency: 'eur', invoice_pdf: 'p' },
  ]);
  assert.equal(withLine.description, 'Cloud Project — monthly');
  assert.equal(without.description, 'Subscription');
});

// ------------------------------------------------------------ billing details

test('nothing filled in is valid — billing details are optional until they are not', () => {
  const v = validateBillingDetails({});
  assert.equal(v.ok, true);
  assert.equal(v.errors.length, 0);
});

test('a partial address with no country is refused — Stripe Tax cannot place it', () => {
  const v = validateBillingDetails({ company: 'Brno Alligators z.s.', city: 'Brno' });
  assert.equal(v.ok, false);
  assert.match(v.errors.join(' '), /Country is needed/);
});

test('a VAT id is normalized before anybody sees it', () => {
  const v = validateBillingDetails({ country: 'cz', vatId: ' cz 265-478.91 ' });
  assert.equal(v.ok, true);
  assert.equal(v.details.vatId, 'CZ26547891');
  assert.equal(v.details.country, 'CZ');
});

test('a VAT id from another country is refused rather than silently sent', () => {
  const v = validateBillingDetails({ country: 'DE', vatId: 'CZ26547891' });
  assert.equal(v.ok, false);
  assert.match(v.errors.join(' '), /do not match/);
});

test('something that is not a VAT id at all is refused with a readable sentence', () => {
  const v = validateBillingDetails({ country: 'CZ', vatId: '26547891' });
  assert.equal(v.ok, false);
  assert.match(v.errors.join(' '), /two letters/);
});

test('a cleared field is SENT as empty, not omitted — otherwise it comes straight back', () => {
  const params = customerParams(validateBillingDetails({ country: 'CZ' }).details);
  assert.equal(params.name, '');
  assert.equal(params['address[line1]'], '');
  assert.ok('address[city]' in params);
});

test('currentVatId picks the one Stripe holds, or nothing', () => {
  assert.equal(currentVatId([]), null);
  assert.deepEqual(currentVatId([{ id: 'txi_1', value: 'CZ1' }]), { id: 'txi_1', value: 'CZ1' });
});

// ---------------------------------------------------------- the cancel ladder

test('the schedule states works-until, pauses-on and deleted-on', () => {
  const now = Date.UTC(2026, 6, 31);
  const periodEndMs = Date.UTC(2026, 7, 28);
  const s = cancelSchedule({ periodEndMs, now });
  assert.equal(s.worksUntil, periodEndMs);
  assert.equal(s.pausesOn, periodEndMs);
  assert.equal(s.deletedOn, periodEndMs + 30 * DAY);
  assert.equal(formatDay(s.worksUntil), '28 August 2026');
  assert.equal(formatDay(s.deletedOn), '27 September 2026');
});

test('a project with no paid period left pauses NOW rather than "until —"', () => {
  const now = Date.UTC(2026, 6, 31);
  const s = cancelSchedule({ periodEndMs: null, now });
  assert.equal(s.worksUntil, now);
  assert.equal(s.deletedOn, now + 30 * DAY);
  assert.equal(s.daysLeft, 30);
});

test('a period end already in the past does not produce a countdown to yesterday', () => {
  const now = Date.UTC(2026, 6, 31);
  const s = cancelSchedule({ periodEndMs: Date.UTC(2026, 0, 1), now });
  assert.equal(s.worksUntil, now);
  assert.ok(s.daysLeft > 0);
});

test('the pause clock runs from the same instant the reconciler measures', () => {
  const pausedOn = Date.UTC(2026, 7, 28);
  const clock = pauseClock({
    state: 'suspended',
    stateSince: pausedOn,
    now: pausedOn + 25 * DAY,
  });
  assert.equal(formatDay(clock.deletedOn), '27 September 2026');
  assert.equal(clock.daysLeft, 5);
});

test('a project that is not paused shows no countdown at all', () => {
  assert.equal(pauseClock({ state: 'active', stateSince: 1 }), null);
  assert.equal(pauseClock({ state: 'suspended', stateSince: null }), null);
});

test('an overdue pause clock reads zero rather than a negative countdown', () => {
  const pausedOn = Date.UTC(2026, 0, 1);
  const clock = pauseClock({ state: 'suspended', stateSince: pausedOn, now: Date.UTC(2026, 6, 1) });
  assert.equal(clock.daysLeft, 0);
});

test('subscriptionView surfaces cancelled-but-still-running, which the page could not show', () => {
  assert.deepEqual(subscriptionView(null), {
    exists: false,
    cancelling: false,
    periodEndMs: null,
  });
  const v = subscriptionView({
    status: 'active',
    cancel_at_period_end: true,
    current_period_end: 1788000000,
  });
  assert.equal(v.cancelling, true);
  assert.equal(v.periodEndMs, 1788000000 * 1000);
});
