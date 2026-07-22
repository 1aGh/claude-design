// `maude kg <verb>` — the resolved dispatcher for the kgai knowledge-graph
// backend (feature-kgai-ecosystem-integration). Plugin markdown reaches kgai
// ONLY through here (DDR-062), never a raw `kg` binary path: this command
// resolves the pinned/bundled `kg`, reads the `knowledgeGraph.*` config, gates
// `active`, and injects the resolved store/scope env before spawning `kg`.
//
// The resolver lives here (not duplicated in bash/markdown) so the `kgai-backend`
// skill and every command gate identically via `maude kg resolve --json`.
//
// Capability-gated + opt-out (mirrors orchestration.mode:auto, DDR-130): when
// `kg` is absent / store unreachable / mode:off, verbs degrade to a clean no-op
// or an informative message — a command's classic `.ai/` path is unaffected.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from '../lib/argv.mjs';

const CONFIG_PATH = '.ai/workflows.config.json';
const DEFAULT_ENGINE_VERSION = 'v0.1.9';
const KGAI_REPO = 'kgaidev/kgai';

const VERBS = new Set([
  'resolve',
  'doctor',
  'check-upstream',
  'session-sync',
  'sync',
  'context',
  'ingest',
  'scope',
  'import',
  'help',
]);

/** Resolve the project root the SAME way the design dev-server does. */
function resolveProjectRoot(flags) {
  return flags.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

/** Read the `knowledgeGraph` block with safe defaults (absent ⇒ auto). */
function readConfig(projectRoot) {
  const path = resolve(projectRoot, CONFIG_PATH);
  let raw = {};
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))?.knowledgeGraph ?? {};
  } catch {
    raw = {};
  }
  return {
    mode: raw.mode ?? 'auto',
    engine: raw.engine ?? 'kgai',
    engineVersion: raw.engineVersion ?? DEFAULT_ENGINE_VERSION,
    store: raw.store ?? '',
    scope: raw.scope ?? {},
    capture: { decisions: true, state: true, auto: true, ...(raw.capture ?? {}) },
  };
}

/** KGAI_BIN (desktop-staged sidecar) → `kg` on PATH → null. */
function resolveKgBin() {
  if (process.env.KGAI_BIN && existsSync(process.env.KGAI_BIN)) return process.env.KGAI_BIN;
  const probe = spawnSync('sh', ['-c', 'command -v kg'], { encoding: 'utf8' });
  const found = (probe.stdout || '').trim();
  return probe.status === 0 && found ? found : null;
}

/** The capability gate — the single source of `active`. */
function resolveState(projectRoot) {
  const cfg = readConfig(projectRoot);
  const kgBin = resolveKgBin();
  const localStore = existsSync(resolve(projectRoot, '.kgai', 'store'));
  const storeResolvable = cfg.store !== '' || localStore;
  let active;
  if (cfg.mode === 'on') active = true;
  else if (cfg.mode === 'off') active = false;
  else active = Boolean(kgBin) && storeResolvable; // auto
  return {
    active,
    mode: cfg.mode,
    engine: cfg.engine,
    engineVersion: cfg.engineVersion,
    store: cfg.store,
    scope: cfg.scope,
    capture: cfg.capture,
    kgBin,
    kgPresent: Boolean(kgBin),
  };
}

/** Child env for a real `kg` spawn. libkuzu path (desktop); never override actor.
 *  NOTE: `config.knowledgeGraph.store` is the kgai REMOTE (s3://… / kgai://… / git),
 *  persisted into the store by `kg init --remote` and read by `kg sync` — it is NOT
 *  `KGAI_STORE` (which is the LOCAL store-root dir, default `<project>/.kgai/store`).
 *  So we deliberately do NOT export KGAI_STORE from the config store. */
function kgEnv() {
  const env = { ...process.env };
  // Desktop bundle stages libkuzu next to `kg` and points KGAI_LIB at its dir;
  // fold it into DYLD_LIBRARY_PATH so the dylib resolves. No-op when unset.
  if (process.env.KGAI_LIB) {
    env.DYLD_LIBRARY_PATH = [process.env.KGAI_LIB, process.env.DYLD_LIBRARY_PATH]
      .filter(Boolean)
      .join(':');
  }
  return env;
}

