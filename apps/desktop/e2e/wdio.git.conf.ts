/**
 * WebdriverIO config for the git-branch-switcher scenario (DDR-133).
 *
 * Same harness as wdio.conf.ts, but boots the app into a GENERATED multi-branch
 * git repo (make-git-fixture) instead of the static non-git fixture — the switcher
 * only renders for a git repo. Run: `pnpm test:e2e:desktop:git`.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeGitFixture } from './fixtures/make-git-fixture';
import { config as base } from './wdio.conf';

const HERE = dirname(fileURLToPath(import.meta.url));

// Boot into the freshly-built multi-branch git repo (overrides the base's static
// fixture). The app reads MAUDE_PROJECT_ROOT at spawn, so this last write wins.
process.env.MAUDE_PROJECT_ROOT = makeGitFixture();

// Per-run evidence under this scenario's slug (same convention as /flow:scenario).
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
process.env.MAUDE_E2E_RUN_DIR = resolve(
  HERE,
  '../../../.ai/device/scenario-runs/git-branch-switcher',
  stamp
);

export const config: WebdriverIO.Config = {
  ...base,
  specs: [resolve(HERE, 'scenarios', 'git-branch-switcher.e2e.ts')],
};
