// The ONE file decision — Sync v2 Increment 3 (DDR-226 §4).
//
// A decision table earns trust two ways, and this file does both.
//
// **Row by row**, because each row encodes a specific incident or rule and
// deserves to be named: DDR-076's "absence is not authority", the Syncthing
// edit-beats-delete rule, the self-echo that made the old fast lane need a
// probe-guard, the epoch-degraded downgrade.
//
// **And exhaustively**, because the rows are only worth anything if they are
// TOTAL. The generator below walks the entire {local × remote × ancestor ×
// tombstone × epoch × self × propagate} space and asserts the invariants that
// must hold for every point in it — the ones a hand-written case list is
// exactly the wrong tool for. Two of those invariants are the whole safety
// argument of the arc: nothing ever overwrites a local change without parking
// it first, and a file the hub has never heard of is never deleted.

import { describe, expect, test } from 'bun:test';

import {
  conflictCopyName,
  decideFile,
  type FileAction,
  type FileState,
  isMaudeConflictCopy,
} from '../sync/decide-file.ts';

const A = 'a'.repeat(64); // one content
const B = 'b'.repeat(64); // another
const C = 'c'.repeat(64); // a third
const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // sha256('')

const at = (over: Partial<FileState> = {}): FileState => ({
  path: 'system/ds/brand.css',
  local: null,
  remote: null,
  ancestor: null,
  ...over,
});

describe('decideFile — the clean cases', () => {
  test('equal sides move nothing and adopt the ancestor', () => {
    const d = decideFile(at({ local: A, remote: A, ancestor: null }));
    expect(d.action).toBe('noop');
    expect(d.adoptAncestor).toBe(true);
  });

  test('they moved, we did not ⇒ PULL', () => {
    expect(decideFile(at({ local: A, remote: B, ancestor: A })).action).toBe('pull');
  });

  test('we moved, they did not ⇒ PUSH', () => {
    expect(decideFile(at({ local: B, remote: A, ancestor: A })).action).toBe('push');
  });

  test('a file only the hub has ⇒ PULL (creation)', () => {
    expect(decideFile(at({ local: null, remote: A, ancestor: null })).action).toBe('pull');
  });

  test('a file only we have ⇒ PUSH (creation)', () => {
    expect(decideFile(at({ local: A, remote: null, ancestor: null })).action).toBe('push');
  });

  test('neither side has it ⇒ nothing', () => {
    expect(decideFile(at()).action).toBe('noop');
  });
});

describe('decideFile — absence is never authority (DDR-076, generalized)', () => {
  test('a hub that LOST a file gets it back; it does not take ours', () => {
    // The founding incident's shape: a fresh/rolled-back hub answering "I do
    // not have that" must never read as "delete yours".
    const d = decideFile(at({ local: A, remote: null, ancestor: A }));
    expect(d.action).toBe('push');
    expect(d.reason).toContain('absence is not authority');
  });

  test('and that holds even when our copy is EMPTY', () => {
    // Emptiness is just a hash here. There is no branch where "nothing" wins
    // for being nothing (DDR-223, generalized).
    expect(decideFile(at({ local: EMPTY, remote: null, ancestor: EMPTY })).action).toBe('push');
  });

  test('an empty local file the hub has content for is an ordinary PULL, not a rescue', () => {
    expect(decideFile(at({ local: EMPTY, remote: A, ancestor: EMPTY })).action).toBe('pull');
  });

  test('an empty file we just truncated is an ordinary PUSH', () => {
    expect(decideFile(at({ local: EMPTY, remote: A, ancestor: A })).action).toBe('push');
  });
});

