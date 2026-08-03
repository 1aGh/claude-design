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
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from '../lib/argv.mjs';

const CONFIG_PATH = '.ai/workflows.config.json';
const DEFAULT_ENGINE_VERSION = 'v1.0.0';
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
  'record-log',
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

/**
 * The staged desktop engine, resolved from maude's OWN package root (DDR-045 —
 * never `import.meta.url`, which is `/$bunfs/root` inside the compiled binary).
 * In the `.app`, pkgRoot is bridged to `Contents/Resources`, the `kg` sidecar
 * lands in `Contents/MacOS/`, and `libkuzu` under `Resources/kgai/` (see
 * apps/desktop/scripts/sync-kg.mjs). Returns `{ bin, lib }` or null elsewhere.
 */
function resolveStagedKgai(pkgRoot) {
  if (!pkgRoot) return null;
  const lib = join(pkgRoot, 'kgai');
  if (!existsSync(lib)) return null;
  const exe = process.platform === 'win32' ? '.exe' : '';
  for (const bin of [join(pkgRoot, '..', 'MacOS', `kg${exe}`), join(lib, `kg${exe}`)]) {
    if (existsSync(bin)) return { bin, lib };
  }
  return null;
}

/** KGAI_BIN env → desktop-staged sidecar → `kg` on PATH → null. */
function resolveKgBin(pkgRoot) {
  if (process.env.KGAI_BIN && existsSync(process.env.KGAI_BIN)) return process.env.KGAI_BIN;
  const staged = resolveStagedKgai(pkgRoot);
  if (staged) {
    // Make the sibling libkuzu reachable for this process's spawns (kgEnv folds
    // it into DYLD_/LD_LIBRARY_PATH) without requiring the caller to plumb env.
    process.env.KGAI_LIB ||= staged.lib;
    return staged.bin;
  }
  const probe = spawnSync('sh', ['-c', 'command -v kg'], { encoding: 'utf8' });
  const found = (probe.stdout || '').trim();
  return probe.status === 0 && found ? found : null;
}

/** The capability gate — the single source of `active`. */
function resolveState(projectRoot, pkgRoot) {
  const cfg = readConfig(projectRoot);
  const kgBin = resolveKgBin(pkgRoot);
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
    projectRoot,
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
    const key = process.platform === 'darwin' ? 'DYLD_LIBRARY_PATH' : 'LD_LIBRARY_PATH';
    env[key] = [process.env.KGAI_LIB, process.env[key]].filter(Boolean).join(':');
  }
  return env;
}

