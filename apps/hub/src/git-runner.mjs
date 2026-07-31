// git as a subprocess — the effects layer under the workspace agent.
// Cloud Phase 16 Tasks 1/2.
//
// Deliberately thin: it runs git and reports what happened. Every decision
// about WHETHER to commit, WHAT to stage, and WHO authored it lives in
// autocommit.ts (append-only, quiescence-batched, author≠committer). Putting
// any of that here would give the system two places to reason about history.
//
// Nothing in this file ever runs a history-rewriting verb. That is enforced by
// the caller's argv (autocommit.ts only ever emits `add` / `commit` / `push`)
// and asserted in tests; it is repeated here as a comment because the next
// person to add a "just clean the tree first" call will read this file, not
// that one.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Hard ceiling on a single git invocation. A hung git must not wedge the
 *  agent's queue forever — the change is already safely on disk, so timing out
 *  and retrying on the next quiescence loses nothing. */
const GIT_TIMEOUT_MS = 60_000;

/** Cap captured output. A pathological git error must not become a memory leak. */
const MAX_CAPTURE = 64 * 1024;

/**
 * A GitRunner (the injected shape autocommit.ts expects).
 *
 * @param {object} [opts]
 * @param {NodeJS.ProcessEnv} [opts.env]
 * @param {number} [opts.timeoutMs]
 * @returns {(args: string[], o: { cwd: string }) => Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function createGitRunner({ env = process.env, timeoutMs = GIT_TIMEOUT_MS } = {}) {
  return (args, { cwd }) =>
    new Promise((resolve) => {
      let child;
      try {
        child = spawn('git', args, {
          cwd,
          // No shell, ever. Canvas names reach these argv entries, and a shell
          // here would turn a filename into a command.
          shell: false,
          env: {
            ...env,
            // git must never stop to ask a human that does not exist. Without
            // this, a credential prompt inside a container hangs until the
            // timeout on every single push.
            GIT_TERMINAL_PROMPT: '0',
            GIT_ASKPASS: '',
            // Deterministic, parseable output regardless of the host locale.
            LC_ALL: 'C',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        resolve({ code: 127, stdout: '', stderr: `spawn git failed: ${err.message}` });
        return;
      }

      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (code, extra) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ code, stdout, stderr: extra ? `${stderr}${extra}` : stderr });
      };

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(124, `\ngit timed out after ${timeoutMs}ms`);
      }, timeoutMs);

      child.stdout.on('data', (b) => {
        if (stdout.length < MAX_CAPTURE) stdout += b.toString();
      });
      child.stderr.on('data', (b) => {
        if (stderr.length < MAX_CAPTURE) stderr += b.toString();
      });
      child.on('error', (err) => finish(127, `\n${err.message}`));
      child.on('close', (code) => finish(code ?? 1));
    });
}

/**
 * Make `repoDir` a usable git repository, idempotently.
 *
 * Reports rather than throws, for the same reason first-user.mjs does: a cell
 * whose git setup failed should still serve the tenant's work — sync, presence
 * and the canvas list all function without history. Losing history is bad;
 * refusing to open the project because history is unavailable is worse.
 *
 * @returns {Promise<{ state: 'ready'|'created'|'failed', reason?: string }>}
 */
export async function ensureRepo(repoDir, run, { bot } = {}) {
  const name = bot?.name || 'Maude Workspace';
  const email = bot?.email || 'workspace@maude.sh';

  const already = existsSync(join(repoDir, '.git'));
  try {
    if (!already) {
      // `-b main` so the cell never depends on the host git's init.defaultBranch,
      // which differs between the build image and the runtime image.
      const init = await run(['init', '-b', 'main'], { cwd: repoDir });
      if (init.code !== 0) return { state: 'failed', reason: `git init: ${init.stderr.trim()}` };
    }

    // The checkout is owned by the cell's unprivileged user, but a volume
    // restored from a backup can carry another uid. Without this, git refuses
    // every command with "detected dubious ownership" and the failure surfaces
    // as "history mysteriously stopped".
    const safe = await run(['config', 'safe.directory', repoDir], { cwd: repoDir });
    if (safe.code !== 0) return { state: 'failed', reason: `git config: ${safe.stderr.trim()}` };

    // The COMMITTER identity. The author is set per-commit from presence
    // (autocommit.ts) — this is only the machine's own name.
    for (const [key, value] of [
      ['user.name', name],
      ['user.email', email],
    ]) {
      const r = await run(['config', key, value], { cwd: repoDir });
      if (r.code !== 0) return { state: 'failed', reason: `git config ${key}: ${r.stderr.trim()}` };
    }

    return { state: already ? 'ready' : 'created' };
  } catch (err) {
    return { state: 'failed', reason: err.message };
  }
}

/** True when `git` is on PATH and runnable. */
export async function gitAvailable(run) {
  const r = await run(['--version'], { cwd: process.cwd() });
  return r.code === 0;
}
