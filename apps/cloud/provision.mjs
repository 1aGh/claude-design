// Making a project answer at its address — Cloud Phase 14, the effects half.
//
// A tenant "exists" when two things are true: `<id>.cloud.maude.sh` is a
// Worker custom domain routed at the data-plane Worker (the only mechanism
// that gives a third-level name both a route and a certificate — see
// apps/cells/wrangler.toml), and the cell behind it answers /health. This
// module owns both: creating the route, and asking the honest question.
//
// The Cloudflare token this uses (CF_PROVISION_TOKEN) can edit Workers
// domains on the account. It lives in the control plane next to the platform
// master secret and the GitHub App key — the control plane is already the
// blast radius (DDR-193); a cell never sees it.

/** The ONE shared hostname the segregated canvas origin lives on (Phase 25 A4). */
export const CANVAS_HOST_LABEL = 'canvas';

/**
 * Ensure `canvas.cloud.maude.sh` routes to the cells Worker (Cloud Phase 25 A4).
 *
 * The canvas origin is where a tenant's own built module is EVALUATED, by the
 * viewer's browser, deliberately not sharing an origin with the editing shell
 * (DDR-054). One hostname for the whole fleet with the tenant in the path —
 * a per-tenant canvas domain would be a second custom domain to provision,
 * delete and reconcile for every project, for the same origin boundary.
 *
 * Called from the hourly sweep rather than from a deploy step, and idempotent,
 * so the address self-heals: an operator never has to remember it, and a
 * hostname deleted by accident comes back within the hour. `canvas` is not a
 * valid tenant id shape... except that it IS — so the reconcile that would
 * hand it to a project is what a name collision would look like, and the
 * signup path must never allocate it.
 */
export async function ensureCanvasDomain(env, { fetchImpl = fetch } = {}) {
  if (!env.CF_PROVISION_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_ZONE_ID) {
    return { ok: false, error: 'provisioning is not configured' };
  }
  const hostname = `${CANVAS_HOST_LABEL}.${env.CELL_ZONE ?? 'cloud.maude.sh'}`;
  try {
    const res = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/domains`,
      {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${env.CF_PROVISION_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          zone_id: env.CF_ZONE_ID,
          hostname,
          service: 'maude-cells',
          environment: 'production',
        }),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) {
      return { ok: false, hostname, error: body?.errors?.[0]?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, hostname };
  } catch (err) {
    return { ok: false, hostname, error: err.message };
  }
}

/**
 * Ensure `<projectId>.cloud.maude.sh` routes to the cells Worker.
 * Idempotent: an already-attached hostname reports ok.
 */
export async function ensureCellDomain(env, projectId, { fetchImpl = fetch } = {}) {
  if (!env.CF_PROVISION_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_ZONE_ID) {
    return { ok: false, error: 'provisioning is not configured' };
  }
  const hostname = `${projectId}.${env.CELL_ZONE ?? 'cloud.maude.sh'}`;
  try {
    const res = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/domains`,
      {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${env.CF_PROVISION_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          zone_id: env.CF_ZONE_ID,
          hostname,
          service: 'maude-cells',
          environment: 'production',
        }),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) {
      const detail = body?.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
      console.error(`[provision] ${hostname}: ${detail}`);
      return { ok: false, error: detail };
    }
    return { ok: true, hostname };
  } catch (err) {
    console.error(`[provision] ${hostname}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * Detach `<projectId>.cloud.maude.sh` — the delete flow's last step.
 * Best-effort and idempotent: an already-absent hostname reports ok.
 */
export async function removeCellDomain(env, projectId, { fetchImpl = fetch } = {}) {
  if (!env.CF_PROVISION_TOKEN || !env.CF_ACCOUNT_ID) return { ok: false, error: 'not configured' };
  const hostname = `${projectId}.${env.CELL_ZONE ?? 'cloud.maude.sh'}`;
  const base = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/domains`;
  const headers = { authorization: `Bearer ${env.CF_PROVISION_TOKEN}` };
  try {
    const listed = await fetchImpl(`${base}?hostname=${encodeURIComponent(hostname)}`, { headers });
    const body = await listed.json().catch(() => ({}));
    const found = (body?.result ?? []).find((d) => d.hostname === hostname);
    if (!found) return { ok: true, hostname, removed: false };
    const res = await fetchImpl(`${base}/${found.id}`, { method: 'DELETE', headers });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, hostname, removed: true };
  } catch (err) {
    console.error(`[provision] detach ${hostname}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * Is the workspace actually up? One question, asked of the thing itself.
 *
 * Returns 'healthy' | 'pending'. Never 'failed' from a single probe: a cold
 * start looks exactly like an outage from here, and `decideCheckout` already
 * owns the only honest deadline (the timeout). A hard "failed" belongs to a
 * signal that cannot be a cold start, and no such signal exists at this layer.
 */
export async function probeCell(env, projectId, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const hostname = `${projectId}.${env.CELL_ZONE ?? 'cloud.maude.sh'}`;
  try {
    const res = await fetchImpl(`https://${hostname}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return 'pending';
    const body = await res.json().catch(() => null);
    return body?.ok === true || body?.status === 'ok' ? 'healthy' : 'pending';
  } catch {
    return 'pending';
  }
}
