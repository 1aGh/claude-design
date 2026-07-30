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
