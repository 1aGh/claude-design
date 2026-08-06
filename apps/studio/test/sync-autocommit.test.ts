// Cloud Phase 3 Task 1 — autosave as append-only git commits.
//
// Driven against a REAL git repository in a temp dir, not a mocked runner. The
// properties that matter (authorship survives, history is never rewritten, a
// no-op write produces no commit) are properties of git's actual behaviour, and
// a mock would only prove that the arguments match what I expected them to be.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { REPO_LOCK_FILE } from '../git/repo-lock.ts';
import {
  commitMessage,
  createAutoCommit,
  formatAuthor,
  type GitRunner,
  pushMirror,
  sanitizeAttribution,
  UNKNOWN_AUTHOR,
} from '../sync/autocommit.ts';

const git: GitRunner = (args, { cwd }) =>
  new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });

let repo: string;

async function initRepo(): Promise<string> {
  const dir = mkdtempSync(path.join(tmpdir(), 'maude-autocommit-'));
  await git(['init', '--initial-branch=main'], { cwd: dir });
  await git(['config', 'user.name', 'Seed'], { cwd: dir });
  await git(['config', 'user.email', 'seed@example.com'], { cwd: dir });
  mkdirSync(path.join(dir, '.design', 'ui'), { recursive: true });
  writeFileSync(path.join(dir, '.design', 'ui', 'Screen.tsx'), 'export default () => null;\n');
  await git(['add', '-A'], { cwd: dir });
  await git(['commit', '-m', 'seed'], { cwd: dir });
  return dir;
}

const ALICE = { name: 'Alice Novák', email: 'alice@example.com' };
const BOB = { name: 'Bob', email: 'bob@example.com' };
const REL = '.design/ui/Screen.tsx';

const write = (rel: string, body: string) => writeFileSync(path.join(repo, rel), body);
const log = async (fmt: string) =>
  (await git(['log', `--pretty=format:${fmt}`], { cwd: repo })).stdout.split('\n').filter(Boolean);

beforeEach(async () => {
  repo = await initRepo();
});

