// Preflight checker — loads a plugin's dependencies.json and runs each
// dependency's `check.command` (or `check.mcp` probe) to report
// presence / version / missing-ness.
//
// Used by:
//   - cli/commands/doctor.mjs (the unified diagnostic CLI)
//   - plugins/flow/commands/init.md (the wired pre-flight Step 1)
//   - plugins/design/dev-server/bin/preflight.sh (which re-shells to node
//     for the actual checks — keeps detection logic in one place).
//
// Pure-ish: no process.exit; returns an envelope. printReport() is here
// because every consumer wants the same table format.

import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SEM_RE = /(\d+)\.(\d+)\.(\d+)/;

function parseVersion(text) {
  const m = text.match(SEM_RE);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

function checkVersion(stdout, minVersion) {
  if (!minVersion) return { ok: true };
  const have = parseVersion(stdout);
  const want = parseVersion(minVersion);
  if (!have) return { ok: false, reason: `could not parse version from "${stdout.trim()}"` };
  if (!want) return { ok: true };
  if (compareVersions(have, want) < 0) {
    return {
      ok: false,
      reason: `have ${have.join('.')} need ≥ ${want.join('.')}`,
      have: have.join('.'),
    };
  }
  return { ok: true, have: have.join('.') };
}

async function runCommand(command) {
  const r = spawnSync('bash', ['-c', command], { encoding: 'utf8', timeout: 5000 });
  return {
    status: r.status === null ? -1 : r.status,
    stdout: (r.stdout || '').toString(),
    stderr: (r.stderr || '').toString(),
  };
}

export async function checkDependency(dep) {
  // MCP probes — we can't actually call MCP tools from a plain Node script;
  // they're surfaced through Claude Code's tool layer. Mark as `unknown`
  // and let the agent layer fill it in (the agent has visibility into
  // available MCP tools).
  if (dep.type === 'mcp') {
    return {
      id: dep.id,
      status: 'unknown',
      hardness: dep.hardness,
      detail: `MCP probe — not checkable from a non-agent process. Tool: ${dep.check.mcp}${dep.check.tool ? `/${dep.check.tool}` : ''}`,
    };
  }

  const command = dep.check.command || `${dep.id} --version`;
  const expectExit = dep.check.expectExit ?? 0;
  const result = await runCommand(command);

  if (result.status !== expectExit) {
    return {
      id: dep.id,
      status: 'missing',
      hardness: dep.hardness,
      detail:
        result.status === -1 ? 'command timed out or failed to spawn' : `exit ${result.status}`,
      install: dep.install,
    };
  }

  const versionCheck = checkVersion(result.stdout, dep.check.minVersion);
  if (!versionCheck.ok) {
    return {
      id: dep.id,
      status: 'outdated',
      hardness: dep.hardness,
      detail: versionCheck.reason,
      install: dep.install,
    };
  }

  return {
    id: dep.id,
    status: 'ok',
    hardness: dep.hardness,
    version: versionCheck.have || result.stdout.trim().split('\n')[0],
  };
}

export async function loadManifest(manifestPath) {
  const raw = await readFile(resolve(manifestPath), 'utf8');
  return JSON.parse(raw);
}

export async function checkAll(manifestPath) {
  const manifest = await loadManifest(manifestPath);
  const results = [];
  for (const dep of manifest.dependencies) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await checkDependency(dep));
  }
  const hardFailing = results.filter((r) => r.hardness === 'hard' && r.status !== 'ok');
  const softFailing = results.filter((r) => r.hardness === 'soft' && r.status === 'missing');
  return {
    plugin: manifest.plugin,
    results,
    summary: {
      total: results.length,
      ok: results.filter((r) => r.status === 'ok').length,
      missing: results.filter((r) => r.status === 'missing').length,
      outdated: results.filter((r) => r.status === 'outdated').length,
      unknown: results.filter((r) => r.status === 'unknown').length,
      hardFailing: hardFailing.length,
      softFailing: softFailing.length,
      allHardPass: hardFailing.length === 0,
    },
  };
}

const STATUS_GLYPH = {
  ok: '✓',
  missing: '✗',
  outdated: '⚠',
  unknown: '?',
};

export function formatTable(envelope, { color = false } = {}) {
  const lines = [];
  const tag = (s) => (color ? colorFor(s) : s);
  for (const r of envelope.results) {
    const glyph = STATUS_GLYPH[r.status] || '?';
    const label = r.id.padEnd(20);
    let rhs = '';
    if (r.status === 'ok') rhs = r.version || '';
    else if (r.status === 'missing') {
      const hint = (r.install && (r.install[process.platform] || r.install.preferred)) || '';
      rhs = `missing${hint ? ` — ${hint}` : ''}`;
    } else if (r.status === 'outdated') {
      rhs = `outdated (${r.detail})`;
    } else if (r.status === 'unknown') {
      rhs = r.detail || '';
    }
    lines.push(`  ${tag(glyph)} ${label} ${rhs}`);
  }
  return lines.join('\n');
}

