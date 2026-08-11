// feature-sync-progress-modal — the Sync panel + HUB SYNC chip surface.
//
// Source-level assertions (cloud-shell-surfaces style): what these pin is
// exactly what would regress — someone dropping the linked-only gate (a solo
// project would get a dock tab that opens onto nothing), rewiring the chip
// away from the dock helpers (breaking the one-panel-per-side invariant), or
// the panel inventing sync vocabulary / dropping the a11y live region the
// CloudBar note established.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const STUDIO = join(import.meta.dir, '..');
const APP = readFileSync(join(STUDIO, 'client', 'app.jsx'), 'utf8');
const PANEL = readFileSync(join(STUDIO, 'client', 'panels', 'SyncPanel.jsx'), 'utf8');

describe('the Sync panel exists only where a hub link exists', () => {
  test('sync is a dock panel with a right-side default', () => {
    expect(APP).toContain("{ id: 'sync', label: 'Sync' }");
    expect(APP).toMatch(/sync: 'right'/);
  });

  test('panelAvailable gates sync on a live syncStatus — solo projects get no tab', () => {
    expect(APP).toContain("if (id === 'sync') return !!syncStatus;");
  });

  test('the chip toggles through the dock helpers, not a raw setState', () => {
    // toggleRightPanel keeps the one-panel-per-side invariant; a bare
    // setSyncPanelOpen(true) here would let Sync render behind an open sibling.
    expect(APP).toMatch(/onOpenSync=\{syncStatus \? \(\) => toggleRightPanel\('sync'\)/);
  });

  test('the chip is a real button with pressed-state semantics', () => {
    expect(APP).toContain('data-testid="open-sync"');
    expect(APP).toMatch(/aria-pressed=\{syncOpen\}/);
  });

  test('the span fallback remains for sessions without a handler', () => {
    // Older wiring / no-handler renders must keep the passive chip rather
    // than a dead button.
    expect(APP).toMatch(/onOpenSync \? \(/);
  });
});

describe('the Sync panel speaks the presentation vocabulary, safely', () => {
  test('the header sentence comes from syncPresentation — the one shared rule', () => {
    expect(PANEL).toContain("from '../../sync/presentation.ts'");
    expect(PANEL).toContain('syncPresentation(status');
  });

  test('rows map DocSyncState onto existing words, never new ones', () => {
    expect(PANEL).toMatch(/pending: 'syncing'/);
    expect(PANEL).toMatch(/connected: 'synced'/);
    expect(PANEL).toMatch(/'auth-rejected': 'refused'/);
  });

  test('every name that reaches the DOM goes through safeName', () => {
    // Slugs and asset keys are local, but the payload is read back off disk —
    // bounded text-only rendering is the house rule (DDR-054).
    expect(PANEL).toContain("import { safeName, syncPresentation }");
    expect(PANEL).not.toMatch(/dangerouslySetInnerHTML/);
  });

  test('the live header is a polite status region (the CloudBar a11y pattern)', () => {
    expect(PANEL).toMatch(/role="status" aria-live="polite"/);
  });

  test('the asset lane renders from the payload, with the retry promise', () => {
    expect(PANEL).toContain('data-testid="sync-assets"');
    expect(PANEL).toContain('retry on the next launch');
  });
});
