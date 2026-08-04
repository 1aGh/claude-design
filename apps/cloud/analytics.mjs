// Product analytics — Cloud Phase 26 Stage 2, the effects layer.
//
// The pages ship no script, so the edge is the ONLY place an event can come
// from. That is a constraint and also the best thing about this design: there
// is nothing in the browser to block, nothing to consent to, and nothing that
// can report on somebody after they leave.
//
// WHY WORKERS ANALYTICS ENGINE AND NOT A D1 TABLE.
//
// `schema.sql`'s header promises "a total loss of this database costs a
// customer nothing", and it earns that by holding only routing and billing
// links. A per-request events table would break it twice over: it would put a
// behavioural record of every customer in the blast radius, and it would put
// an INSERT on the login path, contending with `edge.mjs spend()`'s own writes
// on exactly the request that is already the most expensive one the plane
// answers. AE is Cloudflare, already a named subprocessor, so it needed no DPA
// change — only an honest privacy notice, which shipped in the same change as
// the first `writeDataPoint` (privacy-claims.test.mjs guards that it stays
// honest).
//
// TWO RULES, both of which are tests:
//
//   1. `track` NEVER fails a request. A validation failure, an absent binding,
//      a throwing `writeDataPoint` — all are swallowed and logged. Analytics
//      that can take the product down is worse than no analytics.
//   2. `track` NEVER blocks a request. The write goes into `ctx.waitUntil`, so
//      the response is already on its way.

import { EVENTS, toDataPoint, validateEvent } from './events.mjs';

/**
 * Record one thing that happened.
 *
 * @param {object} env  needs `EVENTS` (the AE binding). Absent ⇒ silent no-op,
 *   which is what makes every existing test suite work unchanged and what
 *   keeps `wrangler dev` usable without a dataset.
 * @param {{waitUntil?: Function}|null} ctx
 * @param {object} event  see events.mjs — closed vocabulary, enum properties
 */
export function track(env, ctx, event) {
  const verdict = validateEvent(event);
  if (!verdict.ok) {
    // Logged loudly, because a rejected event is a bug at the call site, not a
    // condition to handle. It is still not an error the caller sees.
    console.warn(`[analytics] refused an event: ${verdict.error}`);
    return false;
  }
  const sink = env?.EVENTS;
  if (!sink?.writeDataPoint) return false;

  const write = (async () => {
    try {
      sink.writeDataPoint(toDataPoint(event));
    } catch (err) {
      console.error(`[analytics] ${event.name} was not recorded: ${err.message}`);
    }
  })();

  if (ctx?.waitUntil) ctx.waitUntil(write);
  return true;
}

// ---------------------------------------------------------------- reading

// EVERY interpolant in the SQL below is a MODULE-LEVEL LITERAL — a dataset
// name, an event name from the closed vocabulary, a column list derived from
// it. No request data reaches these templates, and none may: this is the one
// place in the phase where a "filter by the id in the URL" would turn into
// injection against a query run with an account-scoped API token. Bind it, or
// map it through the vocabulary first.

/** Where the operator board's queries run. */
const SQL_ENDPOINT = (accountId) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;

/** The dataset both halves name. Must match wrangler.toml's `dataset`. */
export const DATASET = 'maude_cloud_events';

/**
 * Run one SQL query against the events dataset.
 *
 * A SEPARATE credential from everything else the plane holds, and deliberately
 * an optional one: `CF_ANALYTICS_TOKEN` is scoped to Account Analytics Read
 * and nothing more. Unset is a normal state — the board renders "not
 * connected" rather than an error, because a tile with no data must not be
 * able to take down the page an operator opens during an outage.
 *
 * Returns `{ ok: false, reason }` rather than throwing, for the same reason.
 */
