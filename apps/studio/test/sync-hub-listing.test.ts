// The hub's listing, and the one question the seed asks of it.
//
// THE FINDING (attacker seat, 2026-08-19, HIGH). The listing was indexed by
// `slugFromDocName`, which strips `ws/<workspace>/<branch>/`, while
// `diffRemoteDocs` — fed the SAME listing twelve lines later — compares full
// document names. So a `hero` on `main` answered for another peer's `hero` on
// `feat/x`: that peer's cold-start seed returned `defer-hub-state` forever,
// logging that the hub's state was on its way, and the canvas never synced in
// either direction. Peer tokens are commonly `scope: '*'`, so one listing spans
// every namespace on the hub — no hostile hub required, one teammate reusing a
// canvas name on another branch is the whole exploit.

import { describe, expect, test } from 'bun:test';

import { hubHolds, indexHubDocs } from '../sync/hub-listing.ts';

describe('the hub listing index', () => {
  test('a same-slug document in ANOTHER namespace does not answer for mine', () => {
    const index = indexHubDocs([{ name: 'ws/acme/main/ui-hero', bytes: 2931 }]);
    expect(hubHolds(index, 'ws/acme/feat-x/ui-hero')).toBe(false);
    expect(hubHolds(index, 'ws/acme/main/ui-hero')).toBe(true);
  });

  test('a legacy flat name is its own key, not a match for a namespaced one', () => {
    const index = indexHubDocs([{ name: 'ui-hero', bytes: 10 }]);
    expect(hubHolds(index, 'ws/acme/main/ui-hero')).toBe(false);
    expect(hubHolds(index, 'ui-hero')).toBe(true);
  });

  test('a row that exists but carries nothing is not state', () => {
    // Deferring to an empty document would leave a canvas that never syncs in
    // either direction — the document exists, and holds none of the work.
    const index = indexHubDocs([{ name: 'ui-hero', bytes: 0 }, { name: 'ui-other' }]);
    expect(hubHolds(index, 'ui-hero')).toBe(false);
    expect(hubHolds(index, 'ui-other')).toBe(false);
  });

  test('an unnamed row is dropped rather than coerced into a blank key', () => {
    const index = indexHubDocs([
      { name: '', bytes: 5 },
      { name: undefined as unknown as string, bytes: 5 },
    ]);
    expect(index.size).toBe(0);
    expect(hubHolds(index, '')).toBe(false);
  });
});
