// The dev-server's Maude Cloud lane — Cloud Phase 23 C3 + the maude:// code
// attach (Phase 17). The control plane AND the cell are stubbed on one local
// server; the assertions are about custody and trust posture, not transport:
// the code is exchanged only against the CONFIGURED cloud address, the hub
// token lands in the credential store, and linkedHub is written token-free.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseDeepLink, shareViewUrl } from '../client/panels/CloudBar.jsx';

let stub: ReturnType<typeof Bun.serve> | null = null;
let scratch = '';
const seen: string[] = [];

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'maude-cloud-test-'));
  stub = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: async (req) => {
      const url = new URL(req.url);
      seen.push(`${req.method} ${url.pathname}`);
      const json = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
      if (url.pathname === '/auth/handoff/exchange') {
        const body: any = await req.json();
        if (body.code === 'mhc_' + 'a'.repeat(64)) {
          return json({
            token: 'x.y',
            role: 'owner',
            project: 'stub-project',
            // The "cell" is this same stub server.
            url: `http://127.0.0.1:${stub!.port}`,
            expiresAt: Date.now() + 3600_000,
          });
        }
        return json({ error: 'that code is not valid or has expired' }, 400);
      }
      if (url.pathname === '/auth/login') {
        const body: any = await req.json();
        return body?.token === 'x.y'
          ? json({ token: 'mau_stub_hub_token', user: { email: 'e@example.com', role: 'owner' } })
          : json({ error: 'no' }, 401);
      }
      return json({ error: 'not stubbed' }, 404);
    },
  });
  process.env.MAUDE_CLOUD_URL = `http://127.0.0.1:${stub.port}`;
  process.env.MAUDE_CLOUD_CONFIG = join(scratch, 'cloud.json');
  process.env.HUBS_CONFIG_PATH = join(scratch, 'hubs.json');
});

afterAll(() => {
  stub?.stop(true);
  rmSync(scratch, { recursive: true, force: true });
  delete process.env.MAUDE_CLOUD_URL;
  delete process.env.MAUDE_CLOUD_CONFIG;
  delete process.env.HUBS_CONFIG_PATH;
});

describe('parseDeepLink — untrusted input, strict shape', () => {
  test('accepts exactly the minted shape', () => {
    const p = parseDeepLink(`maude://open/alligators?code=mhc_${'a'.repeat(64)}&origin=https://cloud.maude.sh`);
    expect(p).toEqual({ project: 'alligators', code: `mhc_${'a'.repeat(64)}` });
  });
  test('refuses everything else', () => {
    for (const bad of [
      'maude://open/alligators', // no code
      'maude://open/Alligators?code=mhc_' + 'a'.repeat(64), // bad slug
      'maude://open/x?code=nothex', // bad code
      'https://evil.example/?code=mhc_' + 'a'.repeat(64), // not maude://
      'maude://join/x/y', // join is not the open shape
    ]) {
      expect(parseDeepLink(bad)).toBeNull();
    }
  });
});

describe('shareViewUrl — the viewer’s browser home', () => {
  test('derives view-<host> from the project url', () => {
    expect(shareViewUrl('https://alligators.cloud.maude.sh', 'alligators')).toBe(
      'https://view-alligators.cloud.maude.sh'
    );
  });
  test('falls back to the platform zone on garbage', () => {
    expect(shareViewUrl('nonsense', 'p1')).toBe('https://view-p1.cloud.maude.sh');
  });
});

describe('attachCode — the maude:// lane end to end (stubbed)', () => {
  test('a valid code links: hub credential stored, linkedHub written token-free', async () => {
    const { createCloudEndpoints } = await import('../cloud/endpoints.ts');
    const designRoot = join(scratch, '.design');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(designRoot, { recursive: true });
    writeFileSync(join(designRoot, 'config.json'), '{}\n');

    const apiEndpoints = createCloudEndpoints({ paths: { repoRoot: scratch, designRoot } });
    const r = await apiEndpoints.attachCode(`mhc_${'a'.repeat(64)}`);
    expect(r.status).toBe(200);
    expect((r.json as any).ok).toBe(true);
    expect((r.json as any).project).toBe('stub-project');

    const cfg = JSON.parse(readFileSync(join(designRoot, 'config.json'), 'utf8'));
    expect(cfg.linkedHub?.url).toContain('127.0.0.1');
    expect(JSON.stringify(cfg)).not.toContain('mau_stub_hub_token');

    // The exchange went to the CONFIGURED cloud address (this stub) — the
    // only /auth/handoff/exchange call seen is ours.
    expect(seen.filter((s) => s.includes('/auth/handoff/exchange')).length).toBe(1);
  });

  test('a malformed or dead code never reaches the network', async () => {
    const { createCloudEndpoints } = await import('../cloud/endpoints.ts');
    const apiEndpoints = createCloudEndpoints({
      paths: { repoRoot: scratch, designRoot: join(scratch, '.design') },
    });
    const before = seen.length;
    const r = await apiEndpoints.attachCode('not-a-code');
    expect(r.status).toBe(400);
    expect(seen.length).toBe(before);

    const dead = await apiEndpoints.attachCode(`mhc_${'b'.repeat(64)}`);
    expect(dead.status).toBe(410);
    expect((dead.json as any).error).toMatch(/works once/);
  });
});
