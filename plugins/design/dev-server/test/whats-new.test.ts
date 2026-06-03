import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { bestSeenVersion, computeUnseen, parseVer, verGt } from '../client/whats-new-seen.js';
import { loadWhatsNew, resolveMaudeVersion } from '../whats-new.ts';

describe('whats-new feed loader', () => {
  test('loads the committed feed with a version + non-empty entries', () => {
    const feed = loadWhatsNew({ fresh: true });
    expect(typeof feed.version).toBe('string');
    expect(Array.isArray(feed.entries)).toBe(true);
    expect(feed.entries.length).toBeGreaterThan(0);
  });

  test('every entry has the required shape', () => {
    for (const e of loadWhatsNew({ fresh: true }).entries) {
      expect(typeof e.id).toBe('string');
      expect(e.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(['feature', 'improvement', 'usage', 'fix']).toContain(e.kind);
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.summary.length).toBeGreaterThan(0);
    }
  });

  test('resolveMaudeVersion reads the design plugin manifest', () => {
    expect(resolveMaudeVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('a missing feed dir yields empty entries and never throws', () => {
    const feed = loadWhatsNew({ root: join(import.meta.dir, '__does-not-exist__'), fresh: true });
    expect(feed.entries).toEqual([]);
  });
});

describe('seen logic (browser-safe, shared with the client)', () => {
  test('parseVer extracts a semver triple', () => {
    expect(parseVer('0.28.1')).toEqual([0, 28, 1]);
    expect(parseVer('1.2.3-beta.4')).toEqual([1, 2, 3]);
    expect(parseVer('dev')).toBeNull();
  });

  test('verGt compares semver, treating unparseable seen as oldest', () => {
    expect(verGt('0.29.0', '0.28.1')).toBe(true);
    expect(verGt('0.28.1', '0.29.0')).toBe(false);
    expect(verGt('1.0.0', '0.99.99')).toBe(true);
    expect(verGt('0.28.1', '0.28.1')).toBe(false);
    expect(verGt('0.28.1', 'dev')).toBe(true);
    expect(verGt('dev', '0.28.1')).toBe(false);
  });

  test('pending (null version) entries are always unseen', () => {
    const u = computeUnseen(
      [{ id: 'a', version: null, kind: 'feature', title: 't', summary: 's' }],
      '9.9.9'
    );
    expect(u.map((e) => e.id)).toEqual(['a']);
  });

  test('computeUnseen returns only entries newer than the seen version', () => {
    const entries = [
      { id: 'old', version: '0.27.0', kind: 'feature', title: 't', summary: 's' },
      { id: 'new', version: '0.29.0', kind: 'feature', title: 't', summary: 's' },
    ];
    expect(computeUnseen(entries, '0.28.0').map((e) => e.id)).toEqual(['new']);
    expect(computeUnseen(entries, '0.29.0')).toEqual([]);
  });

  test('bestSeenVersion picks the highest of feed + entry versions', () => {
    expect(bestSeenVersion([{ version: '0.29.0' }, { version: '0.27.0' }], '0.28.1')).toBe(
      '0.29.0'
    );
    expect(bestSeenVersion([{ version: '0.20.0' }], '0.28.1')).toBe('0.28.1');
    expect(bestSeenVersion([{ version: null }], '0.28.1')).toBe('0.28.1');
  });
});
