import { $, browser, expect } from '@wdio/globals';

import { capture, startReport } from '../helpers/evidence';
import { isNativeShell } from '../helpers/native';
import { waitForSidecar } from '../helpers/sidecar';

/**
 * feature-acp-write-path-scope, Task 7 — the write-path gate, end to end in the
 * packaged shell.
 *
 * TWO halves, and BOTH matter:
 *
 *  1. An IN-PROJECT edit completes with NO permission prompt. This is the
 *     DDR-184 regression guard. `Edit`/`Write`/`NotebookEdit` came off
 *     `MAUDE_DEFAULT_ALLOWED_TOOLS` in this change, and if the replacement path
 *     gate is wrong in the "too strict" direction the symptom is a prompt on
 *     every single canvas edit — the exact "Manual mode blocks every edit"
 *     complaint DDR-184 exists to close. Unit tests can prove the verdict; only
 *     this proves the user doesn't get asked.
 *
 *  2. A write OUTSIDE the project RAISES the prompt, and the card names the
 *     RESOLVED absolute path. This is the security half.
 *
 * Both need a REAL model turn (the model has to actually decide to call the
 * write tool), which is inherently less deterministic than a client-side event
 * — same caveat as acp-ask-user-question, and the same mitigation: an explicit
 * instruction plus a generous timeout that absorbs latency, not unreliability.
 * Requires a real, signed-in `claude`; self-skips if the panel is not connected.
 *
 * NOTHING IS EVER APPROVED HERE. The out-of-project case is rejected, so the
 * scenario proves the gate without the test suite writing outside its own
 * project — which is the behaviour it is asserting is dangerous.
 */
const tid = (s: string) => `[data-testid="${s}"]`;

/** A path that is unambiguously outside any project root, harmless if it were
 *  ever created, and obviously a test artifact if it somehow is. */
const OUTSIDE_PATH = '~/.maude-e2e-write-scope-probe.txt';

async function send(text: string) {
  const composer = await $(tid('chat-composer'));
  await composer.waitForDisplayed({ timeout: 60_000 });
  const input = await composer.$('.chat-input');
  await input.click();
  await input.addValue(text);
  await (await $('[aria-label="Send message"]')).click();
}

describe('acp-write-scope (native-desktop)', () => {
  before(async function () {
    startReport('acp-write-scope (native-desktop) — in-project writes never ask, outside ones do');
    await browser.setTimeout({ script: 120_000 });

    await waitForSidecar();
    if (!(await isNativeShell())) this.skip(); // ACP panel is native-only (DDR-123)

    await (await $(tid('assistant-toggle'))).waitForDisplayed({ timeout: 30_000 });
    await (await $(tid('assistant-toggle'))).click();

    const notConnected = await $(tid('acp-not-connected'));
    if (await notConnected.isDisplayed().catch(() => false)) {
      this.skip(); // no signed-in claude on this machine — not this scenario's job to set that up
    }
  });

  it('1 · an IN-PROJECT write completes with NO permission prompt (DDR-184 guard)', async () => {
    await send(
      'Create a file called write-scope-probe.txt in this project with the single word ok. ' +
        'Use the Write tool immediately, do not explain first.'
    );

    // The assertion is an ABSENCE, so it needs a positive completion signal to
    // race against: wait for the turn to settle, and assert no card ever showed.
    // Polling for "no prompt" alone would pass simply by being checked early.
    const prompt = await $(tid('chat-permission-prompt'));
    let sawPrompt = false;
    await browser.waitUntil(
      async () => {
        if (await prompt.isDisplayed().catch(() => false)) {
          sawPrompt = true;
          return true; // fail fast — no point waiting out the turn
        }
        // `chat-msg-actions` only renders on a COMPLETED assistant message, so
        // it is the turn-finished signal (there is no busy testid to poll).
        return await $(tid('chat-msg-actions'))
          .isDisplayed()
          .catch(() => false);
      },
      { timeout: 120_000, interval: 500, timeoutMsg: 'the in-project write turn never settled' }
    );
    await capture('01-in-project-write-no-prompt');
    expect(sawPrompt).toBe(false);
  });

  it('2 · a write OUTSIDE the project raises the prompt and names the resolved path', async () => {
    await send(
      `Write the word ok to the file ${OUTSIDE_PATH}. ` +
        'Use the Write tool immediately, do not explain first.'
    );

    const prompt = await $(tid('chat-permission-prompt'));
    await prompt.waitForDisplayed({ timeout: 120_000 });
    await capture('02-out-of-project-prompt');

    // The out-of-project BLOCK, not just any permission card — a generic prompt
    // (e.g. a Bash call) would satisfy the selector above but prove nothing.
    const outside = await $(tid('chat-perm-outside'));
    await outside.waitForDisplayed({ timeout: 5_000 });

    // The RESOLVED absolute path, not the model's string: `~` is expanded and
    // the leading `/` proves the server resolved it rather than echoing input.
    const paths = await $(tid('chat-perm-paths'));
    const shown = await paths.getText();
    expect(shown).toContain('/');
    expect(shown).not.toContain('~');

    // Decision D — consent is per-call, so no "always"-shaped button exists.
    const cardText = (await (await $(tid('chat-permission-prompt'))).getText()).toLowerCase();
    expect(cardText).not.toContain('always');
  });

  it('3 · rejecting it leaves the turn resolved and the composer usable', async () => {
    // Deliberately REJECT — approving would have the test suite write outside
    // its own project, which is the behaviour this whole feature calls unsafe.
    const card = await $(tid('chat-permission-prompt'));
    const reject = await card.$('.btn--danger');
    await reject.waitForDisplayed({ timeout: 10_000 });
    await reject.click();

    await browser.waitUntil(async () => !(await card.isDisplayed().catch(() => false)), {
      timeout: 20_000,
      timeoutMsg: 'the permission card never cleared after Reject',
    });
    const composer = await $(tid('chat-composer'));
    await composer.waitForDisplayed({ timeout: 60_000 });
    await capture('03-rejected-turn-resolved');
  });
});
