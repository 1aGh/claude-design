// DDR-184 #3 — the predicate behind ChatPanel's loud "you can't edit" ModeBanner.
// Pure unit test (the banner itself is a thin render of this). Keyed off the mode
// ID, never a label, so it stays truthful as the adapter's roster evolves.

import { describe, expect, test } from 'bun:test';

import { modeBlocksEdits, NO_EDIT_MODE_IDS } from '../client/panels/acp-capabilities.js';

const rosterWith = (currentModeId: string) => ({
  currentModeId,
  availableModes: [
    { id: 'default', name: 'Manual' },
    { id: 'acceptEdits', name: 'Accept Edits' },
    { id: 'plan', name: 'Plan Mode' },
    { id: 'dontAsk', name: "Don't Ask" },
    { id: 'bypassPermissions', name: 'Bypass Permissions' },
  ],
});

describe('modeBlocksEdits', () => {
  test('blocks in Plan Mode (no tool execution)', () => {
    expect(modeBlocksEdits(rosterWith('plan'))).toBe(true);
  });

  test("blocks in Don't-Ask (denies anything without a standing approval)", () => {
    expect(modeBlocksEdits(rosterWith('dontAsk'))).toBe(true);
  });

  test('does NOT block in the editing modes (Manual / Accept-Edits / Bypass)', () => {
    expect(modeBlocksEdits(rosterWith('default'))).toBe(false);
    expect(modeBlocksEdits(rosterWith('acceptEdits'))).toBe(false);
    expect(modeBlocksEdits(rosterWith('bypassPermissions'))).toBe(false);
  });

  test('false when the roster is empty / not yet loaded (no premature alarm)', () => {
    expect(modeBlocksEdits(null)).toBe(false);
    expect(modeBlocksEdits(undefined)).toBe(false);
    expect(modeBlocksEdits({ availableModes: [] })).toBe(false);
    expect(modeBlocksEdits({ currentModeId: '' })).toBe(false);
  });

  test('NO_EDIT_MODE_IDS is exactly {plan, dontAsk}', () => {
    expect([...NO_EDIT_MODE_IDS].sort()).toEqual(['dontAsk', 'plan']);
  });
});
