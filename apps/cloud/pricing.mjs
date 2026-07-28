// Pricing resolution — Cloud Phase 8 groundwork.
//
// `pricing.json` is the single source; this is the only thing allowed to read
// it. Two rules it exists to enforce, both of which are the kind of mistake
// that is invisible until it involves a real card:
//
//   1. LIVE MODE REFUSES A MISSING ID. A placeholder that silently falls back
//      to the sandbox price is how a real customer gets charged nothing — or
//      how a test charge lands on a real card. There is no fallback. Live mode
//      with an unfilled id throws, by name.
//   2. AMOUNTS ARE NOT AUTHORITATIVE — Stripe is. `amounts` in the JSON is for
//      rendering a pricing page, and a price object in Stripe is IMMUTABLE, so
//      the two can drift the moment someone edits the file instead of creating
//      a new price. `assertAmountsMatchStripe` is how a caller checks; nothing
//      here quietly trusts the local number for a charge.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

let cached = null;

export function loadPricing(path = join(HERE, 'pricing.json')) {
  if (!cached || cached.path !== path) {
    cached = { path, data: JSON.parse(readFileSync(path, 'utf8')) };
  }
  return cached.data;
}

/** 'live' when STRIPE_SECRET_KEY is a live key, else 'sandbox'. */
export function stripeMode(env = process.env) {
  const key = env.STRIPE_SECRET_KEY ?? '';
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) return 'live';
  return 'sandbox';
}

/**
 * Resolve the Stripe price id for a plan + billing interval.
 *
 * @throws when the plan/interval is unknown, or when the id for THIS mode is
 *         not configured. The throw is the feature — see rule 1 above.
 */
export function priceIdFor(
  planId,
  interval,
  { pricing = loadPricing(), mode = stripeMode() } = {}
) {
  const plan =
    pricing.plans.find((p) => p.id === planId) ?? pricing.addons.find((a) => a.id === planId);
  if (!plan) {
    const known = [...pricing.plans, ...pricing.addons].map((p) => p.id).join(', ');
    throw new Error(`unknown plan "${planId}" (known: ${known})`);
  }
  const forMode = plan.stripe[mode];
  if (!forMode) throw new Error(`unknown Stripe mode "${mode}"`);
  const id = forMode[interval];
  if (!id) {
    throw new Error(
      `no ${mode} price configured for ${planId}/${interval}. ` +
        (mode === 'live'
          ? 'Create the price in Stripe live mode and fill it into apps/cloud/pricing.json. ' +
            'There is deliberately no fallback to the sandbox id — a silent fallback is how a ' +
            'real customer gets charged nothing, or a test charge lands on a real card.'
          : 'Create it in the sandbox and record the id.')
    );
  }
  return id;
}

/**
 * Everything a pricing PAGE needs, with no Stripe ids in it.
 *
 * Ids are credentials-adjacent routing detail; a public page has no use for
 * them, and a shape that carries them is one an accidental `JSON.stringify`
 * can leak into HTML.
 */
export function publicPricing({ pricing = loadPricing() } = {}) {
  const money = (minor) =>
    minor === null || minor === undefined ? null : { minor, major: minor / 100 };
  return {
    currency: pricing.currency,
    trialDays: pricing.trialDays,
    selfHost: { price: 0, note: 'Free forever.' },
    plans: pricing.plans.map((p) => ({
      id: p.id,
      name: p.name,
      summary: p.summary,
      includedStorageGb: p.includedStorageGb,
      monthly: money(p.amounts.monthlyMinor),
      annual: money(p.amounts.annualMinor),
    })),
    addons: pricing.addons.map((a) => ({
      id: a.id,
      name: a.name,
      summary: a.summary,
      blockGb: a.blockGb,
      monthly: money(a.amounts.monthlyMinor),
    })),
  };
}

/**
 * Compare the local `amounts` against what Stripe actually says.
 *
 * Stripe prices are immutable, so editing a number in the JSON does NOT change
 * what a customer is charged — it only makes the pricing page lie. Returns a
 * list of mismatches (empty = consistent) rather than throwing, so a caller can
 * report all of them at once.
 *
 * @param {(priceId: string) => Promise<{ unit_amount: number, currency: string }>} fetchPrice
 */
export async function assertAmountsMatchStripe(
  fetchPrice,
  { pricing = loadPricing(), mode = stripeMode() } = {}
) {
  const mismatches = [];
  const check = async (id, label, expectedMinor) => {
    if (!id || expectedMinor === null || expectedMinor === undefined) return;
    let price;
    try {
      price = await fetchPrice(id);
    } catch (err) {
      mismatches.push({ label, id, problem: `could not be read from Stripe: ${err.message}` });
      return;
    }
    if (price.unit_amount !== expectedMinor) {
      mismatches.push({
        label,
        id,
        problem: `Stripe charges ${price.unit_amount}, pricing.json advertises ${expectedMinor}`,
      });
    }
    if (price.currency && price.currency !== pricing.currency) {
      mismatches.push({
        label,
        id,
        problem: `Stripe currency is ${price.currency}, pricing.json says ${pricing.currency}`,
      });
    }
  };

  for (const p of pricing.plans) {
    await check(p.stripe[mode]?.monthly, `${p.id}/monthly`, p.amounts.monthlyMinor);
    await check(p.stripe[mode]?.annual, `${p.id}/annual`, p.amounts.annualMinor);
  }
  for (const a of pricing.addons) {
    await check(a.stripe[mode]?.monthly, `${a.id}/monthly`, a.amounts.monthlyMinor);
  }
  return mismatches;
}
