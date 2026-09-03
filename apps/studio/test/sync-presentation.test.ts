// The one rule both sync surfaces read — see sync/presentation.ts.
//
// Pins the two SURFACE defects that the monitor-level falsifier
// (`sync-connect-honesty.test.ts`) deliberately leaves alone:
//   - a link with refusals reading green, because the old status bar keyed off
//     `state` and never looked at `docs` at all;
//   - the status bar and the connect note being able to disagree, because they
//     were two rules over one payload.
//
// Every row of the plan's states/copy table gets a case, and each asserts the
// state names a NEXT ACTION where one exists — the user's explicit ask.

import { describe, expect, test } from 'bun:test';

import { type SyncStatusLike, syncPresentation } from '../sync/presentation.ts';

const base: SyncStatusLike = {
  state: 'online',
  queuedOps: 0,
  lastSyncAt: null,
  offlineSince: null,
  flash: null,
  updatedAt: 0,
};

const at = (over: SyncStatusLike) =>
  syncPresentation({ ...base, ...over }, { project: 'alligators' });

describe('nothing to say', () => {
  test('an unlinked project has no hub status', () => {
    expect(syncPresentation({ linked: false })).toBeNull();
    expect(syncPresentation(null)).toBeNull();
  });
});

describe('the states a person passes through', () => {
  test('connecting — no document has settled yet', () => {
    const p = at({ state: 'connecting', docs: { synced: 0, pending: 3, rejected: 0 } });
    expect(p?.phase).toBe('connecting');
    expect(p?.online).toBe(false);
    expect(p?.title).toContain('Connecting to alligators');
  });

  test('syncing — visible progress, with a real count', () => {
    const p = at({ docs: { synced: 40, pending: 35, rejected: 0 } });
    expect(p?.phase).toBe('syncing');
    expect(p?.online).toBe(false);
    expect(p?.label).toBe('40/75');
    expect(p?.title).toContain('40 of 75');
  });

  test('synced — and names what arrived, without telling you to open it', () => {
    const p = at({
      docs: { synced: 75, pending: 0, rejected: 0 },
      pulled: { names: ['ui-welcome', 'ui-how-to'], count: 2 },
    });
    expect(p?.phase).toBe('synced');
    expect(p?.online).toBe(true);
    expect(p?.title).toContain('2 came down');
    // Names the fact; the decision to open hub-authored TSX stays the person's.
    expect(p?.next).toContain('new to this machine');
    expect(p?.next).not.toContain('Open one');
    expect(p?.names).toEqual(['ui-welcome', 'ui-how-to']);
  });

  test('synced with nothing pulled has no next action — because there is none', () => {
    const p = at({ docs: { synced: 5, pending: 0, rejected: 0 } });
    expect(p?.phase).toBe('synced');
    expect(p?.next).toBeNull();
  });
});

describe('the states that used to read green', () => {
  test('a hub that refuses everything is not synced', () => {
    // THE surface defect: `state` is 'online' (a socket exists, the hub is
    // reachable) while every document's edits go nowhere. The old status bar
    // showed a green dot and the word "synced" here.
    const p = at({ state: 'online', docs: { synced: 0, pending: 0, rejected: 75 } });
    expect(p?.phase).toBe('refused');
    expect(p?.online).toBe(false);
    expect(p?.label).toBe('75 refused');
    expect(p?.next).toContain('Reconnect');
  });

  test('a partial refusal is reported, not averaged away', () => {
    const p = at({ state: 'online', docs: { synced: 72, pending: 0, rejected: 3 } });
    expect(p?.phase).toBe('refused');
    expect(p?.title).toContain('3 of 75');
  });

  test('an unreachable hub outranks a stale count', () => {
    const p = at({ state: 'offline', queuedOps: 4, docs: { synced: 75, pending: 0, rejected: 0 } });
    expect(p?.phase).toBe('offline');
    expect(p?.online).toBe(false);
    expect(p?.label).toBe('offline · 4 ↑');
    expect(p?.next).toContain('resumes by itself');
  });
});

