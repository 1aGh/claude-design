// Maude Cloud data plane — every request here belongs to exactly one project.
//
// The control plane (apps/cloud) speaks for the platform: billing, identity,
// provisioning. This speaks only for one project at a time, and it is a
// separate Worker so neither deploy can disturb the other (see wrangler.toml
// for the concrete failure that forced the split).
//
// TWO SURFACES, TWO ORIGINS, TWO TRUST LEVELS:
//
//   <project>.cloud.maude.sh       the workspace. Members only. Proxied to the
//                                  project's own container.
//   canvas.cloud.maude.sh/<id>/…   the segregated CANVAS origin (Cloud Phase 25
//                                  A4): the tenant's own built module and the
//                                  runtime it needs, read-only, capability-
//                                  authenticated, and never able to change
//                                  anything. Same container, different origin —
//                                  which is the point (DDR-054).
//
// THE READ-ONLY GALLERY IS GONE (Cloud Phase 25 C5). `view-<project>` served
// published snapshots to anyone with the link; it was deleted because the
// browser door replaced the need for it with something honest — the real
// project, for people who actually have access. A surface that stays
// half-alive is worse than one that never shipped.

import { MaudeCell, routeToCell, tenantFromHostname } from './cell-do.mjs';

export { MaudeCell };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const tenant = tenantFromHostname(url.hostname, env.CELL_ZONE);
    if (!tenant) {
      // A hostname routed here that is not a project is a provisioning
      // mistake, not a user error — say so rather than serving a 404 that
      // reads like the project was deleted.
      return new Response('this hostname is not a Maude project\n', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    try {
      return await routeToCell(request, env, tenant);
    } catch (err) {
      // A project that cannot start is an operational fact the operator needs
      // and the visitor does not. Cloudflare's bare 1101 says only "the Worker
      // threw", which is true of every possible cause — so the reason goes to
      // the log and the visitor gets a sentence that is honest without being a
      // stack trace.
      console.error(`[cells] ${tenant} failed to serve: ${err?.stack || err}`);
      return new Response(
        'This project could not be started. The operator has been given the reason.\n',
        { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }
      );
    }
  },
};