export async function queryEvents(env, sql, { fetchImpl = fetch } = {}) {
  if (!env?.CF_ANALYTICS_TOKEN || !env?.CF_ACCOUNT_ID) {
    return { ok: false, reason: 'not-connected' };
  }
  try {
    const res = await fetchImpl(SQL_ENDPOINT(env.CF_ACCOUNT_ID), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
        'content-type': 'text/plain',
      },
      body: sql,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const body = await res.json();
    return { ok: true, rows: body?.data ?? [] };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/**
 * Did AE sample this window?
 *
 * At this volume it will not, but a count read off a sampled window is an
 * ESTIMATE, and the board renders estimates with a leading `~`. A number that
 * silently changes meaning at scale is worse than one that says which it is.
 */
export function isSampled(rows) {
  return (rows ?? []).some((r) => Number(r._sample_interval ?? r.sampleInterval ?? 1) > 1);
}

const num = (v) => (v === null || v === undefined ? null : Number(v));

/**
 * Every figure the board shows, in as few round trips as the shapes allow.
 *
 * Distinct-account counts, event counts by name, and the two funnel numbers.
 * `null` for anything that could not be read — never 0, which would read as
 * "nobody used it today".
 */
export async function boardMetrics(env, { fetchImpl = fetch } = {}) {
  const active = await queryEvents(
    env,
    `SELECT
       COUNT(DISTINCT blob1) AS mau,
       COUNT(DISTINCT IF(timestamp > NOW() - INTERVAL '7' DAY, blob1, NULL)) AS wau,
       COUNT(DISTINCT IF(timestamp > NOW() - INTERVAL '1' DAY, blob1, NULL)) AS dau
     FROM ${DATASET}
     WHERE timestamp > NOW() - INTERVAL '30' DAY AND blob1 != ''`,
    { fetchImpl }
  );
  if (!active.ok) return { ok: false, reason: active.reason };

  // CONCURRENT. Neither depends on the other, and each carries its own 8 s
  // timeout — run in series, the page whose entire justification is "opens
  // during an outage" would sit through them one at a time. Neither can
  // reject; `queryEvents` returns its failures.
  const [byName, funnel] = await Promise.all([
    queryEvents(
      env,
      `SELECT index1 AS name, SUM(_sample_interval) AS count
       FROM ${DATASET}
      WHERE timestamp > NOW() - INTERVAL '7' DAY
      GROUP BY name ORDER BY count DESC LIMIT 40`,
      { fetchImpl }
    ),
    queryEvents(
      env,
      `SELECT index1 AS name, SUM(_sample_interval) AS count
       FROM ${DATASET}
      WHERE timestamp > NOW() - INTERVAL '30' DAY
        AND index1 IN ('signup', 'checkout_completed')
      GROUP BY name`,
      { fetchImpl }
    ),
  ]);

  const row = active.rows[0] ?? {};
  const counts = new Map((funnel.rows ?? []).map((r) => [r.name, num(r.count)]));

  return {
    ok: true,
    sampled: isSampled(active.rows) || isSampled(byName.rows ?? []),
    dau: num(row.dau),
    wau: num(row.wau),
    mau: num(row.mau),
    signups: counts.get('signup') ?? null,
    checkouts: counts.get('checkout_completed') ?? null,
    byName: (byName.rows ?? []).map((r) => ({ name: r.name, count: num(r.count) })),
  };
}

/**
 * The most recent `tenant_stats` / `tenant_render` / `tenant_wake` per project.
 *
 * `argMax` over the timestamp rather than a window function: one row per
 * project, latest wins, and a project that never reported is simply ABSENT
 * from the map — which is how `—` reaches the page instead of `0`.
 */
export async function tenantMetrics(env, { fetchImpl = fetch } = {}) {
  // The keys AND their order come from events.mjs, never from a second copy.
  // `double1` is POSITIONAL: a list that drifts from the one `toDataPoint`
  // writes would relabel every figure on this board — silently, with nothing
  // failing.
  const sources = [
    { key: 'stats', event: 'tenant_stats' },
    { key: 'render', event: 'tenant_render' },
  ];

  const out = { stats: null, render: null, coldStartP95Ms: null };
  for (const { key: outKey, event: name } of sources) {
    const keys = EVENTS[name].doubles;
    const columns = keys
      .map((k, i) => `argMax(double${i + 1}, timestamp) AS ${k}`)
      .join(',\n            ');
    const res = await queryEvents(
      env,
      `SELECT blob2 AS project,
            ${columns}
       FROM ${DATASET}
      WHERE index1 = '${name}' AND timestamp > NOW() - INTERVAL '2' DAY AND blob2 != ''
      GROUP BY project`,
      { fetchImpl }
    );
    if (!res.ok) continue;
    const map = new Map();
    for (const r of res.rows) {
      map.set(r.project, Object.fromEntries(keys.map((k) => [k, num(r[k])])));
    }
    out[outKey] = map;
  }

  // Cold start: the one figure worth having even if nothing else lands, and
  // the one that needs a PRE-sandbox baseline to be a regression signal later.
  const wake = await queryEvents(
    env,
    `SELECT quantileWeighted(0.95)(double1, _sample_interval) AS p95
       FROM ${DATASET}
      WHERE index1 = 'tenant_wake' AND timestamp > NOW() - INTERVAL '7' DAY`,
    { fetchImpl }
  );
  if (wake.ok) out.coldStartP95Ms = num(wake.rows[0]?.p95);

  return out;
}

/** Sum the per-project content stats for the overview tile. `null` stays null. */
export function totalContent(stats) {
  if (!stats || stats.size === 0) return null;
  const total = { canvases: null, artboards: null, designSystems: null, assetsBytes: null };
  for (const row of stats.values()) {
    for (const key of Object.keys(total)) {
      const v = row?.[key];
      if (v === null || v === undefined) continue;
      // Only a project that actually reported contributes. A sum over
      // partially-unknown inputs is still a real lower bound; a sum that
      // treated unknown as 0 would be an invented one.
      total[key] = (total[key] ?? 0) + v;
    }
  }
  return total;
}
