import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $, browser, expect } from '@wdio/globals';

import { capture, startReport } from '../helpers/evidence';
import { waitForSidecar } from '../helpers/sidecar';

/**
 * cloud-attach (Cloud Phase 23 C4 + Phase 17) — the CloudBar lane end to end,
 * DOM-driven, control plane + cell stubbed by wdio.cloud.conf.ts (which
 * primes MAUDE_CLOUD_URL/MAUDE_CLOUD_CONFIG/HUBS_CONFIG_PATH before the app
 * spawns, so no real account or credential is ever touched).
 *
 * Proven here:
 *   1. sign-in flips the rail to the account email without a human (the stub
 *      approves the first poll);
 *   2. the picker lists a member project as Connect and a VIEWER project as
 *      "View in the browser" (Phase 17 T4 — no dead menus);
 *   3. Connect writes `linkedHub` into the fixture project's config — the
 *      exact state `maude design link` writes;
 *   4. a maude:// deep link surfaces the explicit CONFIRM strip and the
 *      one-time code attach completes (the same `maude://deep-link` event the
 *      Rust handler emits; OS scheme registration is DDR-177 smoke).
 */
const tid = (s: string) => `[data-testid="${s}"]`;
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_CONFIG = join(HERE, '..', 'fixtures', 'project', '.design', 'config.json');
const STUB_CODE = `mhc_${'a'.repeat(64)}`;

/** Only the sliver of the Tauri global this scenario reaches for. */
interface TauriGlobal {
  event: { emit: (name: string, payload: unknown) => void };
}

let originalConfig: string | null = null;

describe('cloud-attach — sign-in, picker, attach, deep-link confirm (stubbed)', () => {
  before(async function () {
    startReport('cloud-attach — Maude Cloud sign-in + attach, control plane stubbed');
    if (!process.env.MAUDE_E2E_CLOUD_STUB) this.skip();
    try {
      originalConfig = readFileSync(FIXTURE_CONFIG, 'utf8');
    } catch {
      originalConfig = null;
    }
    await waitForSidecar();
  });

  after(() => {
    // The fixture must stay deterministic for every other suite — undo the
    // linkedHub this run wrote.
    if (originalConfig !== null) writeFileSync(FIXTURE_CONFIG, originalConfig);
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

  it('3 · the picker: member → Connect, viewer → View in the browser; Connect writes linkedHub', async () => {
    await (await $(tid('cloud-account'))).click();

    const viewer = await $(tid('cloud-project-stub-gallery'));
    await viewer.waitForDisplayed({ timeout: 15_000 });
    expect(await viewer.getText()).toContain('View Stub Gallery in the browser');

    const member = await $(tid('cloud-project-stub-project'));
    expect(await member.getText()).toContain('Connect Stub Project');
    await capture('picker with member + viewer rows');
    await member.click();

    await browser.waitUntil(
      async () => (await (await $(tid('cloud-bar'))).getText()).includes('Linked to stub-project'),
      { timeout: 20_000, timeoutMsg: 'the attach note never appeared' }
    );
    const cfg = JSON.parse(readFileSync(FIXTURE_CONFIG, 'utf8'));
    expect(cfg.linkedHub?.url).toContain('127.0.0.1');
    await capture('attached via picker');
  });

  it('4 · a maude:// deep link asks first, then the one-time code attaches', async () => {
    await browser.execute((code: string) => {
      // The same event the Rust deep-link handler emits — the UI cannot tell
      // the difference, which is the point.
      const tauri = (window as unknown as { __TAURI__: TauriGlobal }).__TAURI__;
      tauri.event.emit('maude://deep-link', `maude://open/stub-project?code=${code}`);
    }, STUB_CODE);

    const confirm = await $(tid('cloud-deeplink'));
    await confirm.waitForDisplayed({ timeout: 15_000 });
    expect(await confirm.getText()).toContain('Connect this project to stub-project?');
    await capture('deep-link confirm strip');

    await (await $(tid('cloud-deeplink-connect'))).click();
    await browser.waitUntil(
      async () => (await (await $(tid('cloud-bar'))).getText()).includes('Linked to stub-project'),
      { timeout: 20_000, timeoutMsg: 'the deep-link attach note never appeared' }
    );
    await capture('attached via deep link');
  });
});
