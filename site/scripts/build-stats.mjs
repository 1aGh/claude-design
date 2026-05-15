#!/usr/bin/env node
// Compute project stats consumed by the landing page + docs page-meta footer.
// Reads version from package.json, asset counts from plugins/<p>/{commands,skills,agents},
// last-release date from `git for-each-ref refs/tags/v*`, contributor count from
// `git shortlog -sne`, and per-page last-updated dates from `git log -1`.
//
// Output: site/lib/stats.json (gitignored — regenerated every build).
// Run as prebuild step — see site/package.json `prebuild`.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const out = resolve(__dirname, '../lib/stats.json');
const docsRoot = resolve(__dirname, '../content/docs');

const sh = (cmd, fallback = '') => {
  try {
    return execSync(cmd, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return fallback;
  }
};

async function countFiles(dir, { extensions, excludeUnderscore = false } = {}) {
  const full = resolve(repoRoot, dir);
  if (!existsSync(full)) return 0;
  const entries = await readdir(full, { withFileTypes: true });
  return entries.filter((e) => {
    if (!e.isFile()) return false;
    if (excludeUnderscore && e.name.startsWith('_')) return false;
    if (extensions && !extensions.some((ext) => e.name.endsWith(ext))) return false;
    return true;
  }).length;
}

async function countDirs(dir) {
  const full = resolve(repoRoot, dir);
  if (!existsSync(full)) return 0;
  const entries = await readdir(full, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).length;
}

// Walk content/docs/**/*.mdx → map of fumadocs `page.path` → ISO date.
// fumadocs `page.path` is the relative path from content/docs/ to the .mdx file
// (e.g. "design/bootstrap.mdx", "recipes/nextjs.mdx", "index.mdx").
async function buildPageUpdatedMap() {
  const map = {};
  async function walk(dir) {
    const full = resolve(docsRoot, dir);
    if (!existsSync(full)) return;
    const entries = await readdir(full, { withFileTypes: true });
    for (const entry of entries) {
      const rel = dir ? join(dir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        await walk(rel);
      } else if (entry.name.endsWith('.mdx')) {
        // Skip auto-generated reference pages — their content is derived from
        // the plugin command files, so use the plugin file's mtime instead.
        const file = resolve(docsRoot, rel);
        const date = sh(`git log -1 --format=%cs -- '${file}'`);
        if (date) map[rel] = date;
      }
    }
  }
  await walk('');
  return map;
}

const pkg = JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf8'));

const lastTagDate =
  sh(
    "git for-each-ref --sort=-creatordate --count=1 --format='%(creatordate:short)' refs/tags/v*"
  ) ||
  sh('git log -1 --format=%cs -- package.json') ||
  new Date().toISOString().slice(0, 10);

// `git shortlog -sne` honors .mailmap (collapses identities). We then drop bot
// accounts (dependabot, renovate, etc.) so the count reflects humans.
const contributorsRaw = sh('git shortlog -sne main');
const contributors = contributorsRaw
  ? contributorsRaw
      .split('\n')
      .filter(Boolean)
      .filter((line) => !/\[bot\]/i.test(line)).length
  : 0;

const stats = {
  // Regenerated every build — do NOT edit by hand. See site/scripts/build-stats.mjs.
  version: `v${pkg.version}`,
  nodeRange: pkg.engines?.node ?? '>=20',
  publishedDate: lastTagDate,
  contributors,
  plugins: {
    design: {
      commands: await countFiles('plugins/design/commands', {
        extensions: ['.md'],
        excludeUnderscore: true,
      }),
      skills: await countDirs('plugins/design/skills'),
      agents: await countFiles('plugins/design/agents', { extensions: ['.md'] }),
    },
    flow: {
      commands: await countFiles('plugins/flow/commands', {
        extensions: ['.md'],
        excludeUnderscore: true,
      }),
      skills: await countDirs('plugins/flow/skills'),
      agents: await countFiles('plugins/flow/agents', { extensions: ['.md'] }),
    },
    mdcc: {
      subcommands: await countFiles('cli/commands', { extensions: ['.mjs'] }),
    },
  },
  pageUpdated: await buildPageUpdatedMap(),
};

await writeFile(out, `${JSON.stringify(stats, null, 2)}\n`);

const designP = stats.plugins.design;
const flowP = stats.plugins.flow;
console.log(
  `[stats] wrote ${out}\n` +
    `        version=${stats.version} · published=${stats.publishedDate} · contributors=${stats.contributors}\n` +
    `        design: ${designP.commands}c / ${designP.skills}s / ${designP.agents}a · ` +
    `flow: ${flowP.commands}c / ${flowP.skills}s / ${flowP.agents}a · ` +
    `mdcc: ${stats.plugins.mdcc.subcommands}sub\n` +
    `        page-updated entries: ${Object.keys(stats.pageUpdated).length}`
);
