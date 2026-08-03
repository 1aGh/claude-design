// Cloud Phase 27 A3/A4 + C2/C4 (DDR-209) — the studio in a cell.
//
// The behaviour under test is the one that makes a cell multi-tenant-safe: in
// workspace mode this process serves an owner and a viewer at the SAME TIME, so
// "what may this request do" cannot come from a file on disk. It comes from the
// proxy in front, per request, and in the absence of proof it is `viewer`.
//
// The local gate this replaces fails OPEN by design — `isHubReadOnly()` returns
// false from its `catch`, and `projectReadOnly()` returns false when `linkedHub`
// is unset. That is correct for a tool on your own laptop and is the whole
// ballgame on the internet, which is why the no-header case below is the most
// important assertion in the file.

import { afterAll, describe, expect, test } from 'bun:test';
import type { Subprocess } from 'bun';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

const procs: Subprocess[] = [];
afterAll(async () => {
  for (const p of procs) await killProc(p);
});

async function bootCell() {
  const { root } = makeSandbox();
  const port = nextPort();
  const proc = await bootServer(root, port, {
    MAUDE_WORKSPACE_MODE: '1',
    // A dev checkout resolves Playwright (the E2E harness), which is a
    // legitimate devDependency here and would otherwise fail the module half of
    // the containment assert before workspace mode could be tested at all.
    MAUDE_WORKSPACE_ALLOW_DEV_MODULES: '1',
    HUB_DASHBOARD_URL: 'https://cloud.maude.sh',
    MAUDE_PROJECT_NAME: 'Alligators',
  });
  procs.push(proc);
  return { base: `http://localhost:${port}` };
}

describe('a cell resolves the role per request, and defaults to read-only', () => {
  test('no injected role at all ⇒ read-only, and writes are refused', async () => {
    const { base } = await bootCell();

    const cfg = (await (await fetch(`${base}/_config`)).json()) as { readOnly?: boolean };
    expect(cfg.readOnly).toBe(true);

    const res = await fetch(`${base}/_api/edit-text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'ui/Sample.tsx', id: 'x', text: 'y' }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { reason?: string }).reason).toBe('read-only');
  });

  test('a vouched editing role opens the same write', async () => {
    const { base } = await bootCell();

    const cfg = (await (
      await fetch(`${base}/_config`, { headers: { 'x-maude-readonly': '0' } })
    ).json()) as { readOnly?: boolean };
    expect(cfg.readOnly).toBe(false);

    const res = await fetch(`${base}/_api/edit-text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-maude-readonly': '0' },
      body: JSON.stringify({ file: 'ui/Sample.tsx', id: 'x', text: 'y' }),
    });
    // Whatever the handler makes of the payload, the GATE let it through — the
    // read-only refusal is the specific thing that must not happen.
    expect(res.status).not.toBe(403);
  });

  test('anything other than a positive `0` is read-only', async () => {
    // The failure mode this rules out: a truthy-string check, where
    // `x-maude-readonly: false` (a plausible thing for a future caller to send)
    // reads as "not read-only".
    const { base } = await bootCell();
    for (const value of ['1', 'false', 'no', '', 'true', 'owner']) {
      const cfg = (await (
        await fetch(`${base}/_config`, { headers: { 'x-maude-readonly': value } })
      ).json()) as { readOnly?: boolean };
      expect(cfg.readOnly).toBe(true);
    }
  });

  test('two requests to ONE process get two different answers', async () => {
    // The actual multi-tenancy property, stated as a test: this is what a
    // per-PROCESS config file cannot do, and it is why A3 exists.
    const { base } = await bootCell();
    const [viewer, member] = await Promise.all([
      fetch(`${base}/_config`, { headers: { 'x-maude-readonly': '1' } }).then((r) => r.json()),
      fetch(`${base}/_config`, { headers: { 'x-maude-readonly': '0' } }).then((r) => r.json()),
    ]);
    expect((viewer as { readOnly: boolean }).readOnly).toBe(true);
    expect((member as { readOnly: boolean }).readOnly).toBe(false);
  });
});

describe('the cloud shell states what it is', () => {
  test('/_config carries the cloud block C2 and C4 render from', async () => {
    const { base } = await bootCell();
    const cfg = (await (await fetch(`${base}/_config`)).json()) as {
      cloud?: { dashboardUrl?: string; projectName?: string };
    };
    expect(cfg.cloud).toBeTruthy();
    expect(cfg.cloud?.dashboardUrl).toBe('https://cloud.maude.sh');
    expect(cfg.cloud?.projectName).toBe('Alligators');
  });

  test('the canvas capability is echoed only when the proxy minted one', async () => {
    const { base } = await bootCell();
    const without = (await (await fetch(`${base}/_config`)).json()) as { canvasToken?: string };
    expect(without.canvasToken).toBeUndefined();

    const with_ = (await (
      await fetch(`${base}/_config`, { headers: { 'x-maude-canvas-token': 'cap-123' } })
    ).json()) as { canvasToken?: string };
    expect(with_.canvasToken).toBe('cap-123');
  });

  test('a cell SERVES the canvas surfaces it used to 404 (DDR-209 A′1)', async () => {
    const { base } = await bootCell();
    // The shell is a static harness; the browser is what evaluates it. Before
    // DDR-209 this was a hard 404 in workspace mode, which is precisely why
    // Phase 25 had to hand-roll a second studio.
    const shell = await fetch(`${base}/_canvas-shell.html`);
    expect(shell.status).toBe(200);
    expect(shell.headers.get('content-type')).toContain('text/html');
  });
});
