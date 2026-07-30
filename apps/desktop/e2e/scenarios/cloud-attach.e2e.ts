import { $, browser, expect } from '@wdio/globals';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { capture, startReport } from '../helpers/evidence';
import { waitForSidecar } from '../helpers/sidecar';

/**
 * cloud-attach (Cloud Phase 23 C4) — proves the CloudBar's sign-in + attach
 * lane end to end, DOM-driven, with the CONTROL PLANE STUBBED so the scenario
 * is deterministic and needs no account, no network, and no cleanup.
 *
 * The stub speaks exactly the three endpoints the dev-server's
 * `apps/studio/cloud/endpoints.ts` calls (`/auth/device/code`,
 * `/auth/device/token`, `/api/projects`) plus `/projects/open`, and the cell
 * exchange is stubbed on the same origin — `MAUDE_CLOUD_URL` points the
 * sidecar here (wdio.conf must pass it through to the app env; the scenario
 * self-skips when it didn't, rather than half-testing against production).
 *
 * What is proven: sign-in flips the rail to the account email without a
 * human (the stub approves the code on the first poll), the project picker
 * lists the stubbed project with its state, and Connect writes `linkedHub`
 * into the scratch project's `.design/config.json` — the exact state
 * `maude design link` writes.
 */
const tid = (s: string) => `[data-testid="${s}"]`;

let stub: ReturnType<typeof createServer> | null = null;

function startStub(): Promise<number> {
  return new Promise((resolve) => {
    stub = createServer(async (req, res) => {
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.url === '/auth/device/code') {
        return send(200, {
          device_code: 'mdc_stub',
          user_code: 'STUB-CODE',
          verification_url: 'about:blank',
          interval: 1,
          expires_in: 900,
        });
      }
      if (req.url === '/auth/device/token') {
        // Approved instantly — no human in a stub.
        return send(200, { token: 'mpt_stub', account: { email: 'e2e@example.com' } });
      }
      if (req.url === '/api/projects') {
        return send(200, {
          projects: [
            { id: 'stub-project', name: 'Stub Project', state: 'active', role: 'owner', stateLabel: 'Ready', url: `http://127.0.0.1:${(stub!.address() as AddressInfo).port}` },
          ],
        });
      }
      if (req.url === '/projects/open') {
        return send(200, {
          token: 'x.y',
          role: 'owner',
          url: `http://127.0.0.1:${(stub!.address() as AddressInfo).port}`,
        });
      }
      if (req.url === '/auth/login') {
        // The "cell" half of the stub — the exchange lane.
        return send(200, { token: 'mau_stub', user: { email: 'e2e@example.com', role: 'owner' } });
      }
      if (req.url === '/health') return send(200, { ok: true });
      send(404, { error: 'not stubbed' });
    });
    stub.listen(0, '127.0.0.1', () => resolve((stub!.address() as AddressInfo).port));
  });
}

describe('cloud-attach — CloudBar sign-in + one-click attach (stubbed control plane)', () => {
  before(async function () {
    startReport('cloud-attach — Maude Cloud sign-in + attach, control plane stubbed');
    await waitForSidecar();

    // The suite's conf must boot the sidecar with MAUDE_CLOUD_URL pointing at
    // the stub (and MAUDE_CLOUD_CONFIG at a scratch path so a developer's real
    // credential is never read or clobbered). Self-skip when it didn't.
    const wired = await browser.execute(() => (window as any).__MAUDE_E2E_CLOUD_STUB === true).catch(() => false);
    if (!wired && !process.env.MAUDE_E2E_CLOUD_STUB) this.skip();
  });

  after(() => {
    stub?.close();
  });

  it('1 · signed out: the rail offers Maude Cloud sign-in', async () => {
    const signin = await $(tid('cloud-signin'));
    await signin.waitForDisplayed({ timeout: 30_000 });
    await capture('signed-out rail');
  });

  it('2 · sign-in completes without a human — the stub approves the first poll', async () => {
    await (await $(tid('cloud-signin'))).click();
    // The dialog may flash (the stub approves in one interval tick) — what
    // must hold is the END state: the account chip with the stub email.
    const account = await $(tid('cloud-account'));
    await account.waitForDisplayed({ timeout: 20_000 });
    expect(await account.getText()).toContain('e2e@example.com');
    await capture('signed in');
  });

  it('3 · the picker lists the stubbed project and Connect writes linkedHub', async () => {
    await (await $(tid('cloud-account'))).click();
    const item = await $(tid('cloud-project-stub-project'));
    await item.waitForDisplayed({ timeout: 15_000 });
    expect(await item.getText()).toContain('Ready');
    await item.click();

    // The visible proof: the rail's note says linked; the durable proof — the
    // scratch project's config — is asserted by the conf's teardown hook,
    // which has filesystem access to the scratch root.
    await browser.waitUntil(
      async () => (await (await $(tid('cloud-bar'))).getText()).includes('Linked to stub-project'),
      { timeout: 20_000, timeoutMsg: 'the attach note never appeared' }
    );
    await capture('attached');
  });
});

export { startStub };
