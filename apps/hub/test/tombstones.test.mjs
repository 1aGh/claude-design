// The absence half of the sync protocol — see src/tombstones.mjs.
//
// The bug it exists for: deleting a canvas was a local file move nobody told the
// hub about, and any document ON the hub is authority to write the file back. So
// a delete came back on the next discovery tick.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  clearTombstone,
  closeTombstones,
  isTombstoned,
  listTombstones,
  recordTombstone,
  TOMBSTONE_TTL_MS,
} from '../src/tombstones.mjs';

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'maude-tombstones-'));
});

afterEach(() => {
  closeTombstones(dir);
  rmSync(dir, { recursive: true, force: true });
});

describe('tombstones', () => {
  it('records a deletion and reports it', () => {
    assert.equal(recordTombstone(dir, 'ui-gone'), true);
    assert.equal(isTombstoned(dir, 'ui-gone'), true);
    assert.deepEqual(
      listTombstones(dir).map((t) => t.name),
      ['ui-gone']
    );
  });

  it('a name nobody deleted is not tombstoned', () => {
    recordTombstone(dir, 'ui-gone');
    assert.equal(isTombstoned(dir, 'ui-still-here'), false);
  });

  it('is idempotent — a retried delete refreshes rather than errors', () => {
    recordTombstone(dir, 'ui-gone', { now: 1000 });
    recordTombstone(dir, 'ui-gone', { now: 5000 });
    const all = listTombstones(dir, { now: 5000 });
    assert.equal(all.length, 1);
    assert.equal(all[0].deletedAt, 5000);
  });

  it('re-creating a name clears its gravestone', () => {
    // Without this, "delete a canvas then make a new one with the same name"
    // would be trashed by every peer for the whole retention window.
    recordTombstone(dir, 'ui-gone');
    assert.equal(clearTombstone(dir, 'ui-gone'), true);
    assert.equal(isTombstoned(dir, 'ui-gone'), false);
    assert.deepEqual(listTombstones(dir), []);
  });

  it('expires past the retention window', () => {
    const t0 = 1_000_000;
    recordTombstone(dir, 'ui-gone', { now: t0 });
    const later = t0 + TOMBSTONE_TTL_MS + 1;
    assert.equal(isTombstoned(dir, 'ui-gone', { now: later }), false);
    assert.deepEqual(listTombstones(dir, { now: later }), []);
  });

  it('refuses a name outside the document charset at the WRITE boundary', () => {
    // A tombstone is consumed as an instruction to trash a local file, so the
    // shape gate applies going in, not only coming out.
    assert.equal(recordTombstone(dir, '../../etc/passwd'), false);
    assert.equal(recordTombstone(dir, 'ui gone; rm -rf'), false);
    assert.equal(recordTombstone(dir, ''), false);
    assert.equal(recordTombstone(dir, 42), false);
    assert.deepEqual(listTombstones(dir), []);
  });

  it('keeps a project’s deletions in insertion order, oldest first', () => {
    recordTombstone(dir, 'ui-b', { now: 2000 });
    recordTombstone(dir, 'ui-a', { now: 1000 });
    assert.deepEqual(
      listTombstones(dir, { now: 3000 }).map((t) => t.name),
      ['ui-a', 'ui-b']
    );
  });
});