function colorFor(g) {
  if (g === '✓') return `[32m${g}[0m`;
  if (g === '✗') return `[31m${g}[0m`;
  if (g === '⚠') return `[33m${g}[0m`;
  return g;
}

// ─── CLI entry — `node cli/lib/preflight.mjs --plugin design --json` ──────

function parseFlags(args) {
  const out = { plugin: null, mode: 'text', cache: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--plugin') out.plugin = args[++i];
    else if (a === '--cache') out.cache = args[++i];
    else if (a === '--json') out.mode = 'json';
    else if (a === '--shell-export') out.mode = 'shell-export';
    else if (a === '--quiet') out.mode = 'quiet';
    else if (a === '--warn-only') out.mode = 'warn-only';
  }
  return out;
}

// Cross-command short-circuit cache (Phase A, Task A15). Written after a
// successful check so sibling commands within the freshness window skip the
// whole preflight. Path is caller-supplied (design → <designRoot>/_preflight.json,
// flow → .ai/state/_preflight.json) because this lib runs with cwd = the maude
// package root when shelled from preflight.sh, not the target repo.
async function writeCache(cachePath, env) {
  const payload = {
    checked: new Date().toISOString(),
    plugin: env.plugin,
    all_hard_pass: env.summary.allHardPass,
    soft_warnings: env.results
      .filter((r) => r.hardness === 'soft' && r.status === 'missing')
      .map((r) => r.id),
  };
  try {
    await writeFile(resolve(cachePath), `${JSON.stringify(payload, null, 2)}\n`);
  } catch {
    // Cache is a best-effort optimization; a write failure (read-only FS,
    // missing parent dir) must never break the preflight itself.
  }
}

function manifestPathForPlugin(pluginName, pkgRoot = process.cwd()) {
  return resolve(pkgRoot, 'plugins', pluginName, 'dependencies.json');
}

// Shared runnable for both the `maude preflight` command and the direct
// `node cli/lib/preflight.mjs` entry. `pkgRoot` is where `plugins/<x>/
// dependencies.json` lives (the maude package root) — resolved independently
// of the caller's cwd, so the command works from any target repo. (DDR-061:
// the marketplace install has no sibling cli/, so callers reach this through
// the on-PATH `maude` binary, which passes its own package root as pkgRoot.)
export async function runPreflight({ args, pkgRoot = process.cwd() }) {
  const flags = parseFlags(args);
  if (!flags.plugin) {
    process.stderr.write('preflight: pass --plugin <design|flow>\n');
    process.exit(2);
  }
  const env = await checkAll(manifestPathForPlugin(flags.plugin, pkgRoot));
  if (flags.cache) await writeCache(flags.cache, env);
  if (flags.mode === 'json') {
    process.stdout.write(`${JSON.stringify(env, null, 2)}\n`);
  } else if (flags.mode === 'shell-export') {
    const missing = env.results
      .filter((r) => r.status === 'missing')
      .map((r) => r.id)
      .join(',');
    process.stdout.write(`export DEPS_OK=${env.summary.allHardPass ? 1 : 0}\n`);
    process.stdout.write(`export DEPS_MISSING="${missing}"\n`);
    process.stdout.write(`export DEPS_PLUGIN="${env.plugin}"\n`);
  } else if (flags.mode === 'quiet' || flags.mode === 'warn-only') {
    const missingHard = env.results.filter(
      (r) => r.hardness === 'hard' && r.status !== 'ok' && r.status !== 'unknown'
    );
    if (missingHard.length > 0) {
      const ids = missingHard.map((r) => r.id).join(', ');
      process.stdout.write(`MISSING HARD DEPS: ${ids}. Run \`maude doctor --fix\` to install.\n`);
    }
  } else {
    process.stdout.write(`Dependencies (plugin: ${env.plugin}):\n`);
    process.stdout.write(`${formatTable(env, { color: process.stdout.isTTY })}\n`);
    process.stdout.write(
      `\nSummary: ${env.summary.ok}/${env.summary.total} ok, ${env.summary.hardFailing} hard failing, ${env.summary.softFailing} soft missing.\n`
    );
  }
  process.exit(env.summary.allHardPass ? 0 : 1);
}

// Entry guard — only run when invoked directly (`node cli/lib/preflight.mjs`).
// The package root is the cwd here (preflight.sh `cd`s to it before exec).
if (import.meta.url === `file://${process.argv[1]}`) {
  runPreflight({ args: process.argv.slice(2), pkgRoot: process.cwd() }).catch((err) => {
    process.stderr.write(`preflight: ${err.message}\n`);
    process.exit(1);
  });
}