describe('payloads that predate the counts', () => {
  test('an old payload falls back to state without inventing document facts', () => {
    const p = at({ state: 'online', docs: undefined });
    expect(p?.phase).toBe('synced');
    expect(p?.title).not.toContain('canvas');
  });

  test('a linked project with zero known documents reads as connecting, not synced', () => {
    const p = at({ state: 'online', docs: { synced: 0, pending: 0, rejected: 0 } });
    expect(p?.phase).toBe('connecting');
    expect(p?.online).toBe(false);
  });

  test('nothing syncable keeps its own honest copy and names the move', () => {
    const p = syncPresentation({ notSyncable: true, tsxCount: 4, reason: 'No canvases yet.' });
    expect(p?.phase).toBe('nothing-syncable');
    expect(p?.label).toBe('0 syncable · 4 tsx');
    expect(p?.next).toContain('Create a canvas');
  });
});

describe('a payload it cannot read is not a payload that says everything is fine', () => {
  // `/_sync-status` returns JSON.parse of `_sync.json` with NO schema, so the
  // input here is whatever is on disk — a partial write, an older producer, a
  // newer one. `synced` used to be the fall-through, which made the reassuring
  // answer the only reachable one for every shape not recognised.
  test('an empty docs object does not render as "all NaN canvases", green', () => {
    const p = at({ state: 'online', docs: {} as never });
    expect(p?.phase).not.toBe('synced');
    expect(p?.online).toBe(false);
    expect(p?.title).not.toContain('NaN');
  });

  test('negative, fractional and non-numeric counts all fail closed', () => {
    for (const docs of [
      { synced: 5, pending: -5, rejected: 0 },
      { synced: 1, pending: null, rejected: 0 },
      { synced: 1.5, pending: 0, rejected: 0 },
      { synced: '75', pending: 0, rejected: 0 },
    ] as never[]) {
      const p = at({ state: 'online', docs });
      expect(p?.online).toBe(false);
      expect(p?.phase).not.toBe('synced');
    }
  });

  test('an absent docs field is still the old-payload path, not "unreadable"', () => {
    // Absent and malformed are different facts and must not collapse.
    const p = at({ state: 'online', docs: undefined });
    expect(p?.phase).toBe('synced');
  });

  test('a wild pulled count cannot reach the sentence', () => {
    const p = at({
      docs: { synced: 1, pending: 0, rejected: 0 },
      pulled: { names: [], count: 1e9 } as never,
    });
    expect(p?.title).not.toContain('1000000000');
  });
});

describe('hub-supplied text is untrusted (DDR-054)', () => {
  test('counts come first and names are capped in number', () => {
    const p = at({
      state: 'online',
      docs: { synced: 0, pending: 0, rejected: 9 },
      rejectedSlugs: ['a', 'b', 'c', 'd', 'e'],
    });
    expect(p?.names).toHaveLength(3);
    // The label a hostile name could otherwise dominate carries no name at all.
    expect(p?.label).toBe('9 refused');
  });

  test('a long project name cannot run away with the sentence', () => {
    const p = syncPresentation(
      { ...base, docs: { synced: 1, pending: 0, rejected: 0 } },
      { project: 'x'.repeat(500) }
    );
    expect(p?.title.length).toBeLessThan(200);
  });

  test('names survive being absent or empty', () => {
    const p = at({ state: 'online', docs: { synced: 0, pending: 0, rejected: 2 } });
    expect(p?.names).toEqual([]);
  });
});

