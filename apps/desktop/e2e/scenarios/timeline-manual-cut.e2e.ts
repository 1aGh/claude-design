import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $, browser, expect } from '@wdio/globals';
import { capture, startReport } from '../helpers/evidence';

/**
 * timeline-manual-cut — feature-enhanced-video-editing (Task 25).
 *
 * Drives the iMovie-style manual Timeline against the deterministic 3-beat
 * `Cut.tsx` fixture: open → three-band storyline renders → select → ⌘B split
 * → Delete (ripple) → ⌘Z undo → zoom. The Timeline lives in the SHELL (top
 * document), so unlike the canvas-iframe scenarios everything here is plain
 * DOM on the top frame; keyboard chords are dispatched synthetically (the
 * house DOM-driven style — never computer-use).
 *
 * Split/Delete WRITE THROUGH to the fixture .tsx — snapshot + byte-exact
 * restore in before/after so the repo never dirties.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '../fixtures/project/.design/ui/Cut.tsx');

const key = (init: Record<string, unknown>) =>
  browser.execute((k) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...k }));
  }, init);

const beatCount = () =>
  browser.execute(
    () => document.querySelectorAll('[data-testid="timeline-storyline"] .tl-beat').length
  );

describe('timeline — manual cut (select · split · delete · undo · zoom)', () => {
  let fixtureBytes: string;

  before(async () => {
    fixtureBytes = readFileSync(FIXTURE, 'utf8');
    startReport('timeline-manual-cut');
  });

  after(() => {
    writeFileSync(FIXTURE, fixtureBytes);
  });

  it('opens the Cut canvas and the Timeline shows the three-band storyline', async () => {
    const row = $('[data-testid="canvas-row-ui-cut"]');
    await row.waitForExist({ timeout: 30000 });
    await row.click();
    await $('[data-testid="canvas-frame"]').waitForExist({ timeout: 30000 });

    // ⌘⇧T toggles the Timeline dock (shell-level shortcut).
    await key({ key: 't', metaKey: true, shiftKey: true });
    await $('[data-testid="timeline-panel"]').waitForExist({ timeout: 15000 });

    // The comp announce + source parse settle async — wait for the storyline.
    await browser.waitUntil(async () => (await beatCount()) === 3, {
      timeout: 20000,
      timeoutMsg: 'storyline never showed 3 beats',
    });
    await expect($('[data-testid="timeline-storyline"]')).toExist();
    await expect($('[data-testid="timeline-zoom"]')).toExist();
    await capture('storyline-3-beats');
  });

  it('click selects a beat (accent outline), Esc deselects', async () => {
    const beat = $('[data-testid="timeline-seq-1"]');
    await beat.waitForExist({ timeout: 10000 });
    await beat.click();
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          () => document.querySelectorAll('.tl-seq-block.is-selected').length
        )) === 1,
      { timeout: 5000, timeoutMsg: 'click did not select the beat' }
    );
    await capture('beat-selected');
    await key({ key: 'Escape' });
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          () => document.querySelectorAll('.tl-seq-block.is-selected').length
        )) === 0,
      { timeout: 5000, timeoutMsg: 'Esc did not deselect' }
    );
  });

  it('⌘B splits the selected beat at the playhead → 4 beats', async () => {
    // Park the playhead inside beat-two (frames 60–150): seek to 100 via the
    // shell transport (ArrowRight is 1-frame; use the track scrub instead).
    await browser.execute(() => {
      const track = document.querySelector('[data-testid="timeline-track"]') as HTMLElement;
      const r = track.getBoundingClientRect();
      // axis starts after the 96px gutter; 210 total frames → frame 100
      const x = r.left + 96 + ((r.width - 96) * 100) / 210;
      track.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: r.top + 10 })
      );
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    const beat = $('[data-testid="timeline-seq-1"]');
    await beat.click();
    await key({ key: 'b', metaKey: true });
    await browser.waitUntil(async () => (await beatCount()) === 4, {
      timeout: 20000,
      timeoutMsg: '⌘B did not split the beat (expected 4 beats)',
    });
    await capture('after-split');
  });

  it('Delete removes the selected beat with ripple → 3 beats; ⌘Z restores → 4', async () => {
    const beat = $('[data-testid="timeline-seq-1"]');
    await beat.waitForExist({ timeout: 10000 });
    await beat.click();
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          () => document.querySelectorAll('.tl-seq-block.is-selected').length
        )) === 1,
      { timeout: 5000 }
    );
    await key({ key: 'Delete' });
    await browser.waitUntil(async () => (await beatCount()) === 3, {
      timeout: 20000,
      timeoutMsg: 'Delete did not remove the beat',
    });
    await capture('after-delete');
    await key({ key: 'z', metaKey: true });
    await browser.waitUntil(async () => (await beatCount()) === 4, {
      timeout: 20000,
      timeoutMsg: '⌘Z did not restore the removed beat',
    });
    await capture('after-undo');
  });

  it('zoom slider expands the scaled track (px-per-frame scale)', async () => {
    const widthOf = () =>
      browser.execute(
        () =>
          (
            document.querySelector('[data-testid="timeline-track"]') as HTMLElement
          ).getBoundingClientRect().width
      );
    const before = await widthOf();
    await browser.execute(() => {
      const z = document.querySelector('[data-testid="timeline-zoom"]') as HTMLInputElement;
      const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      desc?.set?.call(z, 80);
      z.dispatchEvent(new Event('input', { bubbles: true }));
      z.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await browser.waitUntil(async () => (await widthOf()) > before * 3, {
      timeout: 5000,
      timeoutMsg: 'zoom did not expand the track',
    });
    await capture('zoomed');
  });
});
