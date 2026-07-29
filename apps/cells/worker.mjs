// Maude Cloud data plane — every request here belongs to exactly one tenant.
//
// The control plane (apps/cloud) speaks for the platform: billing, identity,
// provisioning. This speaks only for one project at a time, and it is a
// separate Worker so that neither deploy can disturb the other (see
// wrangler.toml for the concrete failure that forced the split).

import { MaudeCell, routeToCell, tenantFromHostname } from './cell-do.mjs';

export { MaudeCell };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const tenant = tenantFromHostname(url.hostname, env.CELL_ZONE);
    if (!tenant) {
      // A hostname routed here that is not a tenant is a provisioning mistake,
      // not a user error — say so rather than serving a confusing 404 that
      // looks like the project was deleted.
      return new Response('this hostname is not a Maude project\n', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    try {
      return await routeToCell(request, env, tenant);
    } catch (err) {
      // A cell that cannot start is an operational fact the operator needs and
      // the visitor does not. Cloudflare's bare 1101 says only "the Worker
      // threw" — which is true of every possible cause — so the reason goes to
      // the log and the visitor gets a sentence that is honest without being
      // a stack trace.
      console.error(`[cells] ${tenant} failed to serve: ${err?.stack || err}`);
      return new Response(
        'This project could not be started. The operator has been given the reason.\n',
        { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }
      );
    }
  },
};
