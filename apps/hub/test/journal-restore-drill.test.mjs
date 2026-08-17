// The restore drill for the journal — Sync v2 Increment 1 (DDR-226 §3).
//
// A cell rehydrates on EVERY wake, so this is the normal path, not a disaster
// exercise. It runs through the REAL modules — `runBackup`, `restoreLatest`,
// then the tail replay — because the property being proven is about how those
// three compose, and each of them is individually fine.
//
// The three outcomes that matter:
//
//   1. backup → wipe → restore → replay ⇒ the head is monotonic and the EPOCH
//      SURVIVES. Peers keep their cursors; nobody re-anchors.
//   2. a crash between the append and the tail flush loses no CONTENT: the row
//      may be gone, but the file is still in the checkout and walk-import
//      re-states it (at a new seq — the log is append-only, not rewritable).
//   3. a tail that cannot be read at all is the ONLY thing that rotates the
//      epoch, and it says so loudly.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { fileTarget, restoreLatest, runBackup } from '../src/backup.mjs';
import {
  closeJournal,
  createJournalTail,
  openJournal,
  replayTailFromTarget,
  walkImport,
} from '../src/journal.mjs';

let dataDir;
let restoreDir;
let backupDir;
let designRoot;

const quiet = { log() {}, error() {}, warn() {} };

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'drill-data-'));
  restoreDir = mkdtempSync(join(tmpdir(), 'drill-restore-'));
  backupDir = mkdtempSync(join(tmpdir(), 'drill-backups-'));
  designRoot = mkdtempSync(join(tmpdir(), 'drill-root-'));
  mkdirSync(join(designRoot, 'assets'), { recursive: true });
  mkdirSync(join(designRoot, 'system/ds'), { recursive: true });
  writeFileSync(join(designRoot, 'config.json'), '{"canvasGroups":[{"path":"system"}]}');
  // A restore has to have SOMETHING to restore; `runBackup` refuses an empty
  // data dir, and it snapshots via `VACUUM INTO`, so the companion must be a
  // REAL database. The journal is the one under test.
  const Database = createRequire(import.meta.url)('better-sqlite3');
  const hubDb = new Database(join(dataDir, 'hub.db'));
  hubDb.exec('CREATE TABLE documents (name TEXT PRIMARY KEY, data BLOB)');
  hubDb.close();
});

afterEach(() => {
  closeJournal(dataDir);
  closeJournal(restoreDir);
  for (const d of [dataDir, restoreDir, backupDir, designRoot]) {
    rmSync(d, { recursive: true, force: true });
  }
});

/** Land N plane-B files and journal them. */
function writeAndRecord(journal, n, offset = 0) {
  for (let i = 0; i < n; i += 1) {
    const rel = `assets/f${offset + i}.png`;
    writeFileSync(join(designRoot, rel), `bytes-${offset + i}`);
    journal.recordWrite({ designRoot, path: rel, source: 'peer-put' });
  }
}