/** Spawn the resolved `kg` with the given args, inheriting stdio. Returns exit status. */
function runKg(state, kgArgs, { timeoutMs, swallowStdout } = {}) {
  if (!state.kgBin) {
    process.stderr.write(
      'maude kg: the `kg` CLI is not available. kgai is capability-gated — install it (see docs/kgai-onboarding.md) or use classic `.ai/` mode.\n'
    );
    return 127;
  }
  // `swallowStdout` is for verbs that print their OWN one-line summary — `kg
  // ingest` dumps a ~25-line JSON receipt per call, and a command that records
  // a verdict on every run would bury the agent's real output in it. stderr
  // still passes through, so a genuine failure is never hidden.
  const child = spawnSync(state.kgBin, kgArgs, {
    stdio: swallowStdout ? ['inherit', 'pipe', 'inherit'] : 'inherit',
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
  const ghHeaders = { 'user-agent': 'maude-kg', accept: 'application/vnd.github+json' };
  /** Asset names for one release ref, or null when the fetch itself failed. */
  const assetsFor = async (path) => {
    try {
      const res = await fetch(`https://api.github.com/repos/${KGAI_REPO}/releases/${path}`, {
        headers: ghHeaders,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { ok: false, tag: null, assets: [] };
      const rel = await res.json();
      return { ok: true, tag: rel.tag_name, assets: (rel.assets ?? []).map((a) => a.name) };
    } catch {
      return null; // offline — best-effort
    }
  };

  const latestRel = await assetsFor('latest');
  const latest = latestRel?.tag ?? null;
  // The PINNED release is the one that matters: sync-kg.mjs downloads the
  // desktop sidecars from `releases/download/<pinned>`. Reporting `latest`'s
  // assets here said "✓" while the pinned release had been stripped of every
  // asset upstream, so this check stayed green through a desktop build that was
  // failing on exactly what it claims to verify (v0.53.2, kgai v0.1.9). A tag is
  // a name, not a content hash — upstream can rewrite what it points at.
  const pinnedRel = await assetsFor(`tags/${encodeURIComponent(pinned)}`);
  const assets = pinnedRel?.assets ?? [];
  if (!latest) {
    process.stdout.write('  latest: unknown (offline) — using pinned.\n');
    return 0;
  }
  process.stdout.write(`  latest release:         ${latest}\n`);
  process.stdout.write(
    `  status:                 ${latest === pinned ? '✓ up to date' : `⚠ upstream moved ${pinned} → ${latest}`}\n`
  );
  // Prebuilt assets ON THE PIN — what the desktop build actually downloads.
  const hasDarwin = assets.some((a) => /kg-darwin/.test(a));
  const hasKuzu = assets.some((a) => /libkuzu/.test(a));
  const hasLinux = assets.some((a) => /kg-linux/.test(a));
  process.stdout.write(`\n  prebuilt assets on the PIN (${pinned}):\n`);
  if (pinnedRel === null) {
    process.stdout.write('    (offline — not checked)\n');
  } else if (!pinnedRel.ok) {
    process.stdout.write(`    ✗ release ${pinned} not found upstream\n`);
  } else {
    process.stdout.write(`    macOS kg binary:      ${hasDarwin ? '✓' : '✗'}\n`);
    process.stdout.write(`    linux kg binary:      ${hasLinux ? '✓' : '✗'}\n`);
    process.stdout.write(`    libkuzu dylib/so:     ${hasKuzu ? '✓' : '✗'}\n`);
  }
  // A pin whose assets are gone breaks `sync-kg.mjs`, which fails the desktop
  // build for macOS and Linux. Exit non-zero so this can gate a release.
  const pinBroken = pinnedRel !== null && (!pinnedRel.ok || !hasDarwin || !hasKuzu || !hasLinux);
  if (pinBroken) {
    process.stdout.write(
      `\n  ✗ the pinned release cannot build the desktop app — sync-kg.mjs downloads from\n` +
        `    releases/download/${pinned}, and those assets are missing. Upstream deleted or\n` +
        `    rewrote the release. Bump the pin to one that still carries them (verify\n` +
        `    compatibility first: CLI surface diff + a canonical-export comparison).\n`
    );
  }
  if (latest !== pinned) {
    process.stdout.write(
      '\n  → Re-scan the capability surface (native --scope filter? kg import? Stop-hook/guessActor changes?),\n' +
        '    re-run scripts/kgai-smoke/run.sh pinned to the new tag, reconcile the plan, then bump\n' +
        '    config.knowledgeGraph.engineVersion deliberately (never float — supply-chain surface, DDR-054/056).\n'
    );
  }
  return pinBroken ? 1 : 0;
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
  return mod.run({
    args,
    state,
    projectRoot: state.projectRoot,
    runKg: (a, o) => runKg(state, a, o),
  });
}

// ── verb: record-log (keep the graph fed as verdicts are written) ───────────
//
// WHY this exists rather than a JSON blob per command: `.ai/logs/**` is
// GITIGNORED, so for RCAs / reviews / audits the graph is the only inheritable
// copy. The Phase-5 migration put 120 of them in — but nothing kept feeding it,
// so the corpus began decaying the moment migration finished. Seven flow
// commands and six design ones now call this as they write.
//
// It delegates to `buildLogDecision`, the SAME builder the bulk importer uses,
// because a second hand-rolled shape would fork the corpus: a node recorded
// today has to land on the same shelf as the ones migration created (same slug
// rule, props, ABOUT/scope/EVIDENCE_FOR edges) or `kg search` returns half an
// answer. Re-recording is safe — identity is `hash(kind:name)`, props MERGE.
async function verbRecordLog(state, args, pkgRoot) {
  const { flags } = parseArgs(args, { booleans: ['dry-run', 'quiet'] });
  // Inactive is the COMMON case downstream, and it must be a clean no-op so a
  // command can call this unconditionally instead of re-deriving the gate.
  if (!state.active) return 0;

  const file = flags.file;
  if (!file) {
    process.stderr.write('maude kg record-log: --file <path> is required.\n');
    return 1;
  }
  const abs = resolve(state.projectRoot, file);
  if (!existsSync(abs)) {
    // A verdict the caller says it wrote but didn't is a caller bug, not a
    // reason to fail the command that produced real work — warn and move on.
    process.stderr.write(`maude kg record-log: no such file: ${abs} — nothing recorded.\n`);
    return 0;
  }

  const libPath = join(pkgRoot, 'cli', 'lib', 'ddr-to-kgai.mjs');
  if (!existsSync(libPath)) {
    process.stderr.write('maude kg record-log: builder unavailable in this build.\n');
    return 0;
  }
  const { LOG_KINDS, buildLogDecision } = await import(libPath);

  // Kind: explicit wins; else infer from the parent dir via the SAME table the
  // importer keys on, so `.ai/logs/rca/x.md` → `rca` either way.
  const parent = abs.split('/').slice(-2, -1)[0] ?? '';
  const kind = flags.kind || LOG_KINDS[parent];
  if (!kind) {
    process.stderr.write(
      `maude kg record-log: cannot infer kind from "${parent}/" — pass --kind (known: ${Object.values(
        LOG_KINDS
      ).join(', ')}).\n`
    );
    return 1;
  }

  const rel = abs.startsWith(`${state.projectRoot}/`)
    ? abs.slice(state.projectRoot.length + 1)
    : abs;

  // Slug collision guard. Identity is `hash(kind:name)`, so two files sharing a
  // basename become ONE node and the second silently overwrites the first's
  // props — measured: recording `_history/settings/critique/001-PANEL.md` then
  // `_history/login/critique/001-PANEL.md` left a single node pointing at login,
  // with the settings critique gone. Flow logs are safe (their basenames are
  // already unique across `.ai/logs/<kind>/`) and must keep the bare slug to
  // match the migrated corpus — but anything attached to a specific element
  // (`--about canvas:foo`) is per-element by nature, so qualify it with that
  // element's name. Doing it HERE rather than in each caller means six design
  // commands can't each forget it.
  const aboutName = flags.about ? String(flags.about).split(':').slice(1).join(':') : '';
  const derivedSlug =
    flags.slug ||
    (aboutName
      ? `${aboutName}-${basename(abs).replace(/\.md$/, '')}`.replace(/\//g, '-')
      : undefined);

  const built = buildLogDecision(abs, kind, state.scope, {
    pathRel: rel,
    about: flags.about, // e.g. canvas:<slug> for a design verdict
    link: flags.link, // e.g. EVALUATES
    slug: derivedSlug,
  });

  if (flags['dry-run']) {
    process.stdout.write(`${JSON.stringify({ decisions: [built.decision] }, null, 2)}\n`);
    return 0;
  }
  // Temp file + `kg ingest --file`, matching the importer: the same plumbing
  // that ingested 310 decisions during migration, so no new stdin path to get
  // wrong (and a verdict body is far past comfortable argv size anyway).
  const tmp = join(tmpdir(), `kg-record-${kind}-${built.slug}.json`);
  writeFileSync(tmp, JSON.stringify({ decisions: [built.decision] }));
  const status = runKg(state, ['ingest', '--file', tmp], {
    timeoutMs: 30000,
    swallowStdout: true,
  });
  try {
    rmSync(tmp, { force: true });
  } catch {
    /* best-effort temp cleanup */
  }
  if (status !== 0) {
    // Same contract as `sync`: never fail the caller's real work over memory.
    process.stderr.write(`maude kg record-log: ingest failed for ${rel} — the file is on disk.\n`);
    return 0;
  }
  if (!flags.quiet) {
    process.stdout.write(
      `[kg] recorded ${kind}:${built.slug}${built.citedCount ? ` (${built.citedCount} EVIDENCE_FOR)` : ''}\n`
    );
  }
  return 0;
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
  record-log --file F     Record ONE verdict file (RCA / review / audit / critique) as a
    [--kind K]            graph node, shaped exactly like the migrated corpus. Kind is
    [--about E --link L]  inferred from the parent dir; --about/--link attach a design
    [--slug S] [--quiet]  verdict to canvas:<slug> instead of area:<kind>. Silent no-op
    [--dry-run]           when inactive, so callers invoke it unconditionally.
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
  const state = resolveState(projectRoot, pkgRoot);

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
    case 'record-log':
      status = await verbRecordLog(state, args.slice(1), pkgRoot);
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
