// Boot-time self-heal — covers the gap between marketplace-cache installs
// (git clone, honors .gitignore, no `npm install`) and what server.ts needs
// at runtime. Two artifacts can be missing on a fresh clone:
//
//   - dist/client.bundle.js     → 404 on /_client/*
//   - node_modules/react        → 500 on /_canvas-runtime/*
//
// Per DDR-044 we commit the bundle + styles, so dist/ should be present.
// For node_modules/ we self-heal: detect missing react, run `bun install
// --production`. Opt out with MAUDE_NO_AUTOBUILD=1 for read-only-filesystem
// deployments (e.g. immutable infra).
//
// Phase 19. DDR-044.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SelfHealOptions {
  /** Plugin install directory (the dev-server root). Defaults to this file's dir. */
  here?: string;
  /** Defaults to process.env.MAUDE_NO_AUTOBUILD === '1'. */
  optOut?: boolean;
  /** Defaults to Bun.spawn; tests override. */
  spawn?: (cmd: readonly string[], cwd: string) => Promise<{ code: number }>;
  /** Defaults to console.error; tests override to capture. */
  log?: (msg: string) => void;
  /** Defaults to process.exit; tests override to assert. */
  exit?: (code: number) => never;
}

export interface SelfHealResult {
  ran: ('install' | 'build')[];
  skipped: 'all-present' | null;
}

export async function bootSelfHeal(opts: SelfHealOptions = {}): Promise<SelfHealResult> {
  const here = opts.here ?? dirname(fileURLToPath(import.meta.url));
  const optOut = opts.optOut ?? process.env.MAUDE_NO_AUTOBUILD === '1';
  const log = opts.log ?? ((m) => console.error(m));
  const exit =
    opts.exit ??
    ((code: number) => {
      process.exit(code);
    });
  const spawn = opts.spawn ?? defaultSpawn;

  const distMissing = !existsSync(join(here, 'dist', 'client.bundle.js'));
  const depsMissing = !existsSync(join(here, 'node_modules', 'react', 'package.json'));

  if (!distMissing && !depsMissing) return { ran: [], skipped: 'all-present' };

  if (optOut) {
    const missing = [
      distMissing ? 'dist/client.bundle.js (run `bun run build.ts`)' : null,
      depsMissing ? 'node_modules/react (run `bun install --production`)' : null,
    ]
      .filter(Boolean)
      .join('\n  - ');
    log(`\n  ⚠ first-boot artifacts missing and MAUDE_NO_AUTOBUILD=1 is set:\n  - ${missing}\n`);
    exit(1);
  }

  const ran: ('install' | 'build')[] = [];
  if (depsMissing) {
    log('  ⚠ first-boot: installing runtime deps (one-time, ~15s)…');
    const { code } = await spawn(['bun', 'install', '--production'], here);
    if (code !== 0) {
      log(
        `  ⚠ \`bun install --production\` exited ${code}. Set MAUDE_NO_AUTOBUILD=1 and run manually.`
      );
      exit(1);
    }
    ran.push('install');
  }
  if (distMissing) {
    log('  ⚠ first-boot: building client assets (one-time, ~2s)…');
    const { code } = await spawn(['bun', 'run', 'build.ts'], here);
    if (code !== 0) {
      log(`  ⚠ \`bun run build.ts\` exited ${code}. Set MAUDE_NO_AUTOBUILD=1 and run manually.`);
      exit(1);
    }
    ran.push('build');
  }
  return { ran, skipped: null };
}

async function defaultSpawn(cmd: readonly string[], cwd: string): Promise<{ code: number }> {
  const proc = Bun.spawn([...cmd], { cwd, stdout: 'inherit', stderr: 'inherit' });
  const code = await proc.exited;
  return { code };
}