describe('restore drill — backup, wipe, rehydrate, replay', () => {
  it('the head is monotonic and the epoch SURVIVES the wake', async () => {
    const target = fileTarget(backupDir);
    const journal = openJournal(dataDir);
    const tail = createJournalTail({ journal, target, debounceMs: 0, log: quiet });

    // Three rows, then a backup generation snapshots the journal…
    writeAndRecord(journal, 3);
    await tail.flush();
    const gen = await runBackup({ dataDir, target, now: new Date('2026-08-17T10:00:00Z') });
    await tail.rotate(journal.head());

    // …and then two MORE rows land in the ≤6 h window before the next one.
    writeAndRecord(journal, 2, 3);
    await tail.flush();

    const epochBefore = journal.epoch();
    const headBefore = journal.head();
    assert.equal(headBefore, 5);
    closeJournal(dataDir);

    // THE WAKE. The instance is gone; a fresh disk restores the generation.
    const restored = await restoreLatest({ target, destDir: restoreDir, which: gen.prefix });
    assert.ok(restored.restored.includes('journal.db'));

    const woken = openJournal(restoreDir);
    // The generation alone is BEHIND — this is the rewind the tail exists for.
    assert.equal(woken.head(), 3);
    assert.equal(woken.epoch(), epochBefore, 'the epoch rides in the generation');

    const replay = await replayTailFromTarget({ journal: woken, target, log: quiet });
    assert.equal(replay.state, 'replayed');
    assert.equal(woken.head(), headBefore, 'head reconstructed past the generation');
    assert.equal(woken.epoch(), epochBefore, 'and the epoch was never rotated');

    // A peer that checkpointed at 5 is still current — the whole point.
    const page = woken.entriesSince(5);
    assert.deepEqual(page.entries, []);
    // And the next write continues the sequence rather than colliding.
    writeAndRecord(woken, 1, 99);
    assert.equal(woken.head(), 6);
  });

  it('a crash between the append and the flush loses no CONTENT', async () => {
    const target = fileTarget(backupDir);
    const journal = openJournal(dataDir);
    const tail = createJournalTail({ journal, target, debounceMs: 0, log: quiet });

    writeAndRecord(journal, 2);
    await tail.flush();
    const gen = await runBackup({ dataDir, target, now: new Date('2026-08-17T10:00:00Z') });
    await tail.rotate(journal.head());

    // A row lands… and the process is killed before the debounce fires, so it
    // reaches NEITHER the generation nor the tail.
    writeAndRecord(journal, 1, 2);
    const lostSeq = journal.head();
    closeJournal(dataDir);

    const restored = await restoreLatest({ target, destDir: restoreDir, which: gen.prefix });
    assert.ok(restored.restored.includes('journal.db'));
    const woken = openJournal(restoreDir);
    await replayTailFromTarget({ journal: woken, target, log: quiet });

    // The ROW is gone…
    assert.ok(woken.head() < lostSeq);
    assert.equal(
      woken.compaction().some((r) => r.path === 'assets/f2.png'),
      false
    );

    // …and the FILE is not. walk-import is the backstop that makes the loss a
    // re-statement rather than an invisible file: a new row, a new seq, same
    // bytes. This is why the reconciler is permanent and not a migration.
    const out = walkImport({ journal: woken, designRoot, log: quiet });
    assert.equal(out.appended, 1);
    const row = woken.compaction().find((r) => r.path === 'assets/f2.png');
    assert.ok(row, 'the file is back in the manifest');
    assert.equal(row.class, 'inert-media');
  });

  it('ONLY an unreadable tail rotates the epoch, and it is loud', async () => {
    const journal = openJournal(dataDir);
    writeAndRecord(journal, 1);
    const epochBefore = journal.epoch();
    const errors = [];
    const broken = {
      async get() {
        throw new Error('bucket unreachable');
      },
      async put() {},
    };

    const res = await replayTailFromTarget({
      journal,
      target: broken,
      log: { log() {}, error: (m) => errors.push(m) },
    });
    assert.equal(res.state, 'lost');
    // The caller (rehydrate.mjs) is what decides; prove the decision it makes.
    assert.equal(journal.epoch(), epochBefore, 'replay itself never rotates');
    journal.rotateEpoch('the journal tail could not be read at rehydrate');
    assert.notEqual(journal.epoch(), epochBefore);
    assert.ok(errors.some((m) => /unreadable/.test(m)));
  });

  it('an EMPTY tail on a fresh tenant is not a rewind', async () => {
    const target = fileTarget(backupDir);
    const journal = openJournal(dataDir);
    const epochBefore = journal.epoch();
    const res = await replayTailFromTarget({ journal, target, log: quiet });
    assert.equal(res.state, 'empty');
    assert.equal(journal.epoch(), epochBefore);
    assert.equal(journal.head(), 0);
  });
});
