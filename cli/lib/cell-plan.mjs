// `maude cell` — the pure planning layer. Cloud Phase 5 Task 2.
//
// Naming, addressing, isolation boundaries, and the teardown sweep, as
// functions of their inputs. No Cloudflare API calls; `cli/commands/cell.mjs`
// makes those.
//
// Why this is worth separating (same argument as workspace-plan.mjs, and it
// matters more here): the failure modes of a multi-tenant provisioner are
// almost entirely NAMING and SCOPE mistakes — a tenant id that escapes its R2
// prefix, a hostname that collides with another tenant's, a destroy that
// misses one resource and leaves an orphan billing forever. All of those are
// decisions, and decisions can be tested exhaustively without a paid account.

/**
 * A tenant id is not cosmetic. It becomes:
 *   • the R2 key prefix `tenants/<id>/`,
 *   • the subdomain `<id>.cloud.maude.sh`,
 *   • the Durable Object name,
 *   • the container instance name.
 *
 * So it has to satisfy the intersection of DNS labels, R2 keys, and Cloudflare
 * resource names, and it must be impossible to construct one that reads as
 * another tenant's namespace.
 */
const TENANT_ID_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

/**
 * Reserved for the platform itself. `api.cloud.maude.sh` belonging to a tenant
 * who signed up early would be a phishing surface handed out for free.
 */
const RESERVED_IDS = new Set([
  'api',
  'www',
  'admin',
  'app',
  'dashboard',
  'status',
  'docs',
  'help',
  'support',
  'billing',
  'account',
  'accounts',
  'login',
  'signin',
  'signup',
  'auth',
  'cdn',
  'assets',
  'static',
  'mail',
  'smtp',
  'ns',
  'ns1',
  'ns2',
  'internal',
  'system',
  'maude',
  'cloud',
  'test',
  'staging',
  'prod',
  'production',
]);

export function validateTenantId(raw) {
  const id = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!id) return { ok: false, error: 'a project id is required' };
  if (id.length > 63) return { ok: false, error: 'project id must be at most 63 characters' };
  if (!TENANT_ID_RE.test(id)) {
    return {
      ok: false,
      error:
        'project id must be lowercase letters, digits and inner hyphens ' +
        '(it becomes a hostname, an R2 key prefix and a Durable Object name)',
    };
  }
  if (RESERVED_IDS.has(id)) {
    // Handing out `api.cloud.maude.sh` to whoever signs up first is a phishing
    // surface given away for free.
    return { ok: false, error: `"${id}" is reserved for the platform` };
  }
  if (id.startsWith('xn--')) {
    return { ok: false, error: 'punycode-style ids are not allowed (homograph risk)' };
  }
  return { ok: true, id };
}

export const DEFAULT_ZONE = 'cloud.maude.sh';

/**
 * Every name a cell occupies, derived from one id so they cannot drift apart.
 * Drift is how a destroy misses a resource.
 */
export function cellNames(id, { zone = DEFAULT_ZONE } = {}) {
  const check = validateTenantId(id);
  if (!check.ok) throw new Error(`invalid project id: ${check.error}`);
  const tenant = check.id;
  return {
    tenant,
    hostname: `${tenant}.${zone}`,
    /** Trailing slash included: it is what makes prefix matching exact. */
    r2Prefix: `tenants/${tenant}/`,
    durableObject: `cell-${tenant}`,
    container: `maude-cell-${tenant}`,
    /** Per-cell scoped token name — never the account master key (DDR-164). */
    r2TokenName: `maude-cell-${tenant}-r2`,
  };
}

/**
 * True when `key` belongs to `tenant`'s prefix.
 *
 * Exists as its own function because "starts with the prefix" is subtly wrong
 * without the trailing slash: `tenants/acme` would match `tenants/acme-evil/…`.
 * That single character is the entire isolation boundary between two
 * customers' data.
 */
export function keyBelongsToTenant(key, tenant) {
  const names = cellNames(tenant);
  return typeof key === 'string' && key.startsWith(names.r2Prefix);
}

/**
 * The resources a cell owns, in the order `destroy` must remove them.
 *
 * Order is deliberate: stop routing FIRST, then compute, then credentials,
 * then data. Deleting data while the hostname still resolves gives a live
 * endpoint serving a half-deleted project; revoking the token before stopping
 * the container gives a running cell erroring in a loop.
 *
 * `retainable` marks what a SUSPEND keeps. Suspension stops a cell; it does not
 * delete state (DDR-193 §3) — the 30-day retention and export-before-teardown
 * guarantee live here.
 */
export function cellResources(id, { zone = DEFAULT_ZONE } = {}) {
  const n = cellNames(id, { zone });
  return [
    {
      kind: 'dns',
      name: n.hostname,
      why: 'stop routing first — otherwise a half-deleted project stays reachable',
      retainable: false,
    },
    {
      kind: 'worker-route',
      name: `${n.hostname}/*`,
      why: 'the ingress route that maps the hostname to this cell’s Durable Object',
      retainable: false,
    },
    {
      kind: 'container',
      name: n.container,
      why: 'the running cell',
      retainable: false,
    },
    {
      kind: 'durable-object',
      name: n.durableObject,
      why: 'lifecycle + hibernation state for this project',
      retainable: false,
    },
    {
      kind: 'r2-token',
      name: n.r2TokenName,
      why: 'the per-cell scoped credential; revoked after compute is gone, never before',
      retainable: false,
    },
    {
      kind: 'r2-prefix',
      name: n.r2Prefix,
      why: 'the tenant’s data — retained through suspension, deleted only after export',
      retainable: true,
    },
  ];
}