describe('zero progress has a deadline — the stalled phase', () => {
  const NOW = 10 * 60_000; // 10 minutes after the epoch-zero base

  test('connecting past the ceiling with nothing synced becomes stalled, with the move named', () => {
    const p = syncPresentation(
      { ...base, state: 'connecting', startedAt: 1, docs: { synced: 0, pending: 73, rejected: 0 } },
      { project: 'alligators', now: NOW }
    );
    expect(p?.phase).toBe('stalled');
    expect(p?.online).toBe(false);
    expect(p?.title).toContain('Nothing has synced');
    expect(p?.next).toContain('retrying');
  });

  // Issue #118 — the stall advice used to name a cause we have evidence
  // AGAINST. With `rejected: 0` the hub has refused nothing, so "the sign-in
  // may have expired" is not a hedge, it is a wrong diagnosis — and it is the
  // one that sends a person to Resync, which re-handshakes every canvas against
  // a hub that is not answering and lands the display on `offline`.
  test('a stall with zero refusals must NOT blame the sign-in', () => {
    const p = syncPresentation(
      { ...base, state: 'online', startedAt: 1, docs: { synced: 0, pending: 85, rejected: 0 } },
      { project: 'alligators', now: NOW }
    );
    expect(p?.phase).toBe('stalled');
    expect(p?.next).not.toContain('sign-in');
    expect(p?.next).toContain('not completing handshakes');
  });

  // The legacy payload is the one place a refusal cannot be ruled out, so the
  // hedge survives there — written as a possibility, not as the diagnosis.
  test('a pre-DDR-102 payload keeps the credential hedge, because it cannot know', () => {
    const p = syncPresentation(
      { ...base, state: 'connecting', startedAt: 1 },
      { project: 'alligators', now: NOW }
    );
    expect(p?.phase).toBe('stalled');
    expect(p?.next).toContain('sign-in');
  });

  test('a fresh connect is NOT stalled — the handshake gets its moment', () => {
    const p = syncPresentation(
      { ...base, state: 'connecting', startedAt: 1, docs: { synced: 0, pending: 73, rejected: 0 } },
      { project: 'alligators', now: 30_000 }
    );
    expect(p?.phase).toBe('connecting');
  });

  test('any progress at all cancels the stall — syncing is not stalling', () => {
    const p = syncPresentation(
      { ...base, startedAt: 1, docs: { synced: 1, pending: 72, rejected: 0 } },
      { project: 'alligators', now: NOW }
    );
    expect(p?.phase).toBe('syncing');
  });

  test('zero known documents past the ceiling also stalls', () => {
    const p = syncPresentation(
      { ...base, state: 'connecting', startedAt: 1, docs: { synced: 0, pending: 0, rejected: 0 } },
      { project: 'alligators', now: NOW }
    );
    expect(p?.phase).toBe('stalled');
  });

  test('an old payload without startedAt can never stall (fail open to connecting)', () => {
    const p = syncPresentation(
      { ...base, state: 'connecting' },
      { project: 'alligators', now: NOW }
    );
    expect(p?.phase).toBe('connecting');
  });

  test('a refusal still outranks a stall — the more specific cause wins', () => {
    const p = syncPresentation(
      { ...base, startedAt: 1, docs: { synced: 0, pending: 0, rejected: 73 } },
      { project: 'alligators', now: NOW }
    );
    expect(p?.phase).toBe('refused');
  });

  test('an unreachable hub still outranks a stall — offline explains itself', () => {
    const p = syncPresentation(
      { ...base, state: 'offline', startedAt: 1, docs: { synced: 0, pending: 3, rejected: 0 } },
      { project: 'alligators', now: NOW }
    );
    expect(p?.phase).toBe('offline');
  });

  test('a garbage startedAt fails open, never into a false alarm', () => {
    const p = syncPresentation(
      // biome-ignore lint/suspicious/noExplicitAny: hostile-payload shape test
      {
        ...base,
        state: 'connecting',
        startedAt: 'yes' as any,
        docs: { synced: 0, pending: 1, rejected: 0 },
      },
      { project: 'alligators', now: NOW }
    );
    expect(p?.phase).toBe('connecting');
  });
});
