// `maude doctor` — unified workspace diagnostic.
// Combines (1) plugin dependency preflight, (2) workflows.config.json schema
// validation, (3) stack drift, (4) quality-gate additions, and (5) linked
// design-hub / TSX-sync health (report-only, local signals — no network) into
// one report.
//
// Flags:
//   --plugin <name>   Scope deps section to one plugin. Config section is
//                     always global.
//   --fix             Apply safe auto-fixes: per-dep prompts for autoInstall
//                     deps, silent drops of unknown schema keys, silent
//                     drift-resync for keys where detector returned a
//                     concrete value, silent additive quality merges.
//                     NEVER touches a key the user already wrote a non-trivial
//                     value into.
//   --json            Machine-readable envelope.
//
// Exit: 1 if any hard dep missing OR any schema error; 0 otherwise (drift +
// additions are warnings).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from '../lib/argv.mjs';
import { lintConfig } from '../lib/config-lint.mjs';
import {
  describeGitignoreDrift,
  findGitignoreDrift,
  removeGitignoreDrift,
} from '../lib/gitignore-drift.mjs';
import { getHub } from '../lib/hubs-config.mjs';
import { checkAll } from '../lib/preflight.mjs';
import { detectQualityGates, detectStack } from '../lib/stack-detect.mjs';

const CONFIG_PATH = '.ai/workflows.config.json';

// Stack keys we treat as "drift-able". detector emits every one of these;
// keys outside this list (prohibited, boundaries, motion, …) are NEVER
// touched by --fix.
const STACK_KEYS = [
  'language',
  'framework',
  'packageManager',
  'buildTool',
  'monorepo',
  'ci',
  'tests',
  'css',
  'router',
];