afterEach(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

describe('attribution', () => {
  test('a missing author is UNKNOWN, never the bot', () => {
    // Attributing an anonymous human's work to the server makes `git blame` lie
    // in a way that is hard to notice later. "Unknown" is honest and visibly
    // wrong.
    expect(sanitizeAttribution(null)).toEqual(UNKNOWN_AUTHOR);
    expect(sanitizeAttribution(undefined)).toEqual(UNKNOWN_AUTHOR);
    expect(sanitizeAttribution({ name: '', email: '' })).toEqual(UNKNOWN_AUTHOR);
  });

  test('presence-supplied identity cannot forge commit trailers', () => {
    // Presence arrives over a semi-trusted hub (DDR-054): a name is
    // attacker-influenceable text, and `--author` takes `Name <email>`.
    const evil = sanitizeAttribution({
      name: 'Real Person <real@example.com>\nSigned-off-by: Someone Else',
      email: 'a@b.com\r\nCo-Authored-By: Nobody',
    });
    expect(evil.name).not.toContain('\n');
    expect(evil.name).not.toContain('<');
    expect(evil.name).not.toContain('>');
    expect(evil.email).not.toContain('\r');
    expect(formatAuthor(evil)).toMatch(/^[^<>\n]+ <[^<>\n]+>$/);
  });

  test('names are bounded so one peer cannot bloat every commit', () => {
    const long = sanitizeAttribution({ name: 'x'.repeat(500), email: 'y'.repeat(500) });
    expect(long.name.length).toBeLessThanOrEqual(96);
    expect(long.email.length).toBeLessThanOrEqual(96);
  });

  test('unicode names survive intact — this is a real person, not a slug', () => {
    expect(sanitizeAttribution(ALICE).name).toBe('Alice Novák');
  });
});

describe('commit message', () => {
  test('names the canvas rather than saying "autosave"', () => {
    // 400 identical subjects is the same as no history.
    const one = commitMessage(['.design/ui/Screen.tsx'], ALICE);
    expect(one.split('\n')[0]).toBe('design: update Screen');
    expect(one).toContain('Alice Novák <alice@example.com>');
    expect(one).toContain('append-only');
  });

  test('a multi-file commit summarizes and lists', () => {
    const many = commitMessage(
      ['.design/ui/Screen.tsx', '.design/ui/Settings.tsx', '.design/ui/Screen.meta.json'],
      ALICE
    );
    // Screen.tsx + Screen.meta.json are ONE canvas — a subject that said
    // "3 canvases" would overstate what changed on every single commit.
    expect(many.split('\n')[0]).toBe('design: update 2 canvases');
    expect(many).toContain('- Screen');
    expect(many).toContain('- Settings');
    expect(many).not.toContain('- Screen.meta');
  });
});

describe('committing, against a real repo', () => {
  test('an edit becomes a commit authored by the HUMAN, committed by the bot', async () => {
    const auto = createAutoCommit({ repoRoot: repo, run: git, debounceMs: 5, log: silent() });
    write(REL, 'export default () => <main>alice was here</main>;\n');
    auto.note(REL, ALICE);

    const outcome = await auto.flush();
    expect(outcome?.ok).toBe(true);

    // This is the point of using git's author/committer split at all: blame
    // answers "who designed this", not "the server did".
    expect(await log('%an|%ae')).toEqual([
      'Alice Novák|alice@example.com',
      'Seed|seed@example.com',
    ]);
    expect((await log('%cn'))[0]).toBe('Maude Workspace');
    expect((await log('%s'))[0]).toBe('design: update Screen');
  });

  test('edits COALESCE — a typing session is one commit, not four hundred', async () => {
    const auto = createAutoCommit({ repoRoot: repo, run: git, debounceMs: 5, log: silent() });
    for (let i = 0; i < 20; i++) {
      write(REL, `export default () => <main>v${i}</main>;\n`);
      auto.note(REL, ALICE);
    }
    await auto.flush();
    expect((await log('%s')).length).toBe(2); // seed + one autosave
  });

  test('a no-op write produces NO commit', async () => {
    // An echo, or a write of identical bytes. Committing it would be noise.
    const auto = createAutoCommit({ repoRoot: repo, run: git, debounceMs: 5, log: silent() });
    auto.note(REL, ALICE);
    const outcome = await auto.flush();
    expect(outcome?.ok).toBe(false);
    expect(outcome && !outcome.ok && outcome.reason).toBe('nothing-to-commit');
    expect((await log('%s')).length).toBe(1);
  });

  test('a steady stream of notes cannot defer the commit forever', async () => {
    // Quiescence batching resets the timer on every note, so without a ceiling
    // anyone able to drive notes faster than `debounceMs` holds the project's
    // history open indefinitely. In a cell that is reachable by the LOWEST role:
    // a viewer holds `comment`, a comment updates the doc, the doc stores, and
    // the hub notes on every store. Bounded now by `maxDebounceMs`.
    const auto = createAutoCommit({
      repoRoot: repo,
      run: git,
      debounceMs: 100, // never quiet: notes arrive every 20 ms, below this
      maxDebounceMs: 300,
      log: silent(),
    });

    write(REL, 'export default () => <main>held open</main>;\n');
    const started = Date.now();
    // 600 ms of chatter at 20 ms — six times the quiescence window, so the
    // un-ceilinged version commits nothing at all in this span.
    while (Date.now() - started < 600) {
      auto.note(REL, ALICE);
      await new Promise((r) => setTimeout(r, 20));
    }

    const subjects = await log('%s');
    expect(subjects.length).toBe(2); // seed + the ceiling-forced autosave
    auto.stop();
  });

  test('an unrelated STAGED entry cannot wedge the agent', async () => {
    // The no-op probe asks "did OUR paths stage anything". Unscoped, a stray
    // index entry answers yes, and `commit --only -- <our unchanged paths>`
    // then exits non-zero forever — the agent re-queues but never re-arms, so
    // it fails identically from then on while /health stays green. Routine
    // since the commit set stopped being "files we just wrote" (cell pairing:
    // the studio child's projector writes the bytes first).
    write('stray.txt', 'staged by somebody else\n');
    await git(['add', '--', 'stray.txt'], { cwd: repo });

    const auto = createAutoCommit({ repoRoot: repo, run: git, debounceMs: 5, log: silent() });
    auto.note(REL, ALICE); // unchanged bytes
    const outcome = await auto.flush();
    expect(outcome?.ok).toBe(false);
    expect(outcome && !outcome.ok && outcome.reason).toBe('nothing-to-commit');
    // And it must not have swept the stray file into a commit either.
    expect((await log('%s')).length).toBe(1);
  });

  test('only the NOTED files are staged — an unrelated dirty file is left alone', async () => {
    // `git add -A` in a workspace would sweep in whatever else is in the tree.
    // The cell must never commit something it wasn't told about.
    const auto = createAutoCommit({ repoRoot: repo, run: git, debounceMs: 5, log: silent() });
    write(REL, 'export default () => <main>noted</main>;\n');
    writeFileSync(path.join(repo, 'UNRELATED.md'), 'not part of the design\n');
    auto.note(REL, ALICE);
    await auto.flush();

    const show = await git(['show', '--name-only', '--pretty=format:', 'HEAD'], { cwd: repo });
    expect(show.stdout.trim()).toBe(REL);
    const status = await git(['status', '--porcelain'], { cwd: repo });
    expect(status.stdout).toContain('UNRELATED.md');
  });

  test('history is APPEND-ONLY — an earlier state is still reachable', async () => {
    const auto = createAutoCommit({ repoRoot: repo, run: git, debounceMs: 5, log: silent() });
    write(REL, 'export default () => <main>first</main>;\n');
    auto.note(REL, ALICE);
    await auto.flush();
    const firstSha = (await log('%H'))[0];

    write(REL, 'export default () => <main>second</main>;\n');
    auto.note(REL, BOB);
    await auto.flush();

    // The old content is still there — the guarantee that makes a cell's
    // autosave safe to trust with someone's only copy.
    const old = await git(['show', `${firstSha}:${REL}`], { cwd: repo });
    expect(old.stdout).toContain('first');
    expect((await log('%s')).length).toBe(3);
    expect(await log('%an')).toEqual(['Bob', 'Alice Novák', 'Seed']);
  });

  test('two peers editing before quiescence produce one commit, attributed to the last', async () => {
    const auto = createAutoCommit({ repoRoot: repo, run: git, debounceMs: 5, log: silent() });
    write(REL, 'export default () => <main>alice</main>;\n');
    auto.note(REL, ALICE);
    write(path.join('.design', 'ui', 'Second.tsx'), '');
    writeFileSync(path.join(repo, '.design/ui/Second.tsx'), 'export default () => null;\n');
    auto.note('.design/ui/Second.tsx', BOB);
    await auto.flush();

    expect((await log('%an'))[0]).toBe('Bob');
    expect((await log('%s'))[0]).toBe('design: update 2 canvases');
  });

  test('a git failure RE-QUEUES the change instead of dropping it', async () => {
    // The bytes are already on disk, so a git error must not remove the change
    // from history permanently — making the commit a precondition of the save
    // would turn a transient error into data loss.
    let failNext = true;
    const flaky: GitRunner = async (args, opts) => {
      if (args.includes('commit') && failNext) {
        failNext = false;
        return { code: 1, stdout: '', stderr: 'simulated git failure' };
      }
      return git(args, opts);
    };
    const auto = createAutoCommit({ repoRoot: repo, run: flaky, debounceMs: 5, log: silent() });
    write(REL, 'export default () => <main>retry me</main>;\n');
    auto.note(REL, ALICE);

    const first = await auto.flush();
    expect(first?.ok).toBe(false);
    expect(auto.pending()).toEqual([REL]);

    const second = await auto.flush();
    expect(second?.ok).toBe(true);
    expect((await log('%s')).length).toBe(2);
  });

  test('flush with nothing pending is a no-op, not an empty commit', async () => {
    const auto = createAutoCommit({ repoRoot: repo, run: git, debounceMs: 5, log: silent() });
    expect(await auto.flush()).toBe(null);
    expect((await log('%s')).length).toBe(1);
  });

  test('stop() prevents further scheduling', async () => {
    const auto = createAutoCommit({ repoRoot: repo, run: git, debounceMs: 5, log: silent() });
    auto.stop();
    write(REL, 'export default () => <main>after stop</main>;\n');
    auto.note(REL, ALICE);
    expect(auto.pending()).toEqual([]);
  });
});

describe('mirror push — never rewrites someone else’s work', () => {
  test('a non-fast-forward push is REPORTED as rejected, never forced', async () => {
    // The cell has no way to know whether merging a stranger's commits is
    // right, so it stops and surfaces it. DDR-119's hazard, arriving from the
    // other direction.
    const remote = mkdtempSync(path.join(tmpdir(), 'maude-remote-'));
    await git(['init', '--bare', '--initial-branch=main'], { cwd: remote });
    await git(['remote', 'add', 'origin', remote], { cwd: repo });
    await git(['push', 'origin', 'main'], { cwd: repo });

    // Someone else pushes first, from a separate clone.
    const other = mkdtempSync(path.join(tmpdir(), 'maude-other-'));
    await git(['clone', remote, other], { cwd: path.dirname(other) });
    await git(['config', 'user.name', 'Other'], { cwd: other });
    await git(['config', 'user.email', 'other@example.com'], { cwd: other });
    writeFileSync(path.join(other, 'theirs.txt'), 'their work\n');
    await git(['add', '-A'], { cwd: other });
    await git(['commit', '-m', 'their work'], { cwd: other });
    await git(['push', 'origin', 'main'], { cwd: other });

    // Now the cell has a diverging commit.
    const auto = createAutoCommit({ repoRoot: repo, run: git, debounceMs: 5, log: silent() });
    write(REL, 'export default () => <main>ours</main>;\n');
    auto.note(REL, ALICE);
    await auto.flush();

    const res = await pushMirror({ repoRoot: repo, run: git, branch: 'main', log: silent() });
    expect(res.ok).toBe(false);
    expect(res.rejected).toBe(true);

    // Their commit is still the remote's tip — nothing of theirs was destroyed.
    const remoteLog = await git(['log', '--pretty=format:%s', 'main'], { cwd: remote });
    expect(remoteLog.stdout.split('\n')[0]).toBe('their work');

    rmSync(remote, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  });

  test('a fast-forward push succeeds', async () => {
    const remote = mkdtempSync(path.join(tmpdir(), 'maude-remote-ok-'));
    await git(['init', '--bare', '--initial-branch=main'], { cwd: remote });
    await git(['remote', 'add', 'origin', remote], { cwd: repo });
    await git(['push', 'origin', 'main'], { cwd: repo });

    const auto = createAutoCommit({ repoRoot: repo, run: git, debounceMs: 5, log: silent() });
    write(REL, 'export default () => <main>ours</main>;\n');
    auto.note(REL, ALICE);
    await auto.flush();

    const res = await pushMirror({ repoRoot: repo, run: git, branch: 'main', log: silent() });
    expect(res.ok).toBe(true);
    expect(res.rejected).toBe(false);

    rmSync(remote, { recursive: true, force: true });
  });

  test('pushMirror never passes a force flag', async () => {
    // Pinned as an argv assertion: the guarantee is the ABSENCE of a flag, and
    // absence is exactly what a future edit could add without any test noticing.
    const seen: string[][] = [];
    await pushMirror({
      repoRoot: repo,
      branch: 'main',
      run: async (args) => {
        seen.push(args);
        return { code: 0, stdout: '', stderr: '' };
      },
      log: silent(),
    });
    const flat = seen.flat();
    expect(flat.some((a) => /^--force/.test(a))).toBe(false);
    expect(flat.some((a) => a.startsWith('+'))).toBe(false);
    expect(flat).toContain('refs/heads/main:refs/heads/main');
  });
});

function silent() {
  return { warn: () => {}, error: () => {}, log: () => {} };
}

describe('a contended lock must not lose the queue or the process (Phase 27 D2)', () => {
  test('a lock timeout re-queues the files instead of dropping them', async () => {
    // `flush()` clears `touched` BEFORE it commits, and `withRepoLock` THROWS
    // when it cannot acquire. Without a catch, a contended autosave dropped its
    // file list silently — the bytes stay on disk, uncommitted, with nothing to
    // retry them — and rejected a promise the debounce timer discards, which on
    // Node >= 15 takes the process down with it. Post-D2 the trigger is
    // ordinary: `pull` and `checkout` hold this lock across a NETWORK call.
    const dir = mkdtempSync(path.join(tmpdir(), 'autocommit-lock-'));
    try {
      mkdirSync(path.join(dir, '.git'), { recursive: true });
      // A live holder that is not stale — every acquire attempt will time out.
      writeFileSync(
        path.join(dir, '.git', REPO_LOCK_FILE),
        JSON.stringify({ pid: process.pid, holder: 'studio:pull', at: Date.now(), token: 'held' })
      );

      const ran: string[][] = [];
      const auto = createAutoCommit({
        repoRoot: dir,
        debounceMs: 5,
        log: { warn() {}, error() {}, log() {} },
        run: async (args) => {
          ran.push(args);
          return { code: 0, stdout: '', stderr: '' };
        },
      });

      auto.note('.design/ui/Home.tsx', { name: 'A', email: 'a@b.c' });
      const outcome = await auto.flush();

      expect(outcome?.ok).toBe(false);
      // Nothing reached git — the lock was never acquired.
      expect(ran).toEqual([]);
      // THE POINT: the file is still queued, so the next quiescence retries it.
      expect(auto.pending()).toEqual(['.design/ui/Home.tsx']);
      auto.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  test('the debounce timer never surfaces an unhandled rejection', async () => {
    // The timer fires unattended; a rejection it discards is a process exit.
    const dir = mkdtempSync(path.join(tmpdir(), 'autocommit-timer-'));
    try {
      mkdirSync(path.join(dir, '.git'), { recursive: true });
      writeFileSync(
        path.join(dir, '.git', REPO_LOCK_FILE),
        JSON.stringify({ pid: process.pid, holder: 'studio:fold', at: Date.now(), token: 'held' })
      );
      const rejections: unknown[] = [];
      const onUnhandled = (err: unknown) => rejections.push(err);
      process.on('unhandledRejection', onUnhandled);
      try {
        const auto = createAutoCommit({
          repoRoot: dir,
          debounceMs: 5,
          log: { warn() {}, error() {}, log() {} },
          run: async () => ({ code: 0, stdout: '', stderr: '' }),
        });
        auto.note('.design/ui/Home.tsx', { name: 'A', email: 'a@b.c' });
        // Long enough for the debounce to fire AND the lock wait to expire.
        await new Promise((r) => setTimeout(r, 1000));
        auto.stop();
      } finally {
        process.off('unhandledRejection', onUnhandled);
      }
      expect(rejections).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
