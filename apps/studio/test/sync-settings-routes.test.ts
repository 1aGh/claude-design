// `/_api/sync/settings` + `/_api/sync/ownership` — the MAIN-origin half
// (feature-before-first-external-users Task 2).
//
// `canvas-origin-gate.test.ts` asserts both are unreachable from the canvas
// origin; this file asserts the complementary posture on the main origin
// (same shape as sync-resync-routes.test.ts): cross-origin write → 403,
// foreign Host → 403 on BOTH methods (these routes also serve GET, so the
// rebinding guard has to cover the read too — the settings read names the
// project's hub), plus honest same-origin answers on an unlinked sandbox.
// The linked-project write paths are covered at module level in
// sync-settings.test.ts — a sandbox with a fake linkedHub would spend the
// whole suite trying to reach a hub that does not exist.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Subprocess } from 'bun';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

const HTTP = readFileSync(join(import.meta.dir, '..', 'http.ts'), 'utf8');

let proc: Subprocess;
let base: string;

const ROUTES = ['/_api/sync/settings', '/_api/sync/ownership', '/_api/sync/trash'];

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
      const res = await fetch(`${base}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', Origin: 'https://evil.example' },
        body: '{"syncFiles":false}',
      });
      expect(res.status).toBe(403);
    });
  }
});

describe('a foreign Host header is refused on BOTH methods (DNS rebinding)', () => {
  for (const route of ROUTES) {
    for (const method of ['GET', 'POST'] as const) {
      test(`${method} ${route} with a rebinding Host is 403`, async () => {
        const res = await fetch(`${base}${route}`, {
          method,
          headers: { Host: 'sync.127.0.0.1.nip.io' },
        });
        expect(res.status).toBe(403);
      });
    }
  }
});

describe('same-origin behaviour on an unlinked sandbox', () => {
  test('settings GET answers null — the panel must not render dead controls', async () => {
    const res = await fetch(`${base}/_api/sync/settings`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ settings: null });
  });

  test('settings POST refuses honestly when nothing is linked', async () => {
    const res = await fetch(`${base}/_api/sync/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncFiles: false }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; detail?: string };
    expect(json.ok).toBe(false);
    expect(json.detail).toContain('no linked hub');
  });

  test('settings POST with an empty patch is a 400, not a silent no-op', async () => {
    const res = await fetch(`${base}/_api/sync/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(400);
  });

  test('settings POST validates value types before touching disk', async () => {
    const res = await fetch(`${base}/_api/sync/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propagateDeletes: 'yes please' }),
    });
    expect(res.status).toBe(400);
  });

  test('ownership GET reports a mode and the linked state', async () => {
    const res = await fetch(`${base}/_api/sync/ownership`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { mode: string; linked: boolean; git: boolean };
    expect(['repo-owned', 'hub-owned', 'hybrid']).toContain(json.mode);
    expect(json.linked).toBe(false);
  });

  test('ownership adopt refuses when nothing is linked (no owner would remain)', async () => {
    const res = await fetch(`${base}/_api/sync/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'adopt' }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; detail?: string };
    expect(json.ok).toBe(false);
    expect(json.detail).toContain('Link a workspace first');
  });

  test('ownership rejects an unknown action', async () => {
    const res = await fetch(`${base}/_api/sync/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'yeet' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('trash on an empty sandbox', () => {
  test('GET lists honestly empty', async () => {
    const res = await fetch(`${base}/_api/sync/trash`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [], total: 0, bytes: 0 });
  });

  test('restore of a non-_trash path is refused', async () => {
    const res = await fetch(`${base}/_api/sync/trash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', trashRel: 'ui/Hero.tsx' }),
    });
    expect(res.status).toBe(400);
  });

  test('a 0-day prune is refused — "empty the trash" needs its own gesture', async () => {
    const res = await fetch(`${base}/_api/sync/trash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prune', olderThanDays: 0 }),
    });
    expect(res.status).toBe(400);
  });

  test('prune with a sane window reports counts', async () => {
    const res = await fetch(`${base}/_api/sync/trash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prune' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, pruned: 0, bytes: 0, kept: 0 });
  });
});

// Source pins — properties that need a linked project + live hub to observe.
describe('source pins', () => {
  test('a settings write hot-reloads config AND asks for a restart only when free', () => {
    const block =
      /sync\/settings[\s\S]{0,3000}reloadConfig\(ctx\)[\s\S]{0,600}control\.busy\?\.\(\)/;
    expect(block.test(HTTP)).toBe(true);
  });

  test('ownership detach goes through the SAME unlink lane as Cloud detach', () => {
    // Two unlink implementations would drift on credential handling — the
    // route must reuse cloudApi.detach(), which drops the stored credential
    // and cycles the runtime to solo NOW.
    expect(HTTP).toMatch(/sync\/ownership[\s\S]{0,4000}await cloudApi\.detach\(\)/);
  });

  test('ownership refuses to edit a .gitignore it did not write', () => {
    expect(HTTP).toMatch(/refused-malformed/);
  });
});
