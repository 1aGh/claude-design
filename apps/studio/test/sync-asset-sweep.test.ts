// The PARENT half of the out-of-process asset sweep.
//
// The child's own contract is `sync-asset-push-worker.test.ts`; here the child
// is a stand-in script, because what needs pinning is the parent's behaviour
// when that child misbehaves — and a real sweep cannot be made to segfault on
// demand. Every case below is a way the sweep can end, and the property under
// test is the same one each time: the parent always produces a FINAL emit, so
// the panel can never sit at "92 of 182" forever.

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AssetPushProgress } from '../sync/asset-push.ts';
import { assetWorkerScript, runAssetSweep } from '../sync/asset-sweep.ts';

const dirs: string[] = [];

/** Write a stand-in child and return its path. */
function fakeChild(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-parent-'));
  dirs.push(dir);
  const p = join(dir, 'child.ts');
  writeFileSync(p, body);
  return p;
}

function progressLine(over: Partial<AssetPushProgress> = {}): string {
  const base = {
    t: 'progress',
    total: 3,
    done: 1,
    pushed: 1,
    skipped: 0,
    failedCount: 0,
    failures: [],
    active: 'system/ds/assets/logos/a.svg',
    finished: false,
  };
  return JSON.stringify({ ...base, ...over });
}

function sweep(script: string, onProgress: (p: AssetPushProgress) => void) {
  const designRoot = mkdtempSync(join(tmpdir(), 'sweep-root-'));
  dirs.push(designRoot);
  return runAssetSweep({
    designRoot,
    hubUrl: 'https://hub.example',
    token: () => 'secret-token',
    onProgress,
    script,
    log: { log: () => {}, warn: () => {} },
  });
}

describe('a sweep that finishes', () => {
  test('progress reaches the panel and the result comes back', async () => {
    const seen: AssetPushProgress[] = [];
    const child = fakeChild(`
      process.stdout.write(${JSON.stringify(`${progressLine()}\n`)});
      process.stdout.write(${JSON.stringify(`${progressLine({ done: 3, pushed: 3, active: null, finished: true })}\n`)});
      process.stdout.write(JSON.stringify({ t: 'result', pushed: ['a', 'b', 'c'], skipped: 0, failed: [] }) + '\\n');
    `);
    const result = await sweep(child, (p) => seen.push(p)).done;

    expect(result).toEqual({ pushed: ['a', 'b', 'c'], skipped: 0, failed: [] });
    expect(seen.length).toBe(2);
    expect(seen[1].finished).toBe(true);
  });

  test('unparseable output is dropped, not fatal', async () => {
    const seen: AssetPushProgress[] = [];
    const child = fakeChild(`
      process.stdout.write('a stray console.log from an import\\n');
      process.stdout.write(${JSON.stringify(`${progressLine()}\n`)});
      process.stdout.write('{ half a li');
      process.stdout.write('ne }\\n');
      process.stdout.write(JSON.stringify({ t: 'result', pushed: [], skipped: 1, failed: [] }) + '\\n');
    `);
    const result = await sweep(child, (p) => seen.push(p)).done;

    expect(result).toEqual({ pushed: [], skipped: 1, failed: [] });
    expect(seen.length).toBe(1);
  });
});

describe('a sweep that dies is a REPORTED failure, never a stall', () => {
  test('a signalled child names the signal in the final emit', async () => {
    const seen: AssetPushProgress[] = [];
    const child = fakeChild(`
      process.stdout.write(${JSON.stringify(`${progressLine({ done: 92, total: 182, pushed: 92 })}\n`)});
      await Bun.sleep(20);
      process.kill(process.pid, 'SIGKILL');
      await new Promise(() => {});
    `);
    const result = await sweep(child, (p) => seen.push(p)).done;

    expect(result).toBeNull();
    const final = seen[seen.length - 1];
    expect(final.finished).toBe(true);
    // The counts it got to are KEPT — the person is told where it stopped.
    expect(final.done).toBe(92);
    expect(final.total).toBe(182);
    expect(final.failedCount).toBe(1);
    expect(final.failures[0].reason).toContain('SIGKILL');
    expect(final.active).toBeNull();
  });

  test('a child that reports an error carries the message through', async () => {
    const seen: AssetPushProgress[] = [];
    const child = fakeChild(`
      process.stdout.write(JSON.stringify({ t: 'error', message: 'the design root vanished' }) + '\\n');
      process.exit(1);
    `);
    const result = await sweep(child, (p) => seen.push(p)).done;

    expect(result).toBeNull();
    expect(seen[seen.length - 1].failures[0].reason).toContain('the design root vanished');
  });

  test('a missing worker script is reported — never a silent in-process fallback', async () => {
    const seen: AssetPushProgress[] = [];
    const result = await sweep(join(tmpdir(), 'no-such-worker-xyz.ts'), (p) => seen.push(p)).done;

    expect(result).toBeNull();
    expect(seen.length).toBe(1);
    expect(seen[0].finished).toBe(true);
    expect(seen[0].failedCount).toBe(1);
  });

  test('a result line with a non-zero exit is NOT trusted as success', async () => {
    const seen: AssetPushProgress[] = [];
    const child = fakeChild(`
      process.stdout.write(JSON.stringify({ t: 'result', pushed: ['a'], skipped: 0, failed: [] }) + '\\n');
      process.exit(3);
    `);
    const result = await sweep(child, (p) => seen.push(p)).done;

    expect(result).toBeNull();
    expect(seen[seen.length - 1].failures[0].reason).toContain('3');
  });
});

