// The parent half of the out-of-process asset sweep — feature-sync-resync-and-
// out-of-process-sweep. The child is `asset-push-worker.ts`; read its header
// first, it carries the protocol and the reason the boundary exists at all.
//
// What this module owns:
//
//   • spawning the child the way the packaged app can actually run it (DDR-177 —
//     the compiled sidecar re-entered as a JS runtime, never a user-installed
//     `bun`), reusing the sandbox's own resolver so the two cannot drift;
//   • handing over the credential through a 0600 file that is unlinked when the
//     sweep ends, because argv is world-readable via `ps`;
//   • turning NDJSON lines back into the `AssetPushProgress` the panel already
//     consumes, so `_sync.json`, the WS fanout and the Sync panel are untouched;
//   • making a DEAD CHILD a reported failure instead of a silent stall. Before
//     the boundary, a fault took the dev server with it; after it, the sweep is
//     the only casualty and the panel has to say so — an asset lane frozen at
//     "92 of 182" forever is the failure mode this whole change is about.

import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveBunPath, workerEnv } from '../canvas-build-sandbox.ts';
import { DEV_SERVER_ROOT } from '../paths.ts';
import type { AssetPushProgress, AssetPushResult } from './asset-push.ts';

/** A stray unterminated flood must not grow the parent's heap. */
const MAX_LINE_BYTES = 1024 * 1024;

/** How much of the child's stderr is kept for the failure message. */
const STDERR_KEEP = 2000;

/** Grace between SIGTERM and SIGKILL when a sweep is cancelled. */
const KILL_GRACE_MS = 2000;

/**
 * How often the parent checks whether the credential has been renewed.
 *
 * A sweep can run for minutes; `scheduleRenewal` can swap the runtime's token
 * underneath it. In-process that was free (the old call read `() => token` per
 * request). Across the boundary the child re-reads its file per request, so the
 * PARENT has to keep that file current or a renewal mid-sweep turns every
 * remaining upload into a 401.
 */
const TOKEN_REFRESH_MS = 30_000;

export interface AssetSweepHandle {
  /** The sweep's result, or `null` when it did not finish (crash / cancel). */
  done: Promise<AssetPushResult | null>;
  /** Stop the sweep. Idempotent; safe after completion. */
  cancel(): void;
}

/** Absolute path to the child entry, resolved per DDR-045 (never a bunfs path). */
export function assetWorkerScript(): string {
  return join(DEV_SERVER_ROOT, 'sync', 'asset-push-worker.ts');
}

