// The client learns it is a viewer at BOOT — Cloud Phase 25 C2.
//
// The alternative is learning it from the first refused write, which means
// drawing somebody an editor and then taking it away. So the role the
// workspace vouched for at sign-in is persisted with the credential and
// resolved before the UI paints.
//
// This flag decides what the UI OFFERS. It is never what stops a write: the
// cell enforces that (Phase 25 C1 — a read-only peer token, Hocuspocus
// dropping SyncStep2/Update, one HTTP gate), and it holds whatever a patched
// client believes about itself.

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { saveHubCredential } from '../sync/hub-link.ts';
import { signInToWorkspace } from '../sync/workspace-signin.ts';

function withHome<T>(fn: (home: string) => T): T {
  const home = mkdtempSync(join(tmpdir(), 'maude-ro-'));
  const prevXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = home;
  try {
    return fn(home);
  } finally {
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
    rmSync(home, { recursive: true, force: true });
  }
}

describe('the vouched role is persisted with the credential', () => {
  test('a viewer is recorded as one', () => {
    withHome((home) => {
      saveHubCredential('https://p.cloud.maude.sh', 'mau_tok', 'viewer');
      const cfg = JSON.parse(readFileSync(join(home, 'maude', 'hubs.json'), 'utf8'));
      expect(cfg.hubs['https://p.cloud.maude.sh'].role).toBe('viewer');
    });
  });

  test('a credential written without a role stays write-capable', () => {
    // The upgrade promise: nobody is demoted by shipping this.
    withHome((home) => {
      saveHubCredential('https://p.cloud.maude.sh', 'mau_tok');
      const cfg = JSON.parse(readFileSync(join(home, 'maude', 'hubs.json'), 'utf8'));
      expect(cfg.hubs['https://p.cloud.maude.sh'].role).toBeUndefined();
    });
  });
});

describe('sign-in carries the role through to the credential', () => {
  const okHub = (role: string) =>
    (async (url: string) => {
      const u = String(url);
      if (u.endsWith('/health')) return Response.json({ ok: true, version: '1.0.0' });
      return Response.json({ token: 'mau_minted', user: { email: 'v@example.com', role } });
    }) as unknown as typeof fetch;

  test('a viewer sign-in saves the role, and reports it back', async () => {
    const saved: Array<[string, string, string | undefined]> = [];
    const res = await signInToWorkspace(
      { url: 'https://p.cloud.maude.sh', email: 'v@example.com', password: 'x'.repeat(12) },
      {
        save: (u, t, r) => saved.push([u, t, r]),
        fetchImpl: okHub('viewer'),
      }
    );
    expect(res.status).toBe(200);
    expect(saved[0][2]).toBe('viewer');
    expect((res.json as { user: { role: string } }).user.role).toBe('viewer');
  });

  test('a hub that names no role is treated as member, never as viewer', async () => {
    // Failing OPEN on the UI flag is correct: the cell is what refuses a
    // write, so a wrong guess here costs a redundant affordance, never
    // access. Guessing "viewer" instead would lock out every self-hoster
    // whose hub predates this field.
    const saved: Array<[string, string, string | undefined]> = [];
    const res = await signInToWorkspace(
      { url: 'https://hub.example.com', email: 'm@example.com', password: 'x'.repeat(12) },
      {
        save: (u, t, r) => saved.push([u, t, r]),
        fetchImpl: (async (url: string) => {
          const u = String(url);
          if (u.endsWith('/health')) return Response.json({ ok: true, version: '1.0.0' });
          return Response.json({ token: 'mau_minted', user: { email: 'm@example.com' } });
        }) as unknown as typeof fetch,
      }
    );
    expect(res.status).toBe(200);
    expect(saved[0][2]).toBe('member');
  });
});