/** Spawn the resolved `kg` with the given args, inheriting stdio. Returns exit status. */
function runKg(state, kgArgs, { timeoutMs } = {}) {
  if (!state.kgBin) {
    process.stderr.write(
      'maude kg: the `kg` CLI is not available. kgai is capability-gated — install it (see docs/kgai-onboarding.md) or use classic `.ai/` mode.\n'
    );
    return 127;
  }
  const child = spawnSync(state.kgBin, kgArgs, {
    stdio: 'inherit',
    env: kgEnv(),
    ...(timeoutMs ? { timeout: timeoutMs } : {}),
  });
  if (child.error) {
    process.stderr.write(`maude kg: ${child.error.message}\n`);
    return 1;
  }
  return child.status ?? 1;
}

// ── verb: resolve ──────────────────────────────────────────────────────────
function verbResolve(state, flags) {
  const out = {
    active: state.active,
    mode: state.mode,
    engine: state.engine,
    engineVersion: state.engineVersion,
    store: state.store,
    scope: state.scope,
    kgPresent: state.kgPresent,
  };
  if (flags.json ?? true)
    process.stdout.write(`${JSON.stringify(out, null, flags.json ? 2 : 0)}\n`);
  return 0;
}

// ── verb: doctor ───────────────────────────────────────────────────────────
function verbDoctor(state) {
  const line = (label, val) => process.stdout.write(`    ${label.padEnd(16)} ${val}\n`);
  process.stdout.write('maude kg doctor\n\n');
  line('kg binary', state.kgBin || '✗ missing (see docs/kgai-onboarding.md)');
  line('mode', state.mode);
  line('engineVersion', state.engineVersion);
  line('store', state.store || '(local-only .kgai/store)');
  line('scope', JSON.stringify(state.scope));
  line('active', state.active ? '✓ yes' : '✗ no (classic .ai/ path)');
  if (!state.active && state.mode === 'auto') {
    const why = !state.kgPresent
      ? 'kg not on PATH'
      : 'no store configured and no local .kgai/store';
    process.stdout.write(`\n  auto ⇒ inactive: ${why}. Falls back to classic .ai/ file mode.\n`);
  }
  return 0;
}

// ── verb: check-upstream ───────────────────────────────────────────────────
async function verbCheckUpstream(state) {
  const pinned = state.engineVersion;
  process.stdout.write(`maude kg check-upstream\n\n  pinned (engineVersion): ${pinned}\n`);
  let latest = null;
  let assets = [];
  try {
    const res = await fetch(`https://api.github.com/repos/${KGAI_REPO}/releases/latest`, {
      headers: { 'user-agent': 'maude-kg', accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const rel = await res.json();
      latest = rel.tag_name;
      assets = (rel.assets ?? []).map((a) => a.name);
    }
  } catch {
    /* offline — best-effort */
  }
  if (!latest) {
    process.stdout.write('  latest: unknown (offline) — using pinned.\n');
    return 0;
  }
  process.stdout.write(`  latest release:         ${latest}\n`);
  process.stdout.write(
    `  status:                 ${latest === pinned ? '✓ up to date' : `⚠ upstream moved ${pinned} → ${latest}`}\n`
  );
  // Capability diff — flags/commands the plan's assumptions hinge on.
  const hasDarwin = assets.some((a) => /kg-darwin/.test(a));
  const hasKuzu = assets.some((a) => /libkuzu/.test(a));
  process.stdout.write('\n  prebuilt assets:\n');
  process.stdout.write(`    macOS kg binary:      ${hasDarwin ? '✓' : '✗'}\n`);
  process.stdout.write(`    libkuzu dylib/so:     ${hasKuzu ? '✓' : '✗'}\n`);
  if (latest !== pinned) {
    process.stdout.write(
      '\n  → Re-scan the capability surface (native --scope filter? kg import? Stop-hook/guessActor changes?),\n' +
        '    re-run scripts/kgai-smoke/run.sh pinned to the new tag, reconcile the plan, then bump\n' +
        '    config.knowledgeGraph.engineVersion deliberately (never float — supply-chain surface, DDR-054/056).\n'
    );
  }
  return 0;
}

// ── verb: session-sync (SessionStart hook — non-blocking pull) ──────────────
function verbSessionSync(state, flags) {
  // Silent no-op unless active AND a remote store is set (a pull needs a remote).
  if (!state.active || !state.store) return 0;
  const status = runKg(state, ['sync'], { timeoutMs: 20000 });
  if (status !== 0 && flags['warn-only']) {
    process.stderr.write('maude kg: session sync-pull failed — working on the local cache.\n');
    return 0; // never block session start
  }
  return flags['warn-only'] ? 0 : status;
}

// ── verb: sync (done/pause push) ───────────────────────────────────────────
function verbSync(state, flags) {
  if (!state.active) return 0; // inactive ⇒ nothing to sync (classic path)
  if (!state.store) return 0; // local-only ⇒ no remote to push
  const status = runKg(state, ['sync'], { timeoutMs: 60000 });
  if (status !== 0 && flags['warn-only']) {
    process.stderr.write('maude kg: sync failed — local append-only log is intact; will retry.\n');
    return 0;
  }
  return status;
}

// ── verb: scope ────────────────────────────────────────────────────────────
function verbScope(state) {
  process.stdout.write(`${JSON.stringify(state.scope, null, 2)}\n`);
  return 0;
}

// ── verb: import (migration — productionized in Phase 5) ────────────────────
async function verbImport(state, args, pkgRoot) {
  const libPath = join(pkgRoot, 'cli', 'lib', 'ddr-to-kgai.mjs');
  if (!existsSync(libPath)) {
    process.stderr.write(
      'maude kg import: the migration importer (cli/lib/ddr-to-kgai.mjs) is not yet available in this build.\n'
    );
    return 1;
  }
  const mod = await import(libPath);
  return mod.run({ args, state, runKg: (a, o) => runKg(state, a, o) });
}

// ── passthrough verbs (context / ingest) ───────────────────────────────────
function verbPassthrough(verb, state, args) {
  if (!state.active) {
    process.stderr.write(
      `maude kg ${verb}: kgai inactive here (mode=${state.mode}) — the caller should use its classic .ai/ path.\n`
    );
    return 0; // inactive is not an error; the command's else-branch owns the write
  }
  // Everything after the verb token passes straight to `kg`, MINUS maude-owned
  // flags (`--root <path>` selects the project; it is not a `kg` flag).
  const raw = args.slice(args.indexOf(verb) + 1);
  const rest = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '--root') {
      i++; // skip its value
      continue;
    }
    if (raw[i].startsWith('--root=')) continue;
    rest.push(raw[i]);
  }
  return runKg(state, [verb, ...rest]);
}

