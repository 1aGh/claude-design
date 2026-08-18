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
import { StringDecoder } from 'node:string_decoder';

/** Hard ceiling on a single git invocation. A hung git must not wedge the
 *  agent's queue forever — the change is already safely on disk, so timing out
 *  and retrying on the next quiescence loses nothing. */
const GIT_TIMEOUT_MS = 60_000;

/** Cap captured output. A pathological git error must not become a memory leak. */
const MAX_CAPTURE = 64 * 1024;

/**
 * The ONLY env keys a per-call `env` may set.
 *
 * Default-closed on purpose. git reads a long list of environment variables
 * that redirect what it opens or executes — GIT_DIR / GIT_WORK_TREE /
 * GIT_OBJECT_DIRECTORY / GIT_ALTERNATE_OBJECT_DIRECTORIES re-point the
 * repository, and GIT_SSH_COMMAND / GIT_EXTERNAL_DIFF / GIT_PROXY_COMMAND /
 * GIT_CONFIG_COUNT+KEY+VALUE (via core.fsmonitor, core.sshCommand,
 * uploadpack.packObjectsHook) are all command-execution levers. No caller
 * needs any of them, and the per-call seam exists precisely so FUTURE callers
 * use it — which is when an un-allowlisted merge would become a hole nobody
 * re-reviews. (Security re-review of 8134ca8f, finding A.)
 */
const ALLOWED_CALL_ENV = new Set(['GIT_LITERAL_PATHSPECS']);

/**
 * A GitRunner (the injected shape autocommit.ts expects).
 *
 * `maxCapture` is a per-runner ceiling rather than a constant because one
 * caller genuinely needs more: the history route reads a whole canvas body out
 * of `git show`, and a SILENT truncation there would hand back a half-file that
 * builds into a plausible-looking wrong canvas. It checks the object size with
 * `cat-file -s` first, and this ceiling is the belt behind that braces.
 *
 * `o.env` merges per call, so hardening that must travel with a particular argv
 * (GIT_LITERAL_PATHSPECS with a scoped `git log`) can be passed WITH that argv
 * instead of being baked into every invocation the runner will ever make.
 *
 * @param {object} [opts]
 * @param {NodeJS.ProcessEnv} [opts.env]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.maxCapture]
 * @returns {(args: string[], o: { cwd: string, env?: Record<string,string> }) => Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function createGitRunner({
  env = process.env,
  timeoutMs = GIT_TIMEOUT_MS,
  maxCapture = MAX_CAPTURE,
} = {}) {
  return (args, { cwd, env: callEnv } = {}) =>
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
            ...filterCallEnv(callEnv),
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

      // StringDecoder, NOT `buf.toString()` per chunk. A pipe splits at
      // arbitrary BYTE boundaries (~64 KiB), so a multi-byte sequence
      // straddling two chunks decodes to U+FFFD on each side and the output is
      // silently corrupted — `č` becomes `č\uFFFD\uFFFDč`. Harmless while this
      // runner only carried `add`/`commit`/`push` output (short, ASCII); the
      // history route sends whole canvas bodies through it, and this repo's own
      // canvases carry Czech copy. The route's `cat-file -s`-before-`show`
      // design exists to stop a half-file building into a plausible-looking
      // wrong canvas; this closed the same hole by a different mechanism.
      const outDec = new StringDecoder('utf8');
      const errDec = new StringDecoder('utf8');
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (code, extra) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Flush whatever partial sequence the decoders still hold.
        stdout += outDec.end();
        stderr += errDec.end();
        resolve({ code, stdout, stderr: extra ? `${stderr}${extra}` : stderr });
      };

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(124, `\ngit timed out after ${timeoutMs}ms`);
      }, timeoutMs);

      child.stdout.on('data', (b) => {
        if (stdout.length < maxCapture) stdout += outDec.write(b);
      });
      child.stderr.on('data', (b) => {
        if (stderr.length < MAX_CAPTURE) stderr += errDec.write(b);
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

/** Keep only the env keys a call is allowed to set (see ALLOWED_CALL_ENV). */
function filterCallEnv(callEnv) {
  if (!callEnv) return {};
  const out = {};
  for (const [k, v] of Object.entries(callEnv)) {
    if (ALLOWED_CALL_ENV.has(k)) out[k] = v;
  }
  return out;
}