describe('cancel ends the sweep, and says that is what happened', () => {
  test('a wedged child is killed and the lane closes as cancelled', async () => {
    const seen: AssetPushProgress[] = [];
    const child = fakeChild(`
      process.stdout.write(${JSON.stringify(`${progressLine()}\n`)});
      await new Promise(() => {});
    `);
    const handle = sweep(child, (p) => seen.push(p));
    // Wait for the first emit so the child is definitely alive — BOUNDED, so a
    // machine that cannot spawn fails this test instead of hanging the suite.
    for (let i = 0; seen.length === 0 && i < 500; i++) await Bun.sleep(10);
    expect(seen.length).toBeGreaterThan(0);
    handle.cancel();
    const result = await handle.done;

    expect(result).toBeNull();
    const final = seen[seen.length - 1];
    expect(final.finished).toBe(true);
    expect(final.failures[0].reason).toBe('cancelled');
  });

  test('cancel is idempotent and safe after the sweep already ended', async () => {
    const child = fakeChild(
      `process.stdout.write(JSON.stringify({ t: 'result', pushed: [], skipped: 0, failed: [] }) + '\\n');`
    );
    const handle = sweep(child, () => {});
    await handle.done;
    expect(() => {
      handle.cancel();
      handle.cancel();
    }).not.toThrow();
  });
});

describe('the credential never touches argv', () => {
  test('the token goes to a 0600 file that is gone when the sweep ends', async () => {
    let sawArgv = '';
    let sawToken = '';
    let sawMode = '';
    const child = fakeChild(`
      const { readFileSync, statSync } = await import('node:fs');
      const tokenFile = process.argv[4];
      process.stdout.write(JSON.stringify({
        t: 'result', pushed: [], skipped: 0,
        failed: [
          { key: 'argv', reason: process.argv.slice(2).join(' ') },
          { key: 'token', reason: readFileSync(tokenFile, 'utf8') },
          { key: 'mode', reason: (statSync(tokenFile).mode & 0o777).toString(8) },
          { key: 'file', reason: tokenFile },
        ],
      }) + '\\n');
    `);
    const result = await sweep(child, () => {});
    const failed = (await result.done)?.failed ?? [];
    sawArgv = failed.find((f) => f.key === 'argv')?.reason ?? '';
    sawToken = failed.find((f) => f.key === 'token')?.reason ?? '';
    sawMode = failed.find((f) => f.key === 'mode')?.reason ?? '';
    const tokenFile = failed.find((f) => f.key === 'file')?.reason ?? '';

    expect(sawToken).toBe('secret-token');
    // `ps` shows argv to every user on the machine.
    expect(sawArgv).not.toContain('secret-token');
    expect(sawMode).toBe('600');
    expect(existsSync(tokenFile)).toBe(false);
  });
});

describe('the credential stays current across the boundary', () => {
  test('the token file is written atomically — the child can never read half of it', async () => {
    // The child re-reads this file per request; a plain overwrite is observable
    // half-done, and half a bearer token is a 401 on every remaining upload.
    const src = readFileSync(join(import.meta.dir, '..', 'sync', 'asset-sweep.ts'), 'utf8');
    expect(src).toContain('renameSync(tmp, tokenFile)');
    // And the parent keeps it current: a renewal mid-sweep must reach the child,
    // which is why `token` is a GETTER and not the string it resolved to.
    expect(src).toMatch(/token: \(\) => string/);
    expect(src).toMatch(/setInterval\(/);
  });
});

describe('the worker ships where the server can find it', () => {
  test('the resolved script is a real file on disk (DDR-045, not a bunfs path)', () => {
    const script = assetWorkerScript();
    expect(script.endsWith(join('sync', 'asset-push-worker.ts'))).toBe(true);
    expect(existsSync(script)).toBe(true);
  });
});

// Temp roots outlive individual tests (the token-file case reads one back), so
// they are swept once at the end rather than per-test.
process.on('exit', () => {
  for (const d of dirs) {
    try {
      if (existsSync(d) && readdirSync(d)) rmSync(d, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
});