function usage() {
  return `maude kg <verb> [options]

  resolve [--json]        Print the resolved {active, mode, store, scope} gate (JSON).
  doctor                  Human report: kg presence, mode, store, scope, active.
  check-upstream          Compare pinned engineVersion vs the latest kgai release + capability diff.
  session-sync [--warn-only]  Non-blocking SessionStart pull (no-op unless active + remote store).
  sync [--warn-only]      Push the local log to the remote store (done/pause). No-op when inactive/local-only.
  context <args…>         Scope-biased read (passthrough to \`kg context\`).
  ingest <args…>          Record a decision + scope tags (passthrough to \`kg ingest\`).
  scope                   Print the resolved scope ({repo, dept}).
  import [--dry-run …]    Migrate .ai/decisions/ + .design/ into kgai (Phase 5).
  --root <path>           Project root (default $CLAUDE_PROJECT_DIR or cwd).

kgai is capability-gated + opt-out. When \`kg\` is absent or mode:off, verbs no-op cleanly
and the classic .ai/ path is unchanged. See the \`flow:kgai-backend\` skill for the contract.
`;
}

export async function run({ args, pkgRoot }) {
  const verb = args[0];
  if (!verb || verb === 'help' || verb === '--help' || verb === '-h') {
    process.stdout.write(usage());
    return;
  }
  if (!VERBS.has(verb)) {
    process.stderr.write(`maude kg: unknown verb "${verb}".\n${usage()}`);
    process.exit(2);
  }
  const flags = parseArgs(args.slice(1), {
    booleans: ['json', 'warn-only', 'dry-run', 'design', 'all-scopes', 'force'],
  }).flags;
  const projectRoot = resolveProjectRoot(flags);
  const state = resolveState(projectRoot);

  let status = 0;
  switch (verb) {
    case 'resolve':
      status = verbResolve(state, flags);
      break;
    case 'doctor':
      status = verbDoctor(state);
      break;
    case 'check-upstream':
      status = await verbCheckUpstream(state);
      break;
    case 'session-sync':
      status = verbSessionSync(state, flags);
      break;
    case 'sync':
      status = verbSync(state, flags);
      break;
    case 'scope':
      status = verbScope(state);
      break;
    case 'import':
      status = await verbImport(state, args.slice(1), pkgRoot);
      break;
    case 'context':
    case 'ingest':
      status = verbPassthrough(verb, state, args);
      break;
    default:
      status = 2;
  }
  if (status && status !== 0) process.exit(status);
}