describe('decideFile — divergence parks, never merges', () => {
  test('both moved ⇒ conflict-aside, local parked FIRST', () => {
    const d = decideFile(at({ local: B, remote: C, ancestor: A }));
    expect(d.action).toBe('conflict-aside');
    expect(d.parkLocal).toBe(true);
  });

  test('both present, differing, never reconciled here ⇒ conflict-aside', () => {
    // The first-anchor case: no ancestor to appeal to, so we cannot know who
    // moved. Guessing here is how a person loses an afternoon.
    const d = decideFile(at({ local: A, remote: B, ancestor: null }));
    expect(d.action).toBe('conflict-aside');
    expect(d.parkLocal).toBe(true);
  });
});

describe('decideFile — self-echo (why the fast lane needed a probe-guard)', () => {
  test('a remote row carrying our own in-flight hash is adopted, not fought', () => {
    const d = decideFile(at({ local: A, remote: B, ancestor: A, selfInFlight: true }));
    expect(d.action).toBe('noop');
    expect(d.adoptAncestor).toBe(true);
    expect(d.reason).toContain('own in-flight write');
  });

  test('without the self flag the same state is an ordinary pull', () => {
    expect(decideFile(at({ local: A, remote: B, ancestor: A })).action).toBe('pull');
  });
});

describe('decideFile — deletion (Syncthing rules, emission gated)', () => {
  test('deleted here and the hub still at our ancestor ⇒ HELD while emission is off', () => {
    const d = decideFile(at({ local: null, remote: A, ancestor: A }));
    expect(d.action).toBe('noop');
    expect(d.reason).toContain('holding rather than resurrecting');
  });

  test('…and PROPAGATES once emission is on', () => {
    const d = decideFile(at({ local: null, remote: A, ancestor: A, propagateDeletes: true }));
    expect(d.action).toBe('propagate-delete');
  });

  test('an EDIT beats a delete', () => {
    // Deleted here, but somebody changed it after we last saw it. Their work
    // wins over our absence, in both flag states.
    for (const propagateDeletes of [false, true]) {
      const d = decideFile(at({ local: null, remote: B, ancestor: A, propagateDeletes }));
      expect(d.action).toBe('pull');
    }
  });

  test('a tombstone we agree with QUARANTINES, never unlinks', () => {
    const d = decideFile(at({ local: A, remote: null, ancestor: A, remoteTombstone: true }));
    expect(d.action).toBe('quarantine');
  });

  test('a tombstone for something we never had is simply adopted', () => {
    const d = decideFile(at({ local: null, remote: null, ancestor: null, remoteTombstone: true }));
    expect(d.action).toBe('noop');
    expect(d.adoptAncestor).toBe(true);
  });

  test('a tombstone we disagree with REVIVES', () => {
    const d = decideFile(at({ local: B, remote: null, ancestor: A, remoteTombstone: true }));
    expect(d.action).toBe('revive');
  });

  test('a tombstone against a file we never reconciled revives too', () => {
    // No ancestor ⇒ we cannot claim the tombstone describes our bytes.
    expect(decideFile(at({ local: A, ancestor: null, remoteTombstone: true })).action).toBe(
      'revive'
    );
  });
});

describe('decideFile — a degraded epoch downgrades every overwrite', () => {
  test('a PULL over a local change becomes keep-local + park-remote', () => {
    const d = decideFile(at({ local: A, remote: B, ancestor: A, epochChanged: true }));
    expect(d.action).toBe('noop');
    expect(d.parkRemote).toBe(true);
    expect(d.parkLocal).toBeUndefined();
  });

  test('a conflict becomes keep-local + park-remote too', () => {
    const d = decideFile(at({ local: B, remote: C, ancestor: A, epochChanged: true }));
    expect(d.action).toBe('noop');
    expect(d.parkRemote).toBe(true);
  });

  test('but a file we have never had still downloads — there is nothing to endanger', () => {
    expect(decideFile(at({ local: null, remote: A, epochChanged: true })).action).toBe('pull');
  });

  test('and a push is unaffected — uploading risks nothing local', () => {
    expect(decideFile(at({ local: B, remote: A, ancestor: A, epochChanged: true })).action).toBe(
      'push'
    );
  });
});

