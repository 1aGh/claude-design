// Unit: Task 7 — `.git/HEAD` watcher. We don't exercise fs.watch directly
// (flaky across platforms in CI); instead we drive the module's public
// surface: it gracefully no-ops when no .git/ exists, and the public stop()
// is idempotent.
//
// The flush-before-broadcast invariant is verified separately by the
// collab-bridge tests and the persistence module's contract — registry
// already exposes flushAll(). The integration with .git/HEAD writes is
// exercised manually in the Task 7 acceptance test (Phase 8 plan validate row).

import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { createGitLifecycle } from '../collab/git-lifecycle.ts';
import { createBus, type Context } from '../context.ts';
import { createRegistry } from '../collab/registry.ts';
import type { RoomCallbacks } from '../collab/room.ts';

function ctxFor(repoRoot: string): Context {
  return {
    cfg: {} as Context['cfg'],
    projectLabel: 'test',
    paths: {
      repoRoot,
      designRel: '.design',
      designRoot: path.join(repoRoot, '.design'),
      serverInfoFile: '',
      activeFile: '',
      commentsDir: '',
      canvasStateDir: '',
      historyDir: '',
      tokensUrlRel: '',
      systemDirRel: '',
    },
    bus: createBus(),
  };
}

function noopCallbacks(): RoomCallbacks {
  return { async seed() {}, async persistJson() {}, async persistBinary() {} };
}

describe('git-lifecycle', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'maude-git-lifecycle-'));
  });

  afterEach(() => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test('no .git/ directory → silent no-op (still returns a stop function)', () => {
    const ctx = ctxFor(tmp);
    const registry = createRegistry(noopCallbacks());
    expect(existsSync(path.join(tmp, '.git'))).toBe(false);
    const gl = createGitLifecycle(ctx, registry);
    expect(typeof gl.stop).toBe('function');
    gl.stop(); // idempotent
    gl.stop();
  });

  test('with .git/HEAD present → watcher attaches without throwing', () => {
    mkdirSync(path.join(tmp, '.git'), { recursive: true });
    writeFileSync(path.join(tmp, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    const ctx = ctxFor(tmp);
    const registry = createRegistry(noopCallbacks());
    const gl = createGitLifecycle(ctx, registry);
    expect(typeof gl.stop).toBe('function');
    gl.stop();
  });

  test('emits git-lifecycle bus event on HEAD change (manual rewrite)', async () => {
    mkdirSync(path.join(tmp, '.git'), { recursive: true });
    writeFileSync(path.join(tmp, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    const ctx = ctxFor(tmp);
    const registry = createRegistry(noopCallbacks());
    const events: unknown[] = [];
    ctx.bus.on('git-lifecycle', (e) => events.push(e));
    const gl = createGitLifecycle(ctx, registry);

    // Rewrite HEAD; the watcher fires + 250 ms debounce + flush. Wait > 500 ms
    // to be safe with fs.watch + flushAll latency on macOS + Linux.
    writeFileSync(path.join(tmp, '.git', 'HEAD'), 'ref: refs/heads/other\n');
    await Bun.sleep(700);

    expect(events.length).toBeGreaterThanOrEqual(1);
    const evt = events[0] as { reason?: string; head?: string };
    expect(evt.reason).toBe('head-changed');
    expect(evt.head).toContain('refs/heads/other');
    gl.stop();
  });
});