export function runAssetSweep(opts: {
  designRoot: string;
  hubUrl: string;
  /**
   * Read at call time — silent renewal swaps the credential in place, exactly
   * as the in-process sweep's `() => token` did. The value is written 0600 to a
   * temp file the child re-reads, and re-written when it changes.
   */
  token: () => string;
  onProgress?: (p: AssetPushProgress) => void;
  env?: NodeJS.ProcessEnv;
  log?: Pick<Console, 'log' | 'warn'>;
  /** Test injection — the spawn and the script path. */
  spawn?: typeof Bun.spawn;
  script?: string;
}): AssetSweepHandle {
  const log = opts.log ?? console;
  const spawn = opts.spawn ?? Bun.spawn;
  const env = opts.env ?? process.env;

  let cancelled = false;
  let child: Bun.Subprocess<'ignore', 'pipe', 'pipe'> | null = null;
  let killTimer: ReturnType<typeof setTimeout> | null = null;
  // The last thing the child told us — the base for the final emit we have to
  // synthesize ourselves when it never gets to send one.
  let last: AssetPushProgress | null = null;

  const emit = (p: AssetPushProgress): void => {
    last = p;
    try {
      opts.onProgress?.(p);
    } catch (err) {
      log.warn(`[sync/assets] progress listener threw: ${(err as Error).message}`);
    }
  };

  /**
   * The sweep stopped without finishing. Say so ONCE, in the payload the panel
   * already reads, keeping whatever counts we had — a lane that stops at "92 of
   * 182" and stays there is the exact lie this replaces.
   */
  const emitStopped = (reason: string): void => {
    const base = last;
    const failures = (base?.failures ?? []).slice();
    failures.push({ key: '(sweep)', reason });
    emit({
      total: base?.total ?? 0,
      done: base?.done ?? 0,
      pushed: base?.pushed ?? 0,
      skipped: base?.skipped ?? 0,
      failedCount: (base?.failedCount ?? 0) + 1,
      failures,
      active: null,
      finished: true,
    });
  };

  const done = (async (): Promise<AssetPushResult | null> => {
    // A temp DIRECTORY, so the 0600 file is also inside a 0700 dir — the file
    // mode alone is enough on every platform we ship to, but a private parent
    // costs nothing and closes the window between create and chmod.
    const dir = mkdtempSync(join(tmpdir(), 'maude-sweep-'));
    const tokenFile = join(dir, 'hub-token');
    let refresh: ReturnType<typeof setInterval> | null = null;
    try {
      // Temp-then-rename on every write, including the first: the child reads
      // this file per request, and a plain overwrite can be observed half-done.
      let written = '';
      const putToken = (value: string): void => {
        if (!value || value === written) return;
        const tmp = `${tokenFile}.tmp`;
        writeFileSync(tmp, value, { mode: 0o600 });
        renameSync(tmp, tokenFile);
        written = value;
      };
      putToken(opts.token());
      refresh = setInterval(() => {
        try {
          putToken(opts.token());
        } catch (err) {
          log.warn(
            `[sync/assets] could not refresh the sweep credential: ${(err as Error).message}`
          );
        }
      }, TOKEN_REFRESH_MS);
      refresh.unref?.();

      const script = opts.script ?? assetWorkerScript();
      try {
        child = spawn([resolveBunPath(env), script, opts.designRoot, opts.hubUrl, tokenFile], {
          env: workerEnv(env),
          cwd: opts.designRoot,
          stdin: 'ignore',
          stdout: 'pipe',
          stderr: 'pipe',
        }) as Bun.Subprocess<'ignore', 'pipe', 'pipe'>;
      } catch (err) {
        // Never fall back to sweeping in-process: that is the crash this whole
        // boundary exists to survive, and it would come back invisibly.
        emitStopped(`the asset sweep could not start: ${(err as Error).message}`);
        return null;
      }

      // Cancel may have been called between the handle being returned and the
      // spawn landing — honour it rather than letting a doomed sweep run.
      if (cancelled) child.kill('SIGTERM');

      let result: AssetPushResult | null = null;
      let childError: string | null = null;
      let stderr = '';

      const drainErr = (async () => {
        try {
          stderr = (await new Response(child?.stderr).text()).slice(-STDERR_KEEP);
        } catch {
          /* the stream died with the process — nothing to keep */
        }
      })();

      let buf = '';
      const decoder = new TextDecoder();
      try {
        for await (const chunk of child.stdout as ReadableStream<Uint8Array>) {
          buf += decoder.decode(chunk, { stream: true });
          let nl = buf.indexOf('\n');
          while (nl !== -1) {
            const line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            nl = buf.indexOf('\n');
            if (!line.trim()) continue;
            let parsed: { t?: string; message?: unknown } & Record<string, unknown>;
            try {
              parsed = JSON.parse(line);
            } catch {
              // Defensive: a stray write from an import would land mid-stream.
              // Dropping the line keeps the sweep readable instead of ending it.
              continue;
            }
            // The tag is transport, not payload — `progress` lands in
            // `_sync.json` and every open tab, so it goes out the way the
            // in-process sweep used to emit it, with no extra field.
            const { t, ...payload } = parsed;
            if (t === 'progress') emit(payload as unknown as AssetPushProgress);
            else if (t === 'result') result = payload as unknown as AssetPushResult;
            else if (t === 'error') childError = String(parsed.message ?? 'unknown');
          }
          if (buf.length > MAX_LINE_BYTES) buf = '';
        }
      } catch (err) {
        childError ??= `the sweep's output could not be read: ${(err as Error).message}`;
      }

      await child.exited;
      await drainErr;
      if (killTimer) clearTimeout(killTimer);

      const code = child.exitCode;
      const signal = child.signalCode;

      if (cancelled) {
        emitStopped('cancelled');
        return null;
      }
      if (result && code === 0) return result;

      // Everything below is a sweep that did not finish. Name WHY as concretely
      // as the child let us — a signal is the segfault class this boundary was
      // built for, and the panel saying "stopped unexpectedly (SIGSEGV)" is what
      // turns an invisible stall into a bug report.
      const why = childError
        ? `the asset sweep failed: ${childError}`
        : signal
          ? `the asset sweep stopped unexpectedly (${signal})`
          : `the asset sweep exited with code ${code}`;
      log.warn(`[sync/assets] ${why}${stderr ? `\n${stderr.trim()}` : ''}`);
      emitStopped(why);
      return null;
    } finally {
      if (refresh) clearInterval(refresh);
      child = null;
      rmSync(dir, { recursive: true, force: true });
    }
  })();

  return {
    done,
    cancel(): void {
      if (cancelled) return;
      cancelled = true;
      if (!child) return;
      child.kill('SIGTERM');
      // A child wedged inside a socket read will not notice SIGTERM; the whole
      // point of cancel is that it always ends.
      killTimer = setTimeout(() => {
        try {
          child?.kill('SIGKILL');
        } catch {
          /* already gone */
        }
      }, KILL_GRACE_MS);
      killTimer.unref?.();
    },
  };
}
