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
//   view-<project>.cloud.maude.sh  the read-only share view. Reachable by
//                                  anyone holding the link — so it never
//                                  touches the container at all, and serves
//                                  only inert bytes straight from storage.
//
// The share view NOT reaching the cell is the strongest form of the
// containment claim (DDR-193 §2, narrowed by DDR-197): the surface anyone can
// reach has no path to the surface that holds the project's data.

import { MaudeCell, routeToCell, tenantFromHostname } from './cell-do.mjs';
import { htmlResponse, renderGallery, renderNotShared } from './share-pages.mjs';
import {
  buildGallery,
  SHARE_HEADERS,
  snapshotContentType,
  snapshotObjectKey,
  snapshotPrefix,
  viewTenantFromHostname,
} from './share.mjs';

export { MaudeCell };

/**
 * Is this project shared, and under what name?
 *
 * OFF UNLESS SAID OTHERWISE. The absence of the marker object means not
 * shared — so a storage read that fails, a bucket that is unreachable, or a
 * project nobody has configured all land on "not shared". Every failure mode
 * defaults closed.
 */
async function shareSettings(bucket, tenant) {
  try {
    const obj = await bucket.get(`tenants/${tenant}/share.json`);
    if (!obj) return null;
    const parsed = JSON.parse(await obj.text());
    return parsed?.enabled === true ? { name: String(parsed.name ?? tenant).slice(0, 80) } : null;
  } catch {
    return null;
  }
}

async function serveShareView(request, env, tenant) {
  const url = new URL(request.url);
  const bucket = env.SNAPSHOTS;
  if (!bucket) return htmlResponse(renderNotShared(), 404);

  const settings = await shareSettings(bucket, tenant);
  // Identical response whether sharing is off or the project does not exist.
  // Distinguishing them would turn this into a directory of every customer.
  if (!settings) return htmlResponse(renderNotShared(), 404);

  if (url.pathname === '/' || url.pathname === '') {
    const listed = await bucket.list({ prefix: snapshotPrefix(tenant), limit: 500 });
    const gallery = buildGallery(
      listed.objects.map((o) => ({
        key: o.key,
        size: o.size,
        lastModified: o.uploaded?.toISOString?.() ?? null,
      })),
      tenant,
      Date.now()
    );
    return htmlResponse(renderGallery(gallery, settings.name));
  }

  if (url.pathname.startsWith('/s/')) {
    const name = decodeURIComponent(url.pathname.slice(3));
    const key = snapshotObjectKey(tenant, name);
    // A key this refuses is a key that is not a snapshot. The refusal happens
    // before any storage call, so a hostile path never becomes a lookup.
    if (!key) return new Response('not found\n', { status: 404, headers: SHARE_HEADERS });
    const obj = await bucket.get(key);
    if (!obj) return new Response('not found\n', { status: 404, headers: SHARE_HEADERS });
    return new Response(obj.body, {
      headers: {
        ...SHARE_HEADERS,
        'content-type': snapshotContentType(name),
        'content-disposition': 'inline',
        // Snapshots are republished under the same name when a design changes,
        // so they are NOT immutable. Revalidate rather than serve a stale
        // picture of a design that has since moved on.
        'cache-control': 'no-cache',
      },
    });
  }

  return htmlResponse(renderNotShared(), 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Share view first: `view-<project>` is a longer, more specific label than
    // `<project>`, so it must be tested before the workspace match or a shared
    // project would be routed to a container named `view-<project>`.
    const viewing = viewTenantFromHostname(url.hostname, env.CELL_ZONE);
    if (viewing) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('this view is read-only\n', { status: 405, headers: SHARE_HEADERS });
      }
      return serveShareView(request, env, viewing);
    }

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
