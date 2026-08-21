// maude-render data-plane Worker — DDR-230.
//
// One shared render service for the whole fleet, NOT one per tenant: the
// container holds no tenant state (DDR-230 §1 — no store, no secrets), a job
// is single-tenant by construction (its canvas grant reaches one project),
// and an idle per-tenant Chromium would multiply the fleet's standing cost
// for nothing. Tenancy isolation lives in the JOB (the token), not in the
// instance.
//
// AUTH IS IN THE CONTAINER, deliberately. The Worker forwards `/render` and
// `/_health` verbatim; server.ts checks the bearer with a timing-safe compare
// and refuses when unset. Doing it here too would mean the secret living in
// two runtimes — one more place to rotate, no additional door closed.
//
// SCALE NOTE: `idFromName('render-v1')` pins a single container instance —
// one Chromium, one render at a time (+ a short in-process queue). That is
// the pilot posture on purpose (the cells' wrangler.toml cost arithmetic
// applies here too). Sharding by job id across N named instances is the
// follow-up lever when render queueing shows up in /_health metrics.

import { Container } from '@cloudflare/containers';

const RENDER_PORT = 8790;

export class MaudeRender extends Container {
  defaultPort = RENDER_PORT;

  // Renders are bursty; an idle Chromium is pure cost. Shorter than a cell's
  // 20m because there is no rehydrate penalty on cold start — the container
  // holds nothing to rehydrate.
  sleepAfter = '10m';

  constructor(ctx, env) {
    super(ctx, env);
    // Per DDR-230 §1 this is the COMPLETE environment: the ingress bearer, the
    // canvas-origin allowlist, and the release stamp. A secret beyond these
    // must not appear — server.ts boot-asserts the known ones and refuses.
    //
    // ENV IS READ ONCE, HERE. A Durable Object caches its `env` at construction;
    // a MAUDE_RENDER_SECRET set (or rotated) AFTER this DO was first constructed
    // does NOT reach the container until the DO is reconstructed — which only a
    // byte-different Worker deploy (a new script version) forces, never a bare
    // `wrangler secret put` or a container rollout. The operator flow is
    // therefore: set the secret, then redeploy this Worker. The startup log
    // below records which half is missing so "configured:false" is diagnosable
    // from the tail rather than guessed at (the env-hash-drift class the fleet
    // runbook flags as an open follow-up).
    const hasSecret = Boolean(env.MAUDE_RENDER_SECRET);
    const hasOrigins = Boolean(env.MAUDE_RENDER_CANVAS_ORIGINS);
    console.log(
      `[maude-render DO] constructed — secret:${hasSecret ? 'set' : 'MISSING'} origins:${hasOrigins ? 'set' : 'MISSING'}`
    );
    this.envVars = {
      MAUDE_RENDER_SECRET: env.MAUDE_RENDER_SECRET ?? '',
      MAUDE_RENDER_CANVAS_ORIGINS: env.MAUDE_RENDER_CANVAS_ORIGINS ?? '',
      MAUDE_RENDER_VERSION: env.MAUDE_RENDER_VERSION ?? 'unstamped',
      PORT: String(RENDER_PORT),
    };
  }

  async fetch(request) {
    return this.containerFetch(request);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isHealth = url.pathname === '/_health' && request.method === 'GET';
    const isRender = url.pathname === '/render' && request.method === 'POST';
    if (!isHealth && !isRender) {
      // The same posture the cells take: an unrouted path looks like the
      // feature never existed.
      return new Response('not found', { status: 404 });
    }
    const id = env.MAUDE_RENDER.idFromName('render-v1');
    return env.MAUDE_RENDER.get(id).fetch(request);
  },
};
