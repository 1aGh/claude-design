// `/_api/sync/resync` + `/_api/sync/cancel-assets` — the MAIN-origin half.
//
// `canvas-origin-gate.test.ts` already asserts both routes are unreachable from
// the segregated canvas origin. That alone proves the wrong property: the main
// origin is reachable from any website the user happens to visit while the dev
// server is up. A cross-site POST that lands here would re-authenticate every
// document against the person's own hub and re-run a whole-project upload — an
// amplification primitive against their own DDR-102 rate-limit budget, with an
// opaque response and a very real side effect.
//
// So this file asserts the complementary half — the same posture the Figma
// routes carry (DDR-216 D3): cross-origin write → 403, foreign Host → 403,
// wrong method → 405. Both halves are required; neither is sufficient.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Subprocess } from 'bun';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

const HTTP = readFileSync(join(import.meta.dir, '..', 'http.ts'), 'utf8');

let proc: Subprocess;
let base: string;

const ROUTES = ['/_api/sync/resync', '/_api/sync/cancel-assets'];

beforeAll(async () => {
  const { root } = makeSandbox();
  const port = nextPort();
  base = `http://localhost:${port}`;
  proc = await bootServer(root, port);
});

afterAll(async () => {
  await killProc(proc);
});

describe('cross-origin writes are refused (the CSRF guard)', () => {
  for (const route of ROUTES) {
    test(`POST ${route} from another origin is 403`, async () => {
      const res = await fetch(`${base}${route}`, {
        method: 'POST',
        headers: { Origin: 'https://evil.example' },
      });
      expect(res.status).toBe(403);
    });

    test(`a CORS-simple POST to ${route} is still refused`, async () => {
      // No preflight, unreadable response — but the side effect would land.
      const res = await fetch(`${base}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', Origin: 'https://evil.example' },
        body: '{}',
      });
      expect(res.status).toBe(403);
    });
  }
});

describe('a foreign Host header is refused (the DNS-rebinding guard)', () => {
  for (const route of ROUTES) {
    test(`POST ${route} with a rebinding Host is 403`, async () => {
      const res = await fetch(`${base}${route}`, {
        method: 'POST',
        headers: { Host: 'sync.127.0.0.1.nip.io' },
      });
      expect(res.status).toBe(403);
    });
  }
});

describe('method gating', () => {
  for (const route of ROUTES) {
    test(`GET ${route} is 405 — resync is a write`, async () => {
      expect((await fetch(`${base}${route}`)).status).toBe(405);
    });
  }
});

// Source-level, because these two properties only show up on a LINKED project
// with a live hub — a state a booted sandbox cannot reach — and they are
// exactly the two that would be silently wrong.
describe('the route is wired to the whole-sync restart, and refuses rather than queues', () => {
  test('restart() is called with NO argument — this route can never unlink', () => {
    // `restart(null)` is the DETACH lane: it clears the in-memory link and
    // cycles to solo. A resync that passed a falsy value through would
    // disconnect the person's project instead of re-checking it.
    expect(HTTP).toContain('const sync = await control.restart();');
    expect(HTTP).not.toMatch(/sync\/resync[\s\S]{0,900}restart\(null\)/);
  });

  test('a cycle in flight is a 409, not a second full re-link', () => {
    expect(HTTP).toMatch(/control\.busy\?\.\(\)/);
    expect(HTTP).toMatch(/status: 409[\s\S]{0,120}'busy'/);
  });

  test('cancel reaches the sweep through the live runtime, not the supervisor', () => {
    expect(HTTP).toContain('ctx.syncControl?.current?.()?.cancelAssetSweep() ?? false');
  });
});

describe('same-origin behaviour on an unlinked project', () => {
  test('resync answers honestly rather than pretending it synced', async () => {
    // The sandbox project has no linkedHub, so the supervisor is present but
    // declines. The panel hides the control in this state; the ROUTE still has
    // to give a truthful answer to anything that reaches it.
    const res = await fetch(`${base}/_api/sync/resync`, { method: 'POST' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      sync?: { syncing: boolean; reason?: string };
    };
    expect(json.ok).toBe(true);
    expect(json.sync?.syncing).toBe(false);
    expect(json.sync?.reason).toBe('unlinked');
  });

  test('cancelling with no sweep in flight says so instead of erroring', async () => {
    const res = await fetch(`${base}/_api/sync/cancel-assets`, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, cancelled: false });
  });
});
