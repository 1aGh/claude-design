// Sync journal unit tests — hub-sync cold-start safety (DDR-102).
//
// The journal is the divergence detector's memory: it records, per slug, the
// content hash this machine last reconciled disk↔doc. These tests cover the
// load/record/flush/invalidate API, the corrupt-file → absent posture, and
// the per-hub invalidation rule.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { hashBytes } from '../sync/echo-guard.ts';
import { journalPath, loadJournal, type SyncJournal } from '../sync/journal.ts';

let dir: string;
let journal: SyncJournal | null = null;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sync-journal-'));
  journal = null;
});

afterEach(() => {
  journal?.stop();
  rmSync(dir, { recursive: true, force: true });
});

describe('loadJournal — basic API', () => {
  test('get returns null for a never-recorded slug', () => {
    journal = loadJournal(dir, { flushMs: 0 });
    expect(journal.get('ui-maskot')).toBeNull();
  });

  test('record + get round-trip with bodyHash and optional cssHash', () => {
    journal = loadJournal(dir, { flushMs: 0, now: () => 42 });
    const bodyHash = hashBytes('<div>v1</div>');
    journal.record('ui-maskot', { bodyHash });
    expect(journal.get('ui-maskot')).toEqual({ bodyHash, at: 42 });

    const cssHash = hashBytes('.a{}');
    journal.record('ui-maskot', { bodyHash, cssHash });
    expect(journal.get('ui-maskot')).toEqual({ bodyHash, cssHash, at: 42 });
  });

  test('flush persists to <designRoot>/_state/sync-journal.json, creating _state/ on demand', () => {
    journal = loadJournal(dir, { flushMs: 0 });
    expect(existsSync(join(dir, '_state'))).toBe(false);
    journal.record('ui-a', { bodyHash: 'h1' });

    const file = journalPath(dir);
    expect(existsSync(file)).toBe(true);
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    expect(parsed.slugs['ui-a'].bodyHash).toBe('h1');
    expect(typeof parsed.updatedAt).toBe('number');
  });

  test('a fresh journal instance reads back what a previous one persisted', () => {
    const first = loadJournal(dir, { flushMs: 0, now: () => 7 });
    first.record('ui-a', { bodyHash: 'h1' });
    first.stop();

    journal = loadJournal(dir);
    expect(journal.get('ui-a')).toEqual({ bodyHash: 'h1', at: 7 });
    expect(journal.size()).toBe(1);
  });

  test('debounces rapid records into one write', async () => {
    let writes = 0;
    journal = loadJournal(dir, {
      flushMs: 20,
      writer: () => {
        writes++;
      },
    });
    for (let i = 0; i < 10; i++) journal.record('ui-a', { bodyHash: `h${i}` });
    expect(writes).toBe(0); // still pending
    await new Promise((res) => setTimeout(res, 60));
    expect(writes).toBe(1);
  });

  test('stop() flushes the pending debounce', () => {
    let written: string | null = null;
    journal = loadJournal(dir, {
      flushMs: 10_000,
      writer: (_p, bytes) => {
        written = bytes;
      },
    });
    journal.record('ui-a', { bodyHash: 'h1' });
    expect(written).toBeNull();
    journal.stop();
    expect(written).not.toBeNull();
    expect(JSON.parse(written as unknown as string).slugs['ui-a'].bodyHash).toBe('h1');
  });
});

describe('loadJournal — corrupt / hostile file posture', () => {
  test('corrupt JSON → treated as absent, never throws', () => {
    const file = journalPath(dir);
    // Persist a valid journal first (creates _state/), then corrupt it.
    journal = loadJournal(dir, { flushMs: 0 });
    journal.record('ui-a', { bodyHash: 'h1' });
    journal.stop();

    writeFileSync(file, '{not json');
    journal = loadJournal(dir);
    expect(journal.get('ui-a')).toBeNull();
    expect(journal.size()).toBe(0);
  });

  test('wrong-shape JSON (array / non-object slugs / bad entries) → absent entries', () => {
    const file = journalPath(dir);
    journal = loadJournal(dir, { flushMs: 0 });
    journal.record('seed', { bodyHash: 'x' }); // creates _state/
    journal.stop();

    writeFileSync(file, JSON.stringify([1, 2, 3]));
    expect(loadJournal(dir).size()).toBe(0);

    writeFileSync(file, JSON.stringify({ hubUrl: 1, slugs: { 'ui-a': { bodyHash: 99 } } }));
    const j = loadJournal(dir);
    expect(j.get('ui-a')).toBeNull();
    expect(j.size()).toBe(0);
  });

  test('writer failure is swallowed (never throws into the sync path)', () => {
    journal = loadJournal(dir, {
      flushMs: 0,
      writer: () => {
        throw new Error('disk full');
      },
    });
    expect(() => journal?.record('ui-a', { bodyHash: 'h1' })).not.toThrow();
    expect(journal.get('ui-a')?.bodyHash).toBe('h1'); // in-memory state intact
  });
});

describe('loadJournal — per-hub invalidation', () => {
  test('first invalidateIfHubChanged adopts the URL without wiping', () => {
    journal = loadJournal(dir, { flushMs: 0 });
    journal.record('ui-a', { bodyHash: 'h1' });
    journal.invalidateIfHubChanged('https://hub.example.com');
    expect(journal.get('ui-a')?.bodyHash).toBe('h1');
  });

  test('same hub URL on a later boot keeps entries', () => {
    const first = loadJournal(dir, { flushMs: 0 });
    first.invalidateIfHubChanged('https://hub.example.com');
    first.record('ui-a', { bodyHash: 'h1' });
    first.stop();

    journal = loadJournal(dir, { flushMs: 0 });
    journal.invalidateIfHubChanged('https://hub.example.com');
    expect(journal.get('ui-a')?.bodyHash).toBe('h1');
  });

  test('a DIFFERENT hub URL wipes every entry (hashes are per-hub)', () => {
    const first = loadJournal(dir, { flushMs: 0 });
    first.invalidateIfHubChanged('https://hub-one.example.com');
    first.record('ui-a', { bodyHash: 'h1' });
    first.record('ui-b', { bodyHash: 'h2' });
    first.stop();

    journal = loadJournal(dir, { flushMs: 0 });
    journal.invalidateIfHubChanged('https://hub-two.example.com');
    expect(journal.get('ui-a')).toBeNull();
    expect(journal.get('ui-b')).toBeNull();
    expect(journal.size()).toBe(0);

    // …and the wipe is persisted.
    const parsed = JSON.parse(readFileSync(journalPath(dir), 'utf8'));
    expect(parsed.hubUrl).toBe('https://hub-two.example.com');
    expect(Object.keys(parsed.slugs)).toHaveLength(0);
  });
});
