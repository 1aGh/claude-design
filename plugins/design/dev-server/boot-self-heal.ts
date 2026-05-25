// Boot-time artifact check — Phase 19 / DDR-044, simplified in v0.18.1.
//
// The two artifacts the server cannot run without:
//   - dist/client.bundle.js   (the React shell that hydrates the / route)
//   - dist/runtime/react.js   (pre-built canvas-runtime bundle for TSX iframes)
//
// Both are committed to git per DDR-044 and ship in every distribution:
// npm tarball (via package.json#files override of .gitignore), marketplace
// cache (negation entries in .gitignore preserve them through git clone),
// and bun --compile binary (embedded via the build pipeline).
//
// v0.18.0 ALSO tried to `bun install --production` if node_modules/react
// was missing. That assumption was wrong: (a) npm install of the root
// @1agh/maude package never installs nested workspace deps, (b) the
// compiled binary's import.meta.url resolves to the virtual /$bunfs/root
// so existsSync against it always failed and the self-heal false-triggered,
// (c) standalone bun --compile binaries don't inherit shell PATH the same
// way subshells do, so even when bun WAS available, Bun.spawn(['bun',...])
// failed with ENOENT. The greenfield npm-install user hit all three at
// once and got a stacktrace. v0.18.1 drops the install/build attempt
// entirely — pre-built runtime bundles ship with the artifact, no fix-up
// pass needed.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { DEV_SERVER_ROOT, DIST_DIR, RUNTIME_BUNDLES_DIR } from './paths.ts';

export interface SelfHealOptions {
  /** Defaults to DEV_SERVER_ROOT from paths.ts (real disk install dir). */
  here?: string;
  /** Defaults to console.error; tests override to capture. */
  log?: (msg: string) => void;
  /** Defaults to process.exit; tests override to assert without aborting. */
  exit?: (code: number) => never;
}

export interface SelfHealResult {
  /** Names of artifacts the check verified are present. */
  verified: ('client.bundle.js' | 'runtime/react.js')[];
}

/**
 * Verify the committed artifacts the dev-server depends on are reachable
 * from the resolved install dir. If anything is missing, exit with a clear
 * remediation message — this means the install is broken, not a transient
 * first-boot gap. Always passes for npm installs, marketplace cache clones,
 * and `bun --compile` binaries built on a freshly-built repo.
 */
export async function bootSelfHeal(opts: SelfHealOptions = {}): Promise<SelfHealResult> {
  const here = opts.here ?? DEV_SERVER_ROOT;
  const log = opts.log ?? ((m) => console.error(m));
  const exit =
    opts.exit ??
    ((code: number) => {
      process.exit(code);
    });

  const dist = here === DEV_SERVER_ROOT ? DIST_DIR : join(here, 'dist');
  const runtime = here === DEV_SERVER_ROOT ? RUNTIME_BUNDLES_DIR : join(dist, 'runtime');

  const missing: string[] = [];
  if (!existsSync(join(dist, 'client.bundle.js'))) missing.push('dist/client.bundle.js');
  if (!existsSync(join(runtime, 'react.js'))) missing.push('dist/runtime/react.js');

  if (missing.length > 0) {
    log(
      [
        '',
        '  ⚠ dev-server install is missing committed artifacts:',
        ...missing.map((m) => `  - ${m}`),
        '',
        `  Looked under: ${here}`,
        '',
        '  This means your install is corrupted or pre-Phase-19.1. Fix:',
        '    npm uninstall -g @1agh/maude && npm i -g @1agh/maude',
        '  (or remove + re-add the marketplace plugin in Claude Code)',
        '',
      ].join('\n')
    );
    exit(1);
  }

  return {
    verified: ['client.bundle.js', 'runtime/react.js'],
  };
}
