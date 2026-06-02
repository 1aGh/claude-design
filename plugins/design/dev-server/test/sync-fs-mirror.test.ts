// fs-mirror unit tests — Phase 9 Task 4.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { hashBytes } from '../sync/echo-guard.ts';
import { createFsReader } from '../sync/fs-mirror.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fs-mirror-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const ACCEPT_ALL = () => true;

describe('createFsReader', () => {
  test('reads file bytes + hash after the quiet window', async () => {
    writeFileSync(join(dir, 'a.html'), 'hello');
    const events: { path: string; bytes: Uint8Array; hash: string }[] = [];
    const r = createFsReader({
      rootDir: dir,
      quietMs: 10,
      accept: ACCEPT_ALL,
      onRead: (e) => {
        events.push(e);
      },
    });
    r.notify('a.html');
    await new Promise((res) => setTimeout(res, 50));

    expect(events.length).toBe(1);
    expect(events[0].path).toBe('a.html');
    expect(new TextDecoder().decode(events[0].bytes)).toBe('hello');
    expect(events[0].hash).toBe(hashBytes('hello'));
    r.stop();
  });

  test('debounces rapid notify() calls on the same path', async () => {
    writeFileSync(join(dir, 'b.html'), 'v0');
    const events: { path: string; hash: string }[] = [];
    const r = createFsReader({
      rootDir: dir,
      quietMs: 30,
      accept: ACCEPT_ALL,
      onRead: (e) => {
        events.push({ path: e.path, hash: e.hash });
      },
    });
    // 5 notify calls within 5ms should collapse to one read.
    for (let i = 0; i < 5; i++) r.notify('b.html');
    expect(r.pending()).toBe(1);
    await new Promise((res) => setTimeout(res, 80));
    expect(events.length).toBe(1);
    r.stop();
  });

  test('reads the latest disk content after the quiet window (not stale)', async () => {
    const p = join(dir, 'c.html');
    writeFileSync(p, 'old');
    const events: string[] = [];
    const r = createFsReader({
      rootDir: dir,
      quietMs: 20,
      accept: ACCEPT_ALL,
      onRead: (e) => {
        events.push(new TextDecoder().decode(e.bytes));
      },
    });
    r.notify('c.html');
    // Update the file BEFORE the quiet window elapses — the read should see
    // the new content.
    writeFileSync(p, 'new');
    await new Promise((res) => setTimeout(res, 50));
    expect(events).toEqual(['new']);
    r.stop();
  });

  test('per-path isolation — different paths debounce independently', async () => {
    writeFileSync(join(dir, 'd.html'), 'a');
    writeFileSync(join(dir, 'e.html'), 'b');
    const paths: string[] = [];
    const r = createFsReader({
      rootDir: dir,
      quietMs: 10,
      accept: ACCEPT_ALL,
      onRead: (e) => {
        paths.push(e.path);
      },
    });
    r.notify('d.html');
    r.notify('e.html');
    expect(r.pending()).toBe(2);
    await new Promise((res) => setTimeout(res, 50));
    expect(paths.sort()).toEqual(['d.html', 'e.html']);
    r.stop();
  });

  test('accept() filter rejects paths before any timer fires', async () => {
    writeFileSync(join(dir, 'skipme.css'), 'x');
    let fired = false;
    const r = createFsReader({
      rootDir: dir,
      quietMs: 10,
      accept: (p) => p.endsWith('.html'),
      onRead: () => {
        fired = true;
      },
    });
    r.notify('skipme.css');
    expect(r.pending()).toBe(0);
    await new Promise((res) => setTimeout(res, 50));
    expect(fired).toBe(false);
    r.stop();
  });

  test('onDeleted fires when the file is gone by the time the timer pops', async () => {
    writeFileSync(join(dir, 'goner.html'), 'bye');
    const deleted: string[] = [];
    const reads: string[] = [];
    const r = createFsReader({
      rootDir: dir,
      quietMs: 20,
      accept: ACCEPT_ALL,
      onRead: (e) => {
        reads.push(e.path);
      },
      onDeleted: (p) => {
        deleted.push(p);
      },
    });
    r.notify('goner.html');
    rmSync(join(dir, 'goner.html'));
    await new Promise((res) => setTimeout(res, 60));
    expect(deleted).toEqual(['goner.html']);
    expect(reads).toEqual([]);
    r.stop();
  });

  test('stop() cancels pending timers', async () => {
    writeFileSync(join(dir, 'h.html'), 'x');
    let fired = false;
    const r = createFsReader({
      rootDir: dir,
      quietMs: 20,
      accept: ACCEPT_ALL,
      onRead: () => {
        fired = true;
      },
    });
    r.notify('h.html');
    r.stop();
    await new Promise((res) => setTimeout(res, 50));
    expect(fired).toBe(false);
  });

  test('flush() fires all pending timers immediately', async () => {
    writeFileSync(join(dir, 'i.html'), 'x');
    writeFileSync(join(dir, 'j.html'), 'y');
    const reads: string[] = [];
    const r = createFsReader({
      rootDir: dir,
      quietMs: 10000, // long enough that the test would time out without flush
      accept: ACCEPT_ALL,
      onRead: (e) => {
        reads.push(e.path);
      },
    });
    r.notify('i.html');
    r.notify('j.html');
    await r.flush();
    expect(reads.sort()).toEqual(['i.html', 'j.html']);
    r.stop();
  });
});
