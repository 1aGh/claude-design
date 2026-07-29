#!/usr/bin/env node
// Cold-start rehydrate — Cloud Phase 5 Task 1, actually written in Phase 15.
//
// The cell entrypoint has invoked this file since Phase 5. It did not exist,
// so every cold start would have died on `Cannot find module` and the
// entrypoint would have refused to boot — correctly, but for the wrong
// reason, and the cell image had never been built so nobody found out.
//
// WHAT IT DOES. Restores the newest COMPLETE backup generation into the
// working set: the SQLite databases into DATA_DIR, and the git checkout from
// the same generation's bundle into MAUDE_REPO_DIR. One generation for both —
// see repo-checkpoint.mjs for why mixing them is corruption.
//
// WHY THIS IS THE NORMAL PATH, NOT RECOVERY. A cell's disk is ephemeral and
// the platform migrates instances whenever it likes. Making wake-from-cold use
// the exact same code as the restore drill means the restore path is exercised
// every single wake instead of once a quarter, which is the only way to know
// it works.
//
// EXITS NON-ZERO ON ANY DOUBT. The entrypoint treats that as fatal, and it
// should: a cell that starts with an empty working set is indistinguishable
// from a deleted project to the person opening it, and the autosave agent
// would then commit that emptiness over their real work.
//
//   node src/rehydrate.mjs --data /data --repo /repo

import { existsSync, readdirSync } from 'node:fs';

import { listBackups, restoreLatest, targetFromEnv } from './backup.mjs';
import { createGitRunner } from './git-runner.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function isEmptyish(dir) {
  if (!existsSync(dir)) return true;
  try {
    // `lost+found` on a fresh ext4 volume is not content.
    return readdirSync(dir).filter((n) => n !== 'lost+found').length === 0;
  } catch {
    return true;
  }
}

async function main() {
  const dataDir = arg('data', process.env.DATA_DIR ?? '/data');
  const repoDir = arg('repo', process.env.MAUDE_REPO_DIR ?? '/repo');

  const target = targetFromEnv();
  if (!target) {
    // No object storage ⇒ nothing to rehydrate FROM. That is a legitimate
    // local/dev configuration, not a failure: there is no earlier state to
    // lose. The entrypoint only calls this when a bucket IS configured, so
    // reaching here means the config disagrees with itself — say so.
    console.error('[rehydrate] no object storage configured — nothing to restore from');
    process.exit(1);
  }

  let generations;
  try {
    generations = await listBackups(target);
  } catch (err) {
    console.error(`[rehydrate] cannot reach ${target.describe}: ${err.message}`);
    process.exit(1);
  }

  if (generations.length === 0) {
    // FIRST BOOT. There has never been a backup because this tenant has never
    // run — which is a completely normal state and must NOT be an error, or no
    // cell could ever start for the first time. Distinguished from "the backup
    // is gone" by the working set also being empty: if there is local data but
    // no generation, something is wrong enough to stop for.
    if (isEmptyish(dataDir)) {
      console.log('[rehydrate] no backup generations and an empty working set — first boot');
      process.exit(0);
    }
    console.error(
      '[rehydrate] the working set has data but object storage has NO complete backup ' +
        'generation. Refusing to continue: either the bucket is wrong or backups have ' +
        'never succeeded, and both are worth stopping for.'
    );
    process.exit(1);
  }

  try {
    const result = await restoreLatest({
      target,
      destDir: dataDir,
      repoDir,
      run: createGitRunner(),
      // The working set is empty on a cold start — that is the precondition
      // the entrypoint checks before calling us. Not forcing means a restore
      // over live data fails loudly instead of overwriting it.
      force: false,
    });
    console.log(
      `[rehydrate] restored ${result.generation} — ` +
        `${result.restored.join(', ')}${result.repo?.state === 'restored' ? ' + checkout' : ''}`
    );
    if (result.manifest.repo && result.repo?.state !== 'restored') {
      // The generation carried a checkout and we did not end up with one. The
      // documents would open against an empty history, and the autosave agent
      // would commit over it.
      console.error(
        `[rehydrate] the generation contains a checkout but it was not restored ` +
          `(${result.repo?.reason ?? 'unknown'})`
      );
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`[rehydrate] restore failed: ${err.message}`);
    process.exit(1);
  }
}

await main();
