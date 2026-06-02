// Atomic-write unit tests — Phase 9 Task 4.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { atomicWrite } from '../sync/atomic-write.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'atomic-write-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('atomicWrite', () => {
  test('writes UTF-8 string to a new path', () => {
    const p = join(dir, 'a.html');
    atomicWrite(p, '<button>hi</button>');
    expect(readFileSync(p, 'utf8')).toBe('<button>hi</button>');
  });

  test('writes Uint8Array bytes verbatim', () => {
    const p = join(dir, 'b.html');
    const bytes = new TextEncoder().encode('<div>x</div>');
    atomicWrite(p, bytes);
    expect(readFileSync(p, 'utf8')).toBe('<div>x</div>');
  });

  test('overwrites existing files atomically (no partial-write window)', () => {
    const p = join(dir, 'c.html');
    writeFileSync(p, 'old');
    atomicWrite(p, 'new');
    expect(readFileSync(p, 'utf8')).toBe('new');
  });

  test('cleans up the .tmp sidecar after a successful write', () => {
    const p = join(dir, 'd.html');
    atomicWrite(p, 'final');
    const leftovers = readdirSync(dir).filter((f) => f.startsWith('d.html.tmp.'));
    expect(leftovers).toEqual([]);
  });

  test('rapid sequential writes converge on the last value', () => {
    const p = join(dir, 'e.html');
    for (let i = 0; i < 50; i++) {
      atomicWrite(p, `v${i}`);
    }
    expect(readFileSync(p, 'utf8')).toBe('v49');
    const leftovers = readdirSync(dir).filter((f) => f.startsWith('e.html.tmp.'));
    expect(leftovers).toEqual([]);
  });

  test('returns the path it wrote', () => {
    const p = join(dir, 'f.html');
    expect(atomicWrite(p, 'x')).toBe(p);
  });
});
