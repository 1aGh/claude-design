// The browser door — Cloud Phase 27 A2, under DDR-209.
//
// WHAT THIS FILE USED TO BE. `canvas/routes.mjs` served a studio: it rendered a
// page, listed canvases, built modules, wrote comments and applied edits — 469
// lines of studio-page plus five supporting modules, against a real client of
// 15,073. The owner opened his own project in a browser and found a different,
// poorer application than the one on his desktop.
//
// WHAT IT IS NOW. A door. It decides three things and forwards everything else
// to the real studio running on loopback:
//
//   1. is rendering paused for this tenant (the on-call kill switch, A3);
//   2. is this request for the SHELL origin or the CANVAS origin (DDR-054);
//   3. is there a session — and if not, where does this person sign in.
//
// It renders exactly two things, both of which are pages a studio cannot serve
// because the studio is not the thing that is wrong: "paused" and "signing in".

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { designRootFor } from './design-root.mjs';

/**
 * THE KILL SWITCH (Phase 25 A3).
 *
 * Per-tenant, not fleet-wide: an incident in one project must not take
 * everybody's door off its hinges, and a switch that costs everyone is a
 * switch nobody dares use. Two ways to throw it, because the two hands that
 * reach for it are different:
 *
 *   MAUDE_RENDER_DISABLED=1        the cell's own env (operator, needs a restart)
 *   <repo>/../.render-off          a file in the tenant's volume (on-call, instant)
 *
 * Reading a file per request is deliberate: during an incident the person
 * needs it to take effect NOW, not after a container restart they then have to
 * wait out.
 */
export function renderDisabled(env = process.env) {
  if (env.MAUDE_RENDER_DISABLED === '1') return 'operator';
  const repoDir = env.MAUDE_REPO_DIR;
  if (repoDir && existsSync(join(repoDir, '..', '.render-off'))) return 'on-call';
  if (repoDir && existsSync(join(repoDir, '.render-off'))) return 'on-call';
  return null;
}

/** The origin the canvas iframe loads from. */
export function canvasOriginFor(request, env = process.env) {
  const explicit = env.MAUDE_CANVAS_ORIGIN ?? env.MAUDE_PUBLIC_CANVAS_ORIGIN;
  if (explicit) return { origin: explicit.replace(/\/+$/, ''), separate: true, prefix: '' };
  const host = request?.headers?.host ?? '';
  const zone = env.CELL_ZONE;
  const tenant = env.MAUDE_TENANT_ID;
  if (zone && tenant && host.endsWith(`.${zone}`)) {
    // ONE shared canvas hostname for the whole fleet, tenant in the path. A
    // per-tenant canvas hostname would be a second custom domain to provision,
    // delete and reconcile for every project — more moving parts for the same
    // origin boundary.
    return { origin: `https://canvas.${zone}`, separate: true, prefix: `/${tenant}` };
  }
  return { origin: '', separate: false, prefix: '' };
}

/** True when a request arrived on the segregated canvas hostname. */
export function isCanvasHost(request, env = process.env) {
  const host = (request?.headers?.host ?? '').toLowerCase();
  const zone = env.CELL_ZONE;
  if (zone && host === `canvas.${zone}`) return true;
  const explicit = env.MAUDE_PUBLIC_CANVAS_ORIGIN ?? env.MAUDE_CANVAS_ORIGIN;
  if (!explicit) return false;
  try {
    return host === new URL(explicit).host.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Paths the HUB answers itself. Everything else on the shell origin belongs to
 * the studio.
 *
 * An ALLOWLIST of hub-owned prefixes rather than a list of studio paths, and
 * that direction is deliberate: the studio's route table grows every phase and
 * the hub's does not. Getting it the other way round would mean every new studio
 * feature is invisible in the cloud until someone remembers this file — which is
 * a fair description of how Phase 25 ended up with a hand-written page.
 */
export const HUB_OWNED = Object.freeze([
  '/health',
  '/admin',
  '/auth/',
  '/join',
  '/invites',
  '/assets/',
  '/api/export',
  '/.well-known/',
]);

export function isHubOwned(pathname) {
  return HUB_OWNED.some((p) =>
    p.endsWith('/')
      ? pathname.startsWith(p)
      : pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`)
  );
}

/**
 * Decide what happens to one shell-origin request, short of forwarding it.
 *
 * Returns `null` when the caller should proxy. Kept separate from the doing so
 * the ordering — pause, then project-presence, then session — is one readable
 * thing rather than four early returns inside an HTTP handler.
 */
export function doorVerdict({ request, pathname, env = process.env, session }) {
  const off = renderDisabled(env);
  if (off) return { kind: 'paused', by: off };

  const designRoot = designRootFor(env);
  if (!designRoot || !existsSync(designRoot)) return { kind: 'no-project' };

  if (!session) return { kind: 'sign-in', to: signInUrl({ request, env, pathname }) };
  return null;
}

/**
 * Where an unauthenticated browser goes to sign in.
 *
 * The address the CUSTOMER is at — never the Host header. Behind the outbound
 * tunnel the Host is the tunnel's internal hostname, and a Host-derived return
 * URL sent a member to an address that was not their project's. Twice, in
 * production. `HUB_PUBLIC_URL` is what the control plane sets to the
 * customer-facing name; the header is only a fallback for a hub that has none.
 */
export function signInUrl({ request, env = process.env }) {
  const dashboard = env.HUB_DASHBOARD_URL ?? 'https://cloud.maude.sh';
  const tenant = env.MAUDE_TENANT_ID;
  const publicBase = (env.HUB_PUBLIC_URL ?? '').replace(/\/+$/, '');
  const back = `${publicBase || `https://${request?.headers?.host ?? ''}`}/auth/browser`;
  // Platform: the Maude account, at the control plane. Self-hosted (E2): this
  // hub's own users, at its own sign-in — one door each, one studio.
  return tenant
    ? `${dashboard}/projects/${encodeURIComponent(tenant)}/browser?return=${encodeURIComponent(back)}`
    : '/studio/signin';
}

export const PAUSED_MESSAGE =
  'Rendering is paused for this project while we look into something. ' +
  'Your work is safe and nothing has been changed. Maude Desktop still opens it normally.';

/** A plain page for the states that are not the studio. */
export function servicePage(title, message, { action = null } = {}) {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/admin/style.css">
</head>
<body class="service-page"><main><h1>${esc(title)}</h1><p>${esc(message)}</p>${
    action ? `<a class="button" href="${esc(action.href)}">${esc(action.label)}</a>` : ''
  }</main></body></html>`;
}