/* ------------------------------------------------------------------------- */

describe('decideFile — TOTAL over the whole state space', () => {
  const hashes = [null, A, B, EMPTY] as const;
  const bools = [false, true] as const;

  /** Every reachable point of the space. */
  function* everyState(): Generator<FileState> {
    for (const local of hashes) {
      for (const remote of hashes) {
        for (const ancestor of hashes) {
          for (const remoteTombstone of bools) {
            for (const epochChanged of bools) {
              for (const selfInFlight of bools) {
                for (const propagateDeletes of bools) {
                  yield {
                    path: 'system/ds/x.css',
                    local,
                    remote,
                    ancestor,
                    remoteTombstone,
                    epochChanged,
                    selfInFlight,
                    propagateDeletes,
                  };
                }
              }
            }
          }
        }
      }
    }
  }

  const ALL: FileAction[] = [
    'noop',
    'pull',
    'push',
    'conflict-aside',
    'quarantine',
    'propagate-delete',
    'revive',
  ];

  test('every point produces a decision, and never throws', () => {
    let n = 0;
    for (const s of everyState()) {
      const d = decideFile(s);
      expect(ALL).toContain(d.action);
      expect(typeof d.reason).toBe('string');
      expect(d.reason.length).toBeGreaterThan(0);
      n += 1;
    }
    // 4 × 4 × 4 × 2 × 2 × 2 × 2 = 1024
    expect(n).toBe(1024);
  });

  test('INVARIANT: a local change is never overwritten without being parked', () => {
    // The eraser class, stated as a property. If the local bytes differ from
    // the ancestor, the person has unreconciled work at that path — and the
    // only decisions allowed to land remote bytes over it are the ones that
    // park local first.
    for (const s of everyState()) {
      const d = decideFile(s);
      const localHasUnreconciledWork = s.local !== null && s.local !== s.ancestor;
      const landsRemoteBytes = d.action === 'pull' || d.action === 'quarantine';
      if (localHasUnreconciledWork && landsRemoteBytes) {
        expect({ ...s, action: d.action, parkLocal: d.parkLocal }).toMatchObject({
          parkLocal: true,
        });
      }
    }
  });

  test('INVARIANT: `conflict-aside` ALWAYS parks local', () => {
    for (const s of everyState()) {
      const d = decideFile(s);
      if (d.action === 'conflict-aside') expect(d.parkLocal).toBe(true);
    }
  });

  test('INVARIANT: a delete never propagates while emission is off', () => {
    for (const s of everyState()) {
      if (s.propagateDeletes) continue;
      expect(decideFile(s).action).not.toBe('propagate-delete');
    }
  });

  test('INVARIANT: a delete NEVER propagates without an ancestor', () => {
    // No ancestor means this machine never reconciled the path, so a local
    // absence says nothing about whether it was ever here. Propagating that
    // is the branch-switch mass-delete hazard.
    for (const s of everyState()) {
      if (s.ancestor !== null) continue;
      expect(decideFile(s).action).not.toBe('propagate-delete');
    }
  });

  test('INVARIANT: nothing is pushed when there is nothing local to push', () => {
    for (const s of everyState()) {
      const d = decideFile(s);
      if (d.action === 'push' || d.action === 'revive') expect(s.local).not.toBeNull();
    }
  });

  test('INVARIANT: nothing is pulled when the hub has nothing to give', () => {
    for (const s of everyState()) {
      const d = decideFile(s);
      if (d.action === 'pull') {
        expect(s.remote).not.toBeNull();
        expect(s.remoteTombstone).toBe(false);
      }
    }
  });

  test('INVARIANT: a degraded epoch never lands remote bytes over local ones', () => {
    for (const s of everyState()) {
      if (!s.epochChanged) continue;
      const d = decideFile(s);
      if (s.local !== null && d.action === 'pull') {
        // The only pull allowed with a local file present is one where the
        // local file IS the ancestor and the tombstone is absent… and even
        // that is downgraded. So: none.
        expect(s.local).toBeNull();
      }
    }
  });

  test('INVARIANT: identical sides are always free', () => {
    for (const s of everyState()) {
      if (s.local === null || s.local !== s.remote || s.remoteTombstone) continue;
      const d = decideFile(s);
      expect(d.action).toBe('noop');
      expect(d.adoptAncestor).toBe(true);
    }
  });

  test('the decision depends on nothing but its inputs', () => {
    for (const s of everyState()) {
      expect(decideFile({ ...s })).toEqual(decideFile({ ...s }));
    }
  });
});

