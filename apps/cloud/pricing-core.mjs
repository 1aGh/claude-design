// Pricing resolution, the pure half — Cloud Phase 8 / Phase 14.
//
// Split from pricing.mjs so the WORKER can use it: the control plane bundles
// `pricing.json` as a module and passes it in, while pricing.mjs keeps the
// node-side file-reading wrapper for the CLI and tests. Every function here
// REQUIRES the pricing object — there is deliberately no default that touches
// a filesystem, because this file must never import `node:fs`.
//
// The two rules enforced here are unchanged (see pricing.mjs for their story):
//   1. live mode refuses a missing id — no fallback to sandbox, ever;
//   2. `amounts` are for rendering; Stripe is authoritative for charging.

/** 'live' when STRIPE_SECRET_KEY is a live key, else 'sandbox'. */
export function stripeMode(env = {}) {
  const key = env.STRIPE_SECRET_KEY ?? '';
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) return 'live';
  return 'sandbox';
}

/**
 * Resolve the Stripe price id for a plan + billing interval.
 *
 * @throws when the plan/interval is unknown, or when the id for THIS mode is
 *         not configured. The throw is the feature.
 */
export function priceIdFor(planId, interval, { pricing, mode }) {
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
 */
export function publicPricing({ pricing }) {
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
 * @param {(priceId: string) => Promise<{ unit_amount: number, currency: string }>} fetchPrice
 */
export async function assertAmountsMatchStripe(fetchPrice, { pricing, mode }) {
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
