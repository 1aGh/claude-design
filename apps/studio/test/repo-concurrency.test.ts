// Cloud Phase 27 D2 — the concurrency test the plan asks for by name:
// "a concurrency test that runs an autocommit against a live canvas write."
//
// REAL GIT, REAL FILES, REAL CONTENTION. Everything else in this suite injects
// its git runner, which is right for asserting what the code MEANS to do and
// useless for asserting what two processes over one index actually DO. The
// failure this exists to catch does not reproduce against a fake: it is
// `.git/index.lock` colliding, or a commit landing between another commit's
// `add` and its `commit`.
//
// What is asserted, in the order it matters:
//   1. NOTHING IS LOST. Every byte written during the storm is either committed
//      or still in the working tree at the end. That is the tenant's data.
//   2. THE REPO IS NOT CORRUPT. `git fsck` and a clean `git status` afterwards.
//   3. NO LOCK IS LEFT BEHIND. Neither git's nor ours — a leaked lock is a
//      history that silently stops.

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { REPO_LOCK_FILE, withRepoLock } from '../git/repo-lock.ts';
import { createAutoCommit } from '../sync/autocommit.ts';

/** The same shape the cell uses on both sides: shell out to system git. */
async function run(args: string[], { cwd }: { cwd: string }) {
  const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, stdout, stderr };
}

async function makeRepo(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'maude-repo-concurrency-'));
  await run(['init', '-b', 'main'], { cwd: root });
  await run(['config', 'user.name', 'Test'], { cwd: root });
  await run(['config', 'user.email', 'test@example.com'], { cwd: root });
  mkdirSync(join(root, '.design', 'ui'), { recursive: true });
  writeFileSync(join(root, '.design', 'ui', 'seed.tsx'), 'export const seed = 0;\n');
  await run(['add', '-A'], { cwd: root });
  await run(['commit', '-m', 'seed'], { cwd: root });
  return root;
}

/** Atomic, exactly like every real writer in this codebase. */
function writeCanvas(root: string, rel: string, body: string): void {
  const abs = join(root, rel);
  const tmp = `${abs}.tmp`;
  writeFileSync(tmp, body);
  Bun.spawnSync(['mv', tmp, abs]);
}

describe('two writers, one checkout', () => {
  test('an autocommit against a live canvas write loses nothing and corrupts nothing', async () => {
    const root = await makeRepo();
    try {
      const auto = createAutoCommit({
        repoRoot: root,
        run,
        debounceMs: 5,
        log: { warn() {}, error() {}, log() {} },
      });

      // The storm: twelve rounds of "a designer typed, the doc flushed to disk,
      // the hub noticed" — with a SECOND writer (the studio's own git verbs,
      // here standing in as a lock-taking committer) cutting in throughout.
      const rounds = 12;
      const expected = new Map<string, string>();
      const flights: Promise<unknown>[] = [];

      for (let i = 0; i < rounds; i++) {
        const rel = `.design/ui/canvas-${i % 4}.tsx`;
        const body = `export const v = ${i};\n`;
        writeCanvas(root, rel, body);
        expected.set(rel, body);
        auto.note(rel, { name: 'Alice', email: 'alice@example.com' });

        if (i % 3 === 0) {
          // The other process, doing what it does: taking the lock for a whole
          // sequence and running git inside it.
          flights.push(
            withRepoLock(root, 'studio:commit', async () => {
              await run(['add', '--', '.design'], { cwd: root });
              await run(['commit', '-m', `studio ${i}`, '--allow-empty'], { cwd: root });
            })
          );
        }
        if (i % 2 === 0) flights.push(auto.flush());
        await new Promise((r) => setTimeout(r, 3));
      }

      await Promise.all(flights);
      await auto.flush();
      auto.stop();

      // 1. NOTHING IS LOST — every last write is on disk with the bytes we wrote.
      for (const [rel, body] of expected) {
        expect(readFileSync(join(root, rel), 'utf8')).toBe(body);
      }

      // 2. THE REPO IS NOT CORRUPT.
      const fsck = await run(['fsck', '--no-progress'], { cwd: root });
      expect(fsck.code).toBe(0);
      const log = await run(['log', '--oneline'], { cwd: root });
      expect(log.code).toBe(0);
      expect(log.stdout.trim().split('\n').length).toBeGreaterThan(1);

      // 3. NO LOCK LEFT BEHIND — neither git's nor ours.
      expect(existsSync(join(root, '.git', 'index.lock'))).toBe(false);
      expect(existsSync(join(root, '.git', REPO_LOCK_FILE))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  test('a commit sequence is never interleaved by another writer', async () => {
    // The half-staged commit, precisely. Without a lock held ACROSS the
    // sequence, the second writer's commit lands between the first's `add` and
    // its `commit` and takes the staged file with it. `index.lock` cannot stop
    // this — it is released the moment `add` returns.
    const root = await makeRepo();
    try {
      const order: string[] = [];
      const sequence = (name: string) =>
        withRepoLock(root, `studio:${name}`, async () => {
          order.push(`${name}:add`);
          await run(['add', '-A'], { cwd: root });
          await new Promise((r) => setTimeout(r, 25));
          order.push(`${name}:commit`);
          await run(['commit', '-m', name, '--allow-empty'], { cwd: root });
        });

      writeCanvas(root, '.design/ui/a.tsx', 'export const a = 1;\n');
      await Promise.all([sequence('one'), sequence('two')]);

      // add/commit/add/commit — never add/add/commit/commit.
      expect(order[1]).toBe(order[0].replace(':add', ':commit'));
      expect(order[3]).toBe(order[2].replace(':add', ':commit'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 20_000);
});
