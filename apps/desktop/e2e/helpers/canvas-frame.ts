import { $, browser } from '@wdio/globals';

/**
 * Switch WebDriver context INTO the active canvas iframe (`data-testid="canvas-frame"`).
 *
 * The pilot runs with MAUDE_CANVAS_ORIGIN_SPLIT=0 (set in wdio.conf.ts) so the
 * canvas iframe is SAME-ORIGIN and switchFrame works without the DDR-054/063
 * cross-origin barrier. If a future scenario must exercise the split-origin
 * canvas, this helper is where that gets handled (the cross-origin frame may be
 * un-switchable via WebDriver — that's open question 2 in the plan).
 */
export async function enterCanvasFrame(timeout = 30_000): Promise<void> {
  const frame = await $('[data-testid="canvas-frame"]');
  await frame.waitForExist({ timeout });
  await browser.switchFrame(frame);
}

/** Return WebDriver context to the top-level studio shell. */
export async function exitToTop(): Promise<void> {
  await browser.switchFrame(null);
}