export async function run({ args, pkgRoot }) {
  const { flags, positional } = parseArgs(args, {
    booleans: ['fix', 'json', 'help'],
  });

  if (positional[0] === 'help' || flags.help) {
    process.stdout.write(usage());
    return;
  }

  const repoRoot = process.cwd();
  const scope = flags.plugin || null;
  const fix = !!flags.fix;
  const jsonMode = !!flags.json;

  // ── Dependencies ────────────────────────────────────────────────────────
  const depsByPlugin = {};
  const pluginList = scope ? [scope] : ['design', 'flow'];
  for (const p of pluginList) {
    const manifestPath = resolve(pkgRoot || repoRoot, `plugins/${p}/dependencies.json`);
    if (!existsSync(manifestPath)) {
      depsByPlugin[p] = { error: `manifest not found at ${manifestPath}` };
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    depsByPlugin[p] = await checkAll(manifestPath);
  }

  // ── Config: schema, stack drift, quality additions ──────────────────────
  let configReport = { exists: false };
  const configFsPath = resolve(repoRoot, CONFIG_PATH);
  if (existsSync(configFsPath)) {
    const schemaPath = resolve(
      pkgRoot || repoRoot,
      'plugins/flow/.claude-plugin/config.schema.json'
    );
    const config = JSON.parse(readFileSync(configFsPath, 'utf8'));
    const lint = await lintConfig({ config, schemaPath });
    const detectedStack = await detectStack(repoRoot);
    const detectedQuality = (await detectQualityGates(repoRoot)) || {};

    const drift = [];
    for (const k of STACK_KEYS) {
      const declared = config.stack?.[k];
      const detected = detectedStack[k];
      if (detected === 'unknown' || detected === null || detected === undefined) continue;
      // Booleans (monorepo) compared directly.
      if (typeof detected === 'boolean') {
        if (declared !== detected) drift.push({ key: k, declared, detected });
        continue;
      }
      if (declared !== detected) {
        drift.push({ key: k, declared: declared ?? '(unset)', detected });
      }
    }

    const qualityAdditions = [];
    const declaredQuality = config.quality || {};
    for (const [gate, cmd] of Object.entries(detectedQuality)) {
      if (!declaredQuality[gate]) qualityAdditions.push({ gate, command: cmd });
    }

    configReport = {
      exists: true,
      schema: lint,
      drift,
      qualityAdditions,
      detectedStack,
      detectedQuality,
    };
  }

  // ── Design config: linked-hub + TSX-sync health (report-only) ────────────
  // doctor's primary domain is .ai/workflows.config.json, but a linked design
  // project's .design/config.json carries the one knob that has bitten users
  // repeatedly — `linkedHub.syncTsx`. Surface it here so doctor is the one-stop
  // health check. Report-only: under DDR-079 (default ON) every state is valid,
  // so there is nothing to --fix and we NEVER impose an opt-out.
  let designReport = { exists: false };
  const designFsPath = resolve(repoRoot, '.design/config.json');
  if (existsSync(designFsPath)) {
    try {
      const dcfg = JSON.parse(readFileSync(designFsPath, 'utf8'));
      const linkedHub = dcfg.linkedHub;
      if (!linkedHub) {
        designReport = { exists: true, linked: false };
      } else {
        const syncTsx = linkedHub.syncTsx;
        const tsxSync =
          syncTsx === false
            ? 'off (opted out)'
            : syncTsx === true
              ? 'on (explicit)'
              : 'on (default)';
        // Local-only signals — no network. `getHub` reads ~/.config/maude/
        // hubs.json; the sync-agent state comes from the serve-written
        // `_sync.json`. We deliberately DO NOT probe the hub's /health here:
        // doctor must stay fast + offline (it runs in the release pre-flight),
        // so live hub reachability stays in `maude design status`.
        let tokenStored = false;
        try {
          tokenStored = !!getHub(linkedHub.url);
        } catch {
          /* hubs.json absent/unreadable on this machine → no token */
        }
        designReport = {
          exists: true,
          linked: true,
          hubUrl: linkedHub.url,
          adopt: !!linkedHub.adopt,
          tsxSync,
          tokenStored,
          syncAgent: readSyncAgentState(resolve(repoRoot, '.design', '_sync.json')),
          // DDR-079 migration advisory: a linked config with no explicit
          // syncTsx rides the default, which flipped off→on in maude 0.27→0.28.
          advisory:
            syncTsx === undefined
              ? 'TSX sync defaults ON (DDR-079) — every .tsx syncs to this hub. Opt out with linkedHub.syncTsx:false or `maude design link … --no-sync-tsx`.'
              : null,
        };
      }
    } catch (err) {
      designReport = { exists: true, error: `invalid JSON: ${err.message}` };
    }
  }

  // ── Gitignore drift: is git dropping VERSIONED design content? ───────────
  // The one failure mode nothing else can see. A rule OUTSIDE the
  // `# maude:begin`/`# maude:end` markers is invisible to the block writer, so
  // a stale `.design/*.annotations.svg` — hand-copied years ago from a planning
  // doc that predates DDR-115 — silently keeps every draw layer out of git
  // while both UIs render it happily. See `lib/gitignore-drift.mjs`.
  const gitignoreFsPath = resolve(repoRoot, '.gitignore');
  const designRel = (() => {
    try {
      const dcfg = JSON.parse(readFileSync(designFsPath, 'utf8'));
      return typeof dcfg.designRoot === 'string' && dcfg.designRoot ? dcfg.designRoot : '.design';
    } catch {
      return '.design';
    }
  })();
  const gitignoreDrift = existsSync(gitignoreFsPath)
    ? findGitignoreDrift(readFileSync(gitignoreFsPath, 'utf8'), designRel)
    : [];

  // ── Summary ─────────────────────────────────────────────────────────────
  const hardDepsMissing = Object.values(depsByPlugin)
    .filter((r) => r.summary)
    .reduce((acc, r) => acc + r.summary.hardFailing, 0);
  const schemaErrors = configReport.schema ? configReport.schema.errors.length : 0;
  const driftCount = configReport.drift?.length || 0;
  const additionsCount = configReport.qualityAdditions?.length || 0;
  const summary = {
    hardDepsMissing,
    schemaErrors,
    driftCount,
    qualityAdditions: additionsCount,
    gitignoreDrift: gitignoreDrift.length,
    // A HARD failure, not a warning. Every other doctor finding is about
    // configuration that is merely suboptimal; this one means work the person
    // can see on screen is not in their repository and will not survive a fresh
    // clone. Silence about that is how it went unnoticed for a whole project.
    healthy: hardDepsMissing === 0 && schemaErrors === 0 && gitignoreDrift.length === 0,
  };

  if (jsonMode) {
    process.stdout.write(
      `${JSON.stringify(
        {
          deps: depsByPlugin,
          config: configReport,
          design: designReport,
          gitignore: { path: gitignoreFsPath, designRel, drift: gitignoreDrift },
          summary,
        },
        null,
        2
      )}\n`
    );
    process.exit(summary.healthy ? 0 : 1);
  }

  printReport({ depsByPlugin, configReport, designReport, gitignoreDrift, summary });

  // ── Fix path ────────────────────────────────────────────────────────────
  if (fix) {
    await applyFixes({
      repoRoot,
      configFsPath,
      depsByPlugin,
      configReport,
      gitignoreFsPath,
      gitignoreDrift,
    });
  } else if (!summary.healthy) {
    process.stdout.write(
      '\nRun with --fix to: install missing deps (prompt per item), drop unknown keys, apply detected drift, add missing quality gates. Existing user values are NEVER overwritten.\n'
    );
  }

  process.exit(summary.healthy ? 0 : 1);
}

// Read the serve-written `.design/_sync.json` and condense it to one line.
// Local file only — never network. Returns null when the agent hasn't run.
function readSyncAgentState(p) {
  if (!existsSync(p)) return null;
  try {
    const s = JSON.parse(readFileSync(p, 'utf8'));
    if (s.notSyncable) return `0 syncable — ${s.reason || 'see `maude design status`'}`;
    if (s.state) {
      const bits = [String(s.state), `${s.canvases ?? 0} canvas(es)`];
      if (s.queuedOps) bits.push(`${s.queuedOps} queued`);
      if (s.conflicts?.length) bits.push(`${s.conflicts.length} conflict notice(s)`);
      return bits.join(', ');
    }
    return null;
  } catch {
    return null;
  }
}

function usage() {
  return `maude doctor [--plugin <name>] [--fix] [--json]

  Unified workspace diagnostic. Reports missing dependencies, config schema
  errors, stack drift, missing quality-gate declarations, and — when a
  .design/config.json is linked — design-hub + TSX-sync health, in one shot.
  (The design section is report-only and local; live hub reachability is
  \`maude design status\`.)

  Flags:
    --plugin <name>   Scope dependency section to one plugin (design | flow).
                      Config section is global.
    --fix             Apply safe auto-fixes. Prompts per autoInstall dep,
                      drops unknown schema keys, applies drift where the
                      detector returned a concrete value, adds missing
                      quality gates. Never overwrites existing user values.
    --json            Machine-readable envelope.

  Exit: 1 if any hard dep is missing OR config schema has errors; 0 otherwise.
`;
}

function printReport({ depsByPlugin, configReport, designReport, gitignoreDrift, summary }) {
  process.stdout.write('maude doctor\n\n');
  for (const [name, env] of Object.entries(depsByPlugin)) {
    process.stdout.write(`  Dependencies (plugins/${name}):\n`);
    if (env.error) {
      process.stdout.write(`    ✗ ${env.error}\n\n`);
      continue;
    }
    for (const r of env.results) {
      const glyph = r.status === 'ok' ? '✓' : r.status === 'unknown' ? '?' : '✗';
      const label = r.id.padEnd(22);
      let rhs;
      if (r.status === 'ok') rhs = r.version || '';
      else if (r.status === 'missing') {
        const hint = (r.install && (r.install[process.platform] || r.install.preferred)) || '';
        rhs = `missing${hint ? ` — ${hint}` : ''}`;
      } else if (r.status === 'outdated') rhs = `outdated (${r.detail})`;
      else rhs = r.detail || '';
      process.stdout.write(`    ${glyph} ${label} ${rhs}\n`);
    }
    process.stdout.write('\n');
  }

  if (!configReport.exists) {
    process.stdout.write(
      `  Config (${CONFIG_PATH}):\n    not found — run \`maude init\` first.\n\n`
    );
  } else {
    process.stdout.write(`  Config schema (${CONFIG_PATH}):\n`);
    if (configReport.schema.ok) {
      process.stdout.write('    ✓ valid\n');
    } else {
      for (const e of configReport.schema.errors) {
        process.stdout.write(`    ✗ ${e.path}\n`);
        if (e.value !== undefined)
          process.stdout.write(`      value: ${JSON.stringify(e.value)}\n`);
        process.stdout.write(`      ${e.message}\n`);
        if (e.suggestion)
          process.stdout.write(`      suggestion: "${e.suggestion}" (closest match)\n`);
      }
    }
    process.stdout.write('\n');

    if (configReport.drift.length > 0) {
      process.stdout.write('  Stack drift:\n');
      process.stdout.write('    Key                Declared              Detected\n');
      for (const d of configReport.drift) {
        process.stdout.write(
          `    ${d.key.padEnd(18)} ${String(d.declared).padEnd(20)}  ${d.detected}\n`
        );
      }
      process.stdout.write('\n');
    }

    if (configReport.qualityAdditions.length > 0) {
      process.stdout.write(
        '  Quality gates (additions only — existing values never overwritten):\n'
      );
      for (const a of configReport.qualityAdditions) {
        process.stdout.write(`    + quality.${a.gate.padEnd(14)} ${a.command}\n`);
      }
      process.stdout.write('\n');
    }
  }

  // Design / linked-hub health — report-only, local signals only (no network).
  if (designReport?.exists) {
    process.stdout.write('  Design hub (.design/config.json):\n');
    if (designReport.error) {
      process.stdout.write(`    ✗ ${designReport.error}\n`);
    } else if (!designReport.linked) {
      process.stdout.write('    solo — not linked to a hub.\n');
    } else {
      process.stdout.write(`    ✓ linked: ${designReport.hubUrl}\n`);
      process.stdout.write(
        `      token stored: ${designReport.tokenStored ? 'yes' : 'NO — run `maude design link`'}\n`
      );
      process.stdout.write(`      TSX sync:     ${designReport.tsxSync}\n`);
      if (designReport.adopt)
        process.stdout.write('      adopt mode:   yes (push-on-first-sync)\n');
      process.stdout.write(
        `      sync agent:   ${designReport.syncAgent || 'idle (start `maude design serve`)'}\n`
      );
      if (designReport.advisory) process.stdout.write(`    ℹ  ${designReport.advisory}\n`);
      process.stdout.write(
        '    (live hub reachability + full sync detail: `maude design status`)\n'
      );
    }
    process.stdout.write('\n');
  }

  // Gitignore drift — git is dropping content DDR-115 calls versioned.
  if (gitignoreDrift?.length) {
    process.stdout.write('  Gitignore (.gitignore):\n');
    for (const line of describeGitignoreDrift(gitignoreDrift)) {
      process.stdout.write(`    ✗ ${line}\n`);
    }
    process.stdout.write(
      '    These rules sit OUTSIDE the `# maude:begin`/`# maude:end` block, so\n' +
        '    re-running the writer cannot correct them. Work you can see in the UI\n' +
        '    is not in your repository and will not survive a fresh clone.\n' +
        '    `maude doctor --fix` removes exactly these lines, and nothing else.\n\n'
    );
  }

  const parts = [];
  if (summary.hardDepsMissing) parts.push(`${summary.hardDepsMissing} hard dep missing`);
  if (summary.schemaErrors)
    parts.push(`${summary.schemaErrors} schema error${summary.schemaErrors === 1 ? '' : 's'}`);
  if (summary.driftCount)
    parts.push(`${summary.driftCount} stack drift${summary.driftCount === 1 ? '' : 's'}`);
  if (summary.qualityAdditions)
    parts.push(
      `${summary.qualityAdditions} quality addition${summary.qualityAdditions === 1 ? '' : 's'}`
    );
  if (summary.gitignoreDrift)
    parts.push(
      `${summary.gitignoreDrift} gitignore rule${summary.gitignoreDrift === 1 ? '' : 's'} dropping versioned content`
    );
  if (parts.length === 0) parts.push('all clear');
  process.stdout.write(`  Summary: ${parts.join(', ')}.\n`);
}

async function applyFixes({
  repoRoot,
  configFsPath,
  depsByPlugin,
  configReport,
  gitignoreFsPath,
  gitignoreDrift,
}) {
  let configChanged = false;

  // ── Config edits ───────────────────────────────────────────────────────
  // Run FIRST — deterministic (filesystem only) and must not be blocked by
  // an interactive prompt that may never resolve on a non-TTY stdin (CI,
  // scripted spawns with empty input). Dep prompts come AFTER.
  if (configReport.exists) {
    const config = JSON.parse(readFileSync(configFsPath, 'utf8'));

    // Drop unknown additionalProperties errors.
    for (const e of configReport.schema.errors) {
      if (e.message.startsWith('unknown property')) {
        const parts = e.path.split('/').filter(Boolean);
        let cur = config;
        for (let i = 0; i < parts.length - 1; i++) cur = cur?.[parts[i]];
        if (cur && parts.length > 0) {
          delete cur[parts[parts.length - 1]];
          configChanged = true;
        }
      }
    }

    // Apply drift — silent (detector returned a concrete value, so we know
    // declared is wrong or stale).
    if (configReport.drift.length > 0) {
      if (!config.stack) config.stack = {};
      for (const d of configReport.drift) {
        config.stack[d.key] = d.detected;
        configChanged = true;
      }
    }

    // Add missing quality gates — silent additive merge.
    if (configReport.qualityAdditions.length > 0) {
      if (!config.quality) config.quality = {};
      for (const a of configReport.qualityAdditions) {
        if (!config.quality[a.gate]) {
          config.quality[a.gate] = a.command;
          configChanged = true;
        }
      }
    }

    if (configChanged) {
      writeFileSync(configFsPath, `${JSON.stringify(config, null, 2)}\n`);
      process.stdout.write(`\n  ✓ wrote ${CONFIG_PATH}\n`);
    } else {
      process.stdout.write('\n  (no config edits applied)\n');
    }

    // Note: invalid-enum errors (e.g. tests: "node-test") are NEVER auto-
    // fixed — the user picks the migration target. Surface the leftover.
    const remaining = configReport.schema.errors.filter(
      (e) => !e.message.startsWith('unknown property')
    );
    if (remaining.length > 0) {
      process.stdout.write(
        `\n  ⚠ ${remaining.length} schema error${remaining.length === 1 ? '' : 's'} not auto-fixed — user decision required:\n`
      );
      for (const e of remaining) {
        process.stdout.write(`    ${e.path}: ${e.message}\n`);
      }
    }
  }

  // ── Dependency installs ────────────────────────────────────────────────
  const installable = [];
  for (const env of Object.values(depsByPlugin)) {
    if (!env.results) continue;
    for (const r of env.results) {
      if (r.status !== 'missing') continue;
      installable.push(r);
    }
  }
  // Per-dep prompt — no silent installs. Skip when stdin is not a TTY
  // (CI runners, scripted spawns) so config edits above are never bypassed
  // by a never-resolving readline prompt against closed stdin.
  if (installable.length > 0) {
    if (!stdin.isTTY) {
      process.stdout.write(
        `\n--- Dependency installs skipped (non-interactive stdin; ${installable.length} missing) ---\n`
      );
    } else {
      process.stdout.write('\n--- Dependency installs (per-dep prompt) ---\n');
      const rl = createInterface({ input: stdin, output: stdout });
      for (const r of installable) {
        const cmd = (r.install && (r.install[process.platform] || r.install.preferred)) || null;
        if (!cmd) {
          process.stdout.write(`  skip ${r.id} — no install command declared\n`);
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const ans = await rl.question(`  Install ${r.id} via \`${cmd}\`? [y/N] `);
        const norm = (ans || '').trim().toLowerCase();
        if (norm === 'y' || norm === 'yes') {
          process.stdout.write(`  running: ${cmd}\n`);
          const res = spawnSync('bash', ['-c', cmd], { stdio: 'inherit' });
          if (res.status !== 0) process.stdout.write(`  ✗ install failed (exit ${res.status})\n`);
        } else {
          process.stdout.write(`  skipped ${r.id}\n`);
        }
      }
      rl.close();
    }
  }

  // ── Gitignore drift ─────────────────────────────────────────────────────
  //
  // The ONE fix in this command that edits a file the user hand-wrote, so it is
  // the one that asks. Everything else `--fix` does is additive or confined to
  // generated regions; this deletes lines from somebody's `.gitignore`. The
  // prompt names each line, and a non-TTY (CI, a scripted spawn) is a decline —
  // never an assumed yes.
  if (gitignoreDrift?.length && gitignoreFsPath && existsSync(gitignoreFsPath)) {
    process.stdout.write('\n--- Gitignore rules dropping VERSIONED design content ---\n');
    for (const line of describeGitignoreDrift(gitignoreDrift)) {
      process.stdout.write(`  ${line}\n`);
    }
    if (!stdin.isTTY) {
      process.stdout.write(
        '  skipped — non-interactive stdin. Re-run in a terminal, or delete the lines above by hand.\n'
      );
    } else {
      const rl = createInterface({ input: stdin, output: stdout });
      const ans = await rl.question(
        `  Remove ${gitignoreDrift.length === 1 ? 'this line' : `these ${gitignoreDrift.length} lines`} from .gitignore? [y/N] `
      );
      rl.close();
      if (/^y(es)?$/i.test((ans || '').trim())) {
        const before = readFileSync(gitignoreFsPath, 'utf8');
        writeFileSync(gitignoreFsPath, removeGitignoreDrift(before, gitignoreDrift), 'utf8');
        process.stdout.write(
          '  ✓ removed. The files are still untracked until you `git add` them —\n' +
            '    `git status` will now show them for the first time.\n'
        );
      } else {
        process.stdout.write('  skipped.\n');
      }
    }
  }

  // Use the actually-changed state to decide on re-run hint.
  void repoRoot;
}
