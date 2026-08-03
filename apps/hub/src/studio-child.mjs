// The supervised studio child — Cloud Phase 27 A1, under DDR-209.
//
// A cell runs the REAL `apps/studio` Bun server, bound to loopback, and the hub
// is a proxy in front of it. That makes the container a two-process container,
// and two processes under tini with no supervisor is how you get a box that
// answers 200 while half of it is dead: tini reaps, nobody restarts, and
// `/health` — served by the process that is still fine — keeps saying yes.
//
// So supervision lives HERE, in the hub, rather than in the entrypoint shell:
//
//   - the hub is what serves `/health`, so it is the only process that can make
//     a dead child visible to the router (D5);
//   - a restart loop needs backoff, and backoff needs state a shell script would
//     have to invent;
//   - the child's lifetime should end when the hub's does, which `spawn` gives
//     us and a backgrounded shell job does not.
//
// WHAT IT DELIBERATELY DOES NOT DO: give up. A cell whose studio cannot start is
// a cell whose customer sees an error page — but a cell that EXITS is a cell the
// platform restarts from cold, losing the warm working set and the pending
// autosave commit with it. It retries forever, with backoff, and tells the truth
// at `/health` the whole time.

import { spawn as nodeSpawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Backoff ladder, ms. Long enough that a crash-loop does not spin a CPU;
 *  short enough that a transient failure is invisible to whoever is waiting. */
export const BACKOFF_MS = Object.freeze([250, 500, 1000, 2000, 5000, 10_000, 30_000]);

/** How long a fresh child gets to answer `/_health` before we call it stuck. */
export const READY_TIMEOUT_MS = Number(process.env.MAUDE_STUDIO_READY_MS ?? 60_000);

/** The loopback port the studio binds inside the container. */
export const DEFAULT_STUDIO_PORT = 4399;

/**
 * Where the studio's entry lives, across the layouts it runs in.
 *
 * The cell image stages the source under `/canvas/studio` (`MAUDE_STUDIO_SRC`);
 * a dev checkout has it as a sibling of `apps/hub`. Bun reads TypeScript
 * natively, so there is nothing to compile in either case.
 */
export function studioEntry(env = process.env) {
  const candidates = [
    env.MAUDE_STUDIO_SRC ? join(env.MAUDE_STUDIO_SRC, 'server.ts') : null,
    join(process.cwd(), '..', 'studio', 'server.ts'),
    join(process.cwd(), 'apps', 'studio', 'server.ts'),
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  return candidates[0] ?? null;
}

/**
 * The child's environment.
 *
 * NOT the parent's. `HUB_SECRET`, `MAUDE_PROJECT_TOKEN_KEY`, the tenant's
 * storage credentials and the Stripe/Cloudflare tokens all live in the hub's
 * env, and the studio needs none of them — it needs a repo, a port, and the
 * knowledge that it is a cell. This is the same reasoning as the build
 * sandbox's empty environment, one level up: the studio parses tenant source
 * (indirectly) and answers tenant-shaped requests, so it gets the smallest
 * environment that lets it work.
 *
 * The one thing it MUST be told is its public identity (D4). Behind the tunnel
 * the `Host` header is an internal name, and Phase 25 shipped that bug into
 * production twice.
 */
export function childEnv(env = process.env, { port }) {
  return {
    PATH: env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: env.HOME ?? '/tmp',
    NODE_ENV: env.NODE_ENV ?? 'production',
    // The invariant, stated to the process that enforces it.
    MAUDE_WORKSPACE_MODE: '1',
    PORT: String(port),
    ...(env.MAUDE_REPO_DIR ? { MAUDE_REPO_DIR: env.MAUDE_REPO_DIR } : {}),
    ...(env.MAUDE_DESIGN_ROOT ? { MAUDE_DESIGN_ROOT: env.MAUDE_DESIGN_ROOT } : {}),
    ...(env.MAUDE_STUDIO_SRC ? { MAUDE_STUDIO_SRC: env.MAUDE_STUDIO_SRC } : {}),
    ...(env.MAUDE_CANVAS_WORKERS ? { MAUDE_CANVAS_WORKERS: env.MAUDE_CANVAS_WORKERS } : {}),
    ...(env.MAUDE_BUN_PATH ? { MAUDE_BUN_PATH: env.MAUDE_BUN_PATH } : {}),
    ...(env.MAUDE_DEV_SERVER_ROOT ? { MAUDE_DEV_SERVER_ROOT: env.MAUDE_DEV_SERVER_ROOT } : {}),
    // D4 — public identity from configuration, never from the request.
    ...(env.MAUDE_PUBLIC_CANVAS_ORIGIN
      ? { MAUDE_PUBLIC_CANVAS_ORIGIN: env.MAUDE_PUBLIC_CANVAS_ORIGIN }
      : {}),
    ...(env.HUB_PUBLIC_URL ? { HUB_PUBLIC_URL: env.HUB_PUBLIC_URL } : {}),
    // C4 — a browser tab has no window title, so the client has to be told
    // which project it is showing and where "back" is.
    ...(env.HUB_DASHBOARD_URL ? { HUB_DASHBOARD_URL: env.HUB_DASHBOARD_URL } : {}),
    ...(env.MAUDE_PROJECT_NAME ? { MAUDE_PROJECT_NAME: env.MAUDE_PROJECT_NAME } : {}),
    ...(env.MAUDE_TENANT_ID ? { MAUDE_TENANT_ID: env.MAUDE_TENANT_ID } : {}),
    // A dev checkout resolves Playwright (the E2E harness) and would otherwise
    // fail the module half of the containment assert before it could be tested.
    ...(env.MAUDE_WORKSPACE_ALLOW_DEV_MODULES
      ? { MAUDE_WORKSPACE_ALLOW_DEV_MODULES: env.MAUDE_WORKSPACE_ALLOW_DEV_MODULES }
      : {}),
    ...(env.NAPI_RS_NATIVE_LIBRARY_PATH
      ? { NAPI_RS_NATIVE_LIBRARY_PATH: env.NAPI_RS_NATIVE_LIBRARY_PATH }
      : {}),
  };
}

/**
 * Supervise one studio.
 *
 * Every side effect is injectable so the state machine can be tested without
 * spawning anything — the failure modes worth testing here (crash-loop backoff,
 * "healthy but wrong project", never-ready) are all ones a real child makes slow
 * and flaky to reproduce.
 */
export function createStudioChild({
  env = process.env,
  port = Number(env.MAUDE_STUDIO_PORT ?? DEFAULT_STUDIO_PORT),
  spawn = nodeSpawn,
  probe = defaultProbe,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  log = console,
} = {}) {
  let child = null;
  let stopped = false;
  /** False until start() is called. A supervisor that has never launched is
   *  IDLE, not "restarting" — reporting a restart it never attempted would send
   *  whoever reads /health looking for a crash that did not happen. */
  let launched = false;
  let restarts = 0;
  let consecutiveFailures = 0;
  let lastExit = null;
  let startedAt = null;
  let ready = false;
  let readyAt = null;
  let timer = null;

  function bunPath() {
    return env.MAUDE_BUN_PATH || 'bun';
  }

  function launch() {
    if (stopped) return;
    const entry = studioEntry(env);
    if (!entry || !existsSync(entry)) {
      // A missing entry is a packaging bug, not a transient one. Keep retrying
      // anyway — an operator can bind-mount the source into a running cell, and
      // a supervisor that gives up turns a fixable mistake into a cold restart.
      lastExit = {
        code: null,
        signal: null,
        reason: `studio entry not found (looked for ${entry})`,
      };
      scheduleRestart();
      return;
    }
    startedAt = now();
    ready = false;
    let proc;
    try {
      proc = spawn(bunPath(), [entry, '--root', env.MAUDE_REPO_DIR ?? process.cwd()], {
        env: childEnv(env, { port }),
        cwd: env.MAUDE_REPO_DIR ?? process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      lastExit = { code: null, signal: null, reason: `could not start: ${err.message}` };
      scheduleRestart();
      return;
    }
    child = proc;
    // The child's output is the cell's output. Prefixed, not swallowed: the
    // containment boot-assert prints the reason it refused, and losing that
    // message would make the most informative failure the most silent one.
    proc.stdout?.on('data', (c) => process.stdout.write(prefix(c)));
    proc.stderr?.on('data', (c) => process.stderr.write(prefix(c)));
    proc.on('exit', (code, signal) => {
      if (child !== proc) return;
      child = null;
      ready = false;
      lastExit = { code, signal, reason: null, at: now() };
      if (stopped) return;
      log.error?.(`[studio] child exited (code=${code} signal=${signal}) — restarting`);
      scheduleRestart();
    });
    proc.on('error', (err) => {
      if (child !== proc) return;
      lastExit = { code: null, signal: null, reason: err.message, at: now() };
    });
    pollReady(proc);
  }

  function prefix(chunk) {
    return String(chunk)
      .split('\n')
      .filter((l, i, a) => l !== '' || i < a.length - 1)
      .map((l) => `[studio] ${l}\n`)
      .join('');
  }

  async function pollReady(proc) {
    const deadline = now() + READY_TIMEOUT_MS;
    while (!stopped && child === proc && now() < deadline) {
      if (await probe(port)) {
        ready = true;
        readyAt = now();
        consecutiveFailures = 0;
        log.log?.(`[studio] ready on 127.0.0.1:${port}`);
        return;
      }
      await sleep(250);
    }
    if (!stopped && child === proc && !ready) {
      // Never answered. Kill it rather than leave a process that is running but
      // not serving — that is the exact shape of "200 while half-dead".
      log.error?.(`[studio] did not become ready within ${Math.round(READY_TIMEOUT_MS / 1000)}s`);
      try {
        proc.kill('SIGKILL');
      } catch {
        /* already gone */
      }
    }
  }

  function sleep(ms) {
    return new Promise((r) => {
      const t = setTimer(r, ms);
      t?.unref?.();
    });
  }

  function scheduleRestart() {
    if (stopped) return;
    restarts++;
    const delay = BACKOFF_MS[Math.min(consecutiveFailures, BACKOFF_MS.length - 1)];
    consecutiveFailures++;
    timer = setTimer(launch, delay);
    timer?.unref?.();
  }

  return {
    start() {
      stopped = false;
      launched = true;
      launch();
      return this;
    },
    async stop() {
      stopped = true;
      if (timer) clearTimer(timer);
      const proc = child;
      child = null;
      if (!proc) return;
      // SIGTERM, then let it flush. The studio owns `_server.json` and a couple
      // of pending writes; SIGKILL first would leave stale state that the next
      // boot reads as a live instance.
      try {
        proc.kill('SIGTERM');
      } catch {
        /* already gone */
      }
      await new Promise((resolve) => {
        const t = setTimer(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            /* already gone */
          }
          resolve();
        }, 5000);
        t?.unref?.();
        proc.on('exit', () => {
          clearTimer(t);
          resolve();
        });
      });
    },
    get port() {
      return port;
    },
    /** What `/health` reports (D5). `ok` is the ONE field a probe should read. */
    status() {
      return {
        ok: ready && child !== null,
        state: !launched
          ? 'idle'
          : stopped
            ? 'stopped'
            : child === null
              ? 'restarting'
              : ready
                ? 'ready'
                : 'starting',
        pid: child?.pid ?? null,
        port,
        restarts,
        startedAt,
        readyAt,
        lastExit,
      };
    },
  };
}

/** Loopback `/_health` probe. Kept tiny and dependency-free — it runs every
 *  250 ms during boot and must not itself be a source of failure. */
async function defaultProbe(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/_health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