/* ------------------------------------------------------------------------- */

describe('conflict copies are attributable, and never mistaken for Syncthing’s', () => {
  test('the name carries the path, a timestamp and a label', () => {
    const name = conflictCopyName('system/ds/brand.css', Date.UTC(2026, 7, 17, 9, 30, 0), 'laptop');
    expect(name).toBe('system/ds/brand.maude-conflict-2026-08-17T09-30-00-000-laptop.css');
  });

  test('and it is NEVER Syncthing’s pattern', () => {
    // `~/git` runs real Syncthing. Emitting `*.sync-conflict-*` would make a
    // conflict unattributable — you could not tell which program parked the
    // file — and would invite the classifier to sync Syncthing's own copies.
    const name = conflictCopyName('a/b.png', Date.now(), 'x');
    expect(name).not.toContain('sync-conflict');
    expect(isMaudeConflictCopy(name)).toBe(true);
    expect(isMaudeConflictCopy('a/b.sync-conflict-20260807-113434-WELXGEB.png')).toBe(false);
  });

  test('a hostile label cannot escape the filename', () => {
    const name = conflictCopyName('a/b.png', 0, '../../etc/passwd');
    expect(name).not.toContain('..');
    expect(name).not.toContain('/etc/');
    expect(name.startsWith('a/')).toBe(true);
  });

  test('multi-dot names keep their whole extension', () => {
    const name = conflictCopyName('assets/x.photo.json', 0, 'p');
    expect(name.endsWith('.photo.json')).toBe(true);
  });

  test('an extensionless file still gets a usable name', () => {
    expect(conflictCopyName('LICENSE', 0, 'p')).toContain('LICENSE.maude-conflict-');
  });
});

describe('B6 (post-1.0 burn-down) — a degraded epoch damps the deletion row too', () => {
  test('a tombstone we would agree with HOLDS under a degraded epoch', () => {
    const d = decideFile({
      local: 'X',
      remote: null,
      ancestor: 'X',
      remoteTombstone: true,
      epochChanged: true,
    });
    // The "agreement" is local === ancestor, and the degrade just
    // disqualified exactly those ancestors — no quarantine on their strength.
    expect(d.action).toBe('noop');
    expect(d.reason).toContain('degraded');
  });

  test('the same tombstone quarantines on a CLEAN epoch (the damp is the delta)', () => {
    const d = decideFile({
      local: 'X',
      remote: null,
      ancestor: 'X',
      remoteTombstone: true,
      epochChanged: false,
    });
    expect(d.action).toBe('quarantine');
  });

  test('a tombstone for a file this machine does not have stays a noop either way', () => {
    for (const epochChanged of [true, false]) {
      const d = decideFile({
        local: null,
        remote: null,
        ancestor: 'X',
        remoteTombstone: true,
        epochChanged,
      });
      expect(d.action).toBe('noop');
    }
  });

  test('a CONTESTED tombstone still revives under degrade — an edit beats a delete regardless', () => {
    const d = decideFile({
      local: 'Y',
      remote: null,
      ancestor: 'X',
      remoteTombstone: true,
      epochChanged: true,
    });
    expect(d.action).toBe('revive');
  });
});
