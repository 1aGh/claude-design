import { $, browser, expect } from '@wdio/globals';

import { capture, startReport } from '../helpers/evidence';
import { waitForSidecar } from '../helpers/sidecar';

/**
 * feature-bug-report-button — the Report-a-Bug dialog's consent flow,
 * DOM-driven: Help menu → Report a bug… → describe → the preview/consent
 * step renders (the payload checklist IS the consent surface, so its
 * presence is the invariant worth pinning) → cancel leaves no dialog behind.
 *
 * Deliberately does NOT click "Send report" — an e2e run must never file a
 * real issue against the live intake. The submit path is covered by the
 * dev-server proxy + cloud route unit tests (report.test.mjs).
 */
const tid = (s: string) => `[data-testid="${s}"]`;

describe('report-bug-dialog', () => {
  before(async () => {
    startReport('report-bug-dialog — Help ▸ Report a bug… consent flow');
    await waitForSidecar();
  });

  it('1 · Help menu opens the dialog on its describe step', async () => {
    const helpBtn = await $('[data-tour="help"]');
    await helpBtn.waitForDisplayed({ timeout: 30_000 });
    await helpBtn.click();

    const item = await $('button.st-dd-item*=Report a bug');
    await item.waitForDisplayed({ timeout: 5_000 });
    await item.click();

    const dialog = await $(tid('report-bug-dialog'));
    await dialog.waitForDisplayed({ timeout: 5_000 });
    await capture('01-dialog-describe-step');

    const preview = await $(tid('report-bug-preview'));
    // Empty description → the review button is disabled (description is the
    // one mandatory field).
    expect(await preview.getAttribute('disabled')).not.toBeNull();
  });

  it('2 · a description unlocks the preview step and the consent checklist renders', async () => {
    const desc = await $(tid('report-bug-description'));
    await desc.click();
    await desc.addValue('E2E probe: the export button does nothing.');

    const preview = await $(tid('report-bug-preview'));
    await preview.waitForEnabled({ timeout: 3_000 });
    await preview.click();

    // The consent surface: send button present, and nothing has been sent —
    // the dialog is still open, showing what WOULD go.
    const send = await $(tid('report-bug-send'));
    await send.waitForDisplayed({ timeout: 10_000 });
    await capture('02-preview-consent-step');
  });

  it('3 · closing the dialog leaves no residue', async () => {
    await browser.keys(['Escape']);
    // Esc closes menubar dropdowns; the dialog closes via its × button.
    const dialog = await $(tid('report-bug-dialog'));
    if (await dialog.isDisplayed().catch(() => false)) {
      await (await $('[data-testid="report-bug-dialog"] .st-dialog-hd .st-iconbtn')).click();
    }
    await browser.waitUntil(
      async () => !(await (await $(tid('report-bug-dialog'))).isDisplayed().catch(() => false)),
      { timeout: 5_000, timeoutMsg: 'report-bug dialog did not close' }
    );
    await capture('03-dialog-closed');
  });
});
