// Pricing resolution — Cloud Phase 8 groundwork.
//
// `pricing.json` is the single source; this is the only thing allowed to read
// it FROM DISK. The pure logic lives in pricing-core.mjs (Phase 14 split, so
// the Worker — which bundles the JSON and must never import `node:fs` — can
// share it); this wrapper keeps the file-reading defaults for the CLI and
// tests. Two rules it exists to enforce, both of which are the kind of mistake
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

import * as core from './pricing-core.mjs';

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
  return core.stripeMode(env);
}

export function priceIdFor(
  planId,
  interval,
  { pricing = loadPricing(), mode = stripeMode() } = {}
) {
  return core.priceIdFor(planId, interval, { pricing, mode });
}

export function publicPricing({ pricing = loadPricing() } = {}) {
  return core.publicPricing({ pricing });
}

export async function assertAmountsMatchStripe(
  fetchPrice,
  { pricing = loadPricing(), mode = stripeMode() } = {}
) {
  return core.assertAmountsMatchStripe(fetchPrice, { pricing, mode });
}
