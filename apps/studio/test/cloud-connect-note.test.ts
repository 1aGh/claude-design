// The sentence a person reads after pressing Connect.
//
// It used to be computed once, from the ATTACH RESPONSE, at the instant the
// confirm dialog closed — and never again. The attach response reports an
// intention (`{ syncing: true }` means `runtime.start()` did not throw and one
// local canvas qualified), so the sentence claimed success before a socket
// existed and then sat there through every outcome, including total failure.
//
// These cases are one per row of the plan's states/copy table, plus the two
// degradations that must never take the note away entirely: no live payload,
// and a payload from a server that predates the counts.

import { describe, expect, test } from 'bun:test';

import { connectOutcomeNote } from '../client/panels/CloudBar.jsx';
import type { SyncStatusLike } from '../sync/presentation.ts';

const live = (over: SyncStatusLike): SyncStatusLike => ({
  state: 'online',
  queuedOps: 0,
  lastSyncAt: null,
  offlineSince: null,
  flash: null,
  updatedAt: 0,
  ...over,
});

const started = { syncing: true, canvases: 75 };

describe('with a live payload — the sentence moves', () => {
  test('connecting: nothing has settled yet, and it does not pretend otherwise', () => {
    const n = connectOutcomeNote(
      'alligators',
      started,
      live({ state: 'connecting', docs: { synced: 0, pending: 75, rejected: 0 } })
    );
    expect(n.text).toContain('Connecting to alligators');
    expect(n.text).not.toContain('Synced');
  });

  test('syncing: real progress, drawn from settled handshakes', () => {
    const n = connectOutcomeNote(
      'alligators',
      started,
      live({ docs: { synced: 40, pending: 35, rejected: 0 } })
    );
    expect(n.text).toContain('40 of 75');
  });

  test('synced: names what arrived and tells the person to go open it', () => {
    const n = connectOutcomeNote(
      'alligators',
      started,
      live({
        docs: { synced: 75, pending: 0, rejected: 0 },
        pulled: { names: ['ui-welcome'], count: 3 },
      })
    );
    expect(n.text).toContain('Synced with alligators');
    expect(n.text).toContain('3 came down');
    // Deliberately not an imperative to open it: a pulled canvas is hub-authored
    // TSX, and "open this" inside our own green success sentence is the
    // strongest endorsement we could give content we do not vouch for.
    expect(n.title).toContain('new to this machine');
    expect(n.title).not.toContain('Open one');
  });

  test('refused: the state that cannot fix itself says so, and says what to do', () => {
    // The reported shape, at its worst: the attach response says syncing, the
    // socket is up, and every single document is going nowhere.
    const n = connectOutcomeNote(
      'alligators',
      started,
      live({ state: 'online', docs: { synced: 0, pending: 0, rejected: 75 } })
    );
    expect(n.text).toContain('refused');
    expect(n.title).toContain('Reconnect');
  });

  test('unreachable: queued, not lost — and explicitly nothing to do', () => {
    const n = connectOutcomeNote(
      'alligators',
      started,
      live({ state: 'offline', queuedOps: 2, docs: { synced: 75, pending: 0, rejected: 0 } })
    );
    expect(n.text).toContain('Not reachable');
    expect(n.text).toContain('queued');
    expect(n.title).toContain('resumes by itself');
  });

  test('the live payload beats the attach response, not the other way round', () => {
    // `sync.syncing` is true here and the link is in fact dead. Whichever wins
    // decides whether this whole change did anything.
    const n = connectOutcomeNote('alligators', started, live({ state: 'offline' }));
    expect(n.text).toContain('Not reachable');
  });
});

describe('without a live payload — degrade, never vanish', () => {
  test('first render falls back to the attach response, phrased as in-flight', () => {
    const n = connectOutcomeNote('alligators', started, undefined);
    expect(n.text).toContain('Connecting to alligators');
    expect(n.text).toContain('75 canvases');
  });

  test('an unlinked live payload does not swallow the note', () => {
    // `syncPresentation` returns null for `{linked:false}`; the note must fall
    // through to the attach response rather than render nothing at all.
    const n = connectOutcomeNote('alligators', started, { linked: false });
    expect(n.text).toContain('alligators');
  });

  test('nothing syncable keeps its own copy', () => {
    const n = connectOutcomeNote('alligators', {
      syncing: false,
      reason: 'nothing-syncable',
      detail: 'No canvases in this project are syncable yet.',
    });
    expect(n.text).toContain('nothing to sync yet');
  });

  test('a failed start reports the reason it was given', () => {
    const n = connectOutcomeNote('alligators', {
      syncing: false,
      reason: 'error',
      detail: 'Syncing could not start: hub refused the handshake',
    });
    expect(n.text).toContain('hub refused the handshake');
  });

  test('a missing project name never renders as undefined', () => {
    const n = connectOutcomeNote(null, started, undefined);
    expect(n.text).toContain('the workspace');
  });
});
