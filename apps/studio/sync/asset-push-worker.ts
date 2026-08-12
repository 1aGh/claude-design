// The asset sweep, in its own process — feature-sync-resync-and-out-of-process-sweep.
//
// WHY A SEPARATE PROCESS.
//
// The sweep crashes Bun 1.3.3 *when it runs alongside the dev server*, proven by
// isolation: the identical sweep against the same live hub completes standalone
// (182/182, 0 failures) and crash-loops in-process (three `Segmentation fault at
// address 0x0` plus a bus error, then the supervisor gave up after 3 restarts).
// Nobody has a fix for the fault itself, so the boundary is the fix: a fault
// here costs the sweep, and the editor — canvases, browser UI, ACP panel —
// stays up. The parent reports the dead child as a failed sweep.
//
// It is also what makes a Resync button safe to offer at all: pressing it
// re-runs this, and a button that can kill the person's dev server is not a
// button.
//
// PROTOCOL. argv gives the design root, the hub URL and a file holding the
// credential. stdout carries NDJSON — one tagged JSON object per line:
//
//   {"t":"progress", …AssetPushProgress}   many, throttled by pushAssets
//   {"t":"result",   …AssetPushResult}     exactly one, on a clean finish
//   {"t":"error", "message": "…"}          exactly one, on a thrown sweep
//
// Tagged rather than positional ("the last line is the result") so a parent
// reading a truncated stream can still tell a final answer from a progress
// tick. Nothing else may reach stdout — one stray `console.log` from an import
// would land mid-stream — so diagnostics go to stderr, which the parent logs.
//
// THE CREDENTIAL ARRIVES IN A FILE, NEVER IN ARGV. `ps` is world-readable on
// every platform this ships to; a hub token on a command line is a hub token
// handed to every other user on the machine. The file is written 0600 by the
// parent and unlinked when the sweep ends. It is re-read per call, not cached,
// so a parent that rewrites it after a silent renewal is picked up mid-sweep.

import { readFileSync } from 'node:fs';

import { type AssetPushProgress, type AssetPushResult, pushAssets } from './asset-push.ts';

const [, , designRoot, hubUrl, tokenFile] = process.argv;

/** One NDJSON line. Synchronous — ordering with the result line is the contract. */
function emit(line: { t: 'progress' | 'result' | 'error' } & Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

async function main(): Promise<void> {
  if (!designRoot || !hubUrl || !tokenFile) {
    emit({ t: 'error', message: 'usage: <designRoot> <hubUrl> <tokenFile>' });
    process.exit(2);
  }

  // Read at call time — `pushAssets` asks per request, and a renewal mid-sweep
  // rewrites the file underneath us. A read that fails (the parent unlinked it
  // during teardown) falls back to the last value we saw rather than sending an
  // empty Authorization, which the hub would answer 401 for every remaining
  // file and report as 182 failures instead of one dead sweep.
  let lastToken = '';
  const token = (): string => {
    try {
      lastToken = readFileSync(tokenFile, 'utf8').trim() || lastToken;
    } catch {
      /* keep the last good one */
    }
    return lastToken;
  };

  const result: AssetPushResult = await pushAssets({
    designRoot,
    hubUrl,
    token,
    // stderr, never stdout — stdout is the protocol.
    log: {
      log: (...a: unknown[]) => process.stderr.write(`${a.join(' ')}\n`),
      warn: (...a: unknown[]) => process.stderr.write(`${a.join(' ')}\n`),
    },
    onProgress: (p: AssetPushProgress) => emit({ t: 'progress', ...p }),
  });
  emit({ t: 'result', ...result });
}

main().catch((err) => {
  emit({ t: 'error', message: String((err as Error)?.message ?? err).slice(0, 2000) });
  process.exit(1);
});