/**
 * What `destroy` must verify is gone. A destroy that leaves an orphan bills
 * forever and is invisible until the invoice, so the sweep is part of the
 * operation rather than a separate cleanup task somebody remembers to run.
 */
export function destroySweep(id, { zone = DEFAULT_ZONE, purgeData = false } = {}) {
  return cellResources(id, { zone }).filter((r) => purgeData || !r.retainable);
}

/**
 * The tenant lifecycle from DDR-193 §3, as a machine.
 *
 * Encoded rather than implied because the ONE transition that must never exist
 * is `* → purged` without passing through `exported`: there is no path from
 * "stopped paying" to "your designs are gone" that skips "you were handed your
 * files".
 */
const TRANSITIONS = {
  pending: ['active', 'purged'],
  active: ['past_due', 'suspended'],
  past_due: ['active', 'suspended'],
  suspended: ['active', 'exported'],
  exported: ['active', 'purged'],
  purged: [],
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from, to) {
  if (!TRANSITIONS[from]) throw new Error(`unknown state "${from}"`);
  if (!TRANSITIONS[to]) throw new Error(`unknown state "${to}"`);
  if (!canTransition(from, to)) {
    const extra =
      to === 'purged' && from !== 'exported'
        ? ' — a tenant must be EXPORTED before purge (DDR-193 §3): there is no path from ' +
          '"stopped paying" to "your designs are gone" that skips "you were handed your files"'
        : '';
    throw new Error(`illegal transition ${from} → ${to}${extra}`);
  }
  return to;
}

export function lifecycleStates() {
  return Object.keys(TRANSITIONS);
}

/**
 * The next state on the shortest LEGAL path from `from` to `to`, or null when
 * no path exists.
 *
 * Needed because a desired state is often not reachable in one hop and that is
 * perfectly ordinary rather than an error: a `pending` tenant whose payment is
 * already failing did subscribe, so the truthful route is
 * `pending → active → past_due`, and a `suspended` tenant who resubscribes with
 * a failing card goes `suspended → active → past_due`.
 *
 * Walking the path beats jumping to the destination, because every hop stays
 * inside the machine — including the one hop the machine exists to forbid.
 * `exported` is the only door to `purged` no matter how the search runs.
 */
export function stepToward(from, to) {
  if (from === to) return null;
  if (!TRANSITIONS[from] || !TRANSITIONS[to]) return null;
  const queue = [[from, null]];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const [state, firstHop] = queue.shift();
    for (const next of TRANSITIONS[state]) {
      if (seen.has(next)) continue;
      const hop = firstHop ?? next;
      if (next === to) return hop;
      seen.add(next);
      queue.push([next, hop]);
    }
  }
  return null;
}

/**
 * Render the container + ingress config for one cell.
 *
 * Kept as data (not a template string) so a test can assert a specific field
 * without matching a whole file, and so the control plane in Phase 7 can build
 * the same object without re-parsing TOML.
 */
export function cellConfig(
  id,
  { zone = DEFAULT_ZONE, memoryMib = 2048, imageTag = 'latest' } = {}
) {
  const n = cellNames(id, { zone });
  if (!Number.isInteger(memoryMib) || memoryMib < 512 || memoryMib > 4096) {
    // Containers GA caps at 4 GiB; below 512 MiB the hub cannot hold a
    // reasonable working set. Both bounds are refusals, not clamps — silently
    // giving someone less memory than they asked for is a support ticket
    // nobody can diagnose.
    throw new Error('memoryMib must be an integer between 512 and 4096');
  }
  return {
    name: n.container,
    image: `ghcr.io/1agh/maude-cell:${imageTag}`,
    instanceType: { memoryMib, vcpu: 0.5 },
    // Scale to zero: an idle cell should cost approximately nothing under
    // Active-CPU pricing, which is the whole economic premise (DDR-193 §1).
    lifecycle: { scaleToZero: true, wakeOn: ['http', 'websocket'], idleTimeoutSeconds: 300 },
    durableObject: n.durableObject,
    route: `${n.hostname}/*`,
    env: {
      MAUDE_TENANT_ID: n.tenant,
      HUB_PUBLIC_URL: `https://${n.hostname}`,
      HUB_WORKSPACE_MODE: '1',
      MAUDE_WORKSPACE_MODE: '1',
      // Caddy is gone — TLS terminates at the Cloudflare edge, and the Worker
      // is the only thing that can reach the container.
      HUB_TRUSTED_PROXIES: '10.0.0.0/8,172.16.0.0/12,fd00::/8',
    },
    // Secrets are NAMED here, never valued: this object is logged, diffed and
    // stored by the control plane.
    secrets: ['HUB_SECRET', 'MAUDE_S3_ACCESS_KEY_ID', 'MAUDE_S3_SECRET_ACCESS_KEY'],
    r2: { prefix: n.r2Prefix, tokenName: n.r2TokenName },
  };
}
