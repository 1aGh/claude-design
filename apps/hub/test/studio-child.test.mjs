// Cloud Phase 27 A1 — the studio is a supervised child, and a dead child is
// visible. Every side effect is injected: the failure modes worth asserting
// (crash-loop backoff, never-ready, a stop that flushes) are the ones a real
// child makes slow and flaky to reproduce.

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { BACKOFF_MS, childEnv, createStudioChild, studioLaunch } from '../src/studio-child.mjs';

class FakeChild extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.killed = [];
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
  }
  kill(sig) {
    this.killed.push(sig);
    // A real SIGTERM eventually produces an exit; the tests that care drive it
    // explicitly, so this only records.
  }
}

/** A harness with a controllable clock and spawn. */
function harness({ ready = true, entry = __filename } = {}) {
  const spawned = [];
  const timers = [];
  let pid = 100;
  const child = createStudioChild({
    env: { MAUDE_STUDIO_SRC: null, MAUDE_REPO_DIR: '/repo', PATH: '/bin' },
    port: 4399,
    spawn: (bin, args, opts) => {
      const proc = new FakeChild(pid++);
      spawned.push({ bin, args, opts, proc });
      return proc;
    },
    probe: async () => ready,
    setTimer: (fn, ms) => {
      const t = { fn, ms, unref: () => t };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      const i = timers.indexOf(t);
      if (i !== -1) timers.splice(i, 1);
    },
    log: { log() {}, error() {} },
  });
  // The entry probe uses the real filesystem; point it at a file that exists so
  // launch() proceeds. `studioEntry` falls back to cwd-relative candidates.
  return { child, spawned, timers, entry };
}

const __filename = new URL(import.meta.url).pathname;

test('the child environment is minimal and carries no hub secret', () => {
  const env = childEnv(
    {
      PATH: '/bin',
      HOME: '/home/node',
      HUB_SECRET: 'do-not-leak',
      MAUDE_PROJECT_TOKEN_KEY: 'also-not',
      AWS_SECRET_ACCESS_KEY: 'definitely-not',
      MAUDE_REPO_DIR: '/repo',
      HUB_PUBLIC_URL: 'https://alligators.cloud.maude.sh',
    },
    { port: 4399 }
  );
  assert.equal(env.HUB_SECRET, undefined);
  assert.equal(env.MAUDE_PROJECT_TOKEN_KEY, undefined);
  assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(env.MAUDE_WORKSPACE_MODE, '1');
  assert.equal(env.PORT, '4399');
  assert.equal(env.MAUDE_REPO_DIR, '/repo');
  // D4 — the studio is TOLD its public identity.
  assert.equal(env.HUB_PUBLIC_URL, 'https://alligators.cloud.maude.sh');
});

test('the child environment never grows a wildcard', () => {
  // The whole guarantee is "an allowlist, not a spread". A future edit adding
  // `...env` would pass every other test in this file.
  const env = childEnv({ PATH: '/bin', SOMETHING_NEW: 'x' }, { port: 1 });
  assert.equal(env.SOMETHING_NEW, undefined);
});

test('a supervisor that has never started is idle, not restarting', () => {
  const { child } = harness({ ready: false });
  assert.equal(child.status().ok, false);
  // 'restarting' would send whoever reads /health looking for a crash that
  // never happened.
  assert.equal(child.status().state, 'idle');
});

test('an exit schedules a restart on the backoff ladder', () => {
  const { child, spawned, timers } = harness();
  child.start();
  assert.equal(spawned.length, 1, 'the child was not spawned');
  const first = spawned[0].proc;
  first.emit('exit', 1, null);
  assert.equal(child.status().ok, false);
  assert.equal(child.status().state, 'restarting');
  assert.equal(child.status().lastExit.code, 1);
  const scheduled = timers.filter((t) => BACKOFF_MS.includes(t.ms));
  assert.ok(scheduled.length >= 1, 'no restart was scheduled');
  assert.equal(scheduled[0].ms, BACKOFF_MS[0]);
});

test('repeated crashes back off rather than spinning', () => {
  const { child, spawned, timers } = harness();
  child.start();
  const delays = [];
  for (let i = 0; i < 4; i++) {
    spawned.at(-1).proc.emit('exit', 1, null);
    const t = timers.filter((x) => BACKOFF_MS.includes(x.ms)).at(-1);
    delays.push(t.ms);
    t.fn(); // fire the restart immediately
  }
  assert.deepEqual(delays, BACKOFF_MS.slice(0, 4));
});

test('stop() asks politely first', async () => {
  const { child, spawned, timers } = harness();
  child.start();
  const proc = spawned[0].proc;
  const stopping = child.stop();
  assert.deepEqual(proc.killed, ['SIGTERM']);
  proc.emit('exit', 0, 'SIGTERM');
  await stopping;
  assert.equal(child.status().state, 'stopped');
  // And a stopped supervisor does not resurrect it.
  const before = spawned.length;
  for (const t of timers) t.fn?.();
  assert.equal(spawned.length, before);
});

test('a compiled studio takes NO entry argument', () => {
  // The mistake this rules out: handing `server.ts` to a `bun build --compile`
  // binary, which treats it as a positional arg rather than an entry. It boots,
  // it looks fine, and it serves the wrong root.
  const plan = studioLaunch({ MAUDE_STUDIO_BIN: __filename });
  assert.equal(plan.kind, 'binary');
  assert.equal(plan.cmd, __filename);
  assert.deepEqual(plan.args, []);
});

test('a dev checkout runs the SOURCE entry under bun', () => {
  const studioSrc = join(dirname(dirname(dirname(__filename))), 'studio');
  const plan = studioLaunch({ MAUDE_STUDIO_SRC: studioSrc, MAUDE_BUN_PATH: '/bin/bun' });
  assert.equal(plan.kind, 'source');
  assert.equal(plan.cmd, '/bin/bun');
  assert.deepEqual(plan.args, [join(studioSrc, 'server.ts')]);
});

test('a MAUDE_STUDIO_BIN that is not there is never launched', () => {
  // The failure this rules out: a typo'd or unstaged binary path being spawned
  // anyway, so the supervisor crash-loops on ENOENT instead of falling back to
  // the source shape that is sitting right there.
  const plan = studioLaunch({ MAUDE_STUDIO_BIN: '/nope/maude-server' });
  assert.notEqual(plan?.cmd, '/nope/maude-server');
});

test('status() names the port a proxy should forward to', () => {
  const { child } = harness();
  assert.equal(child.port, 4399);
  assert.equal(child.status().port, 4399);
});
