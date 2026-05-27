// maude hub — self-hostable Yjs sync hub control plane.
//
// Phase 9 Task 2 (minimal subset): serve + token generate + status.
// Token rotate, deploy fly|docker land in subsequent slices.
// See .ai/plans/phase-9-self-hosted-hub-file-sync.md.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseArgs } from '../lib/argv.mjs';

const SUBCOMMANDS = new Set(['serve', 'token', 'status', 'help']);

export async function run({ args, pkgRoot }) {
  const { positional } = parseArgs(args);
  const sub = positional[0];

  if (!sub || sub === 'help') {
    process.stdout.write(usage());
    return;
  }
  if (!SUBCOMMANDS.has(sub)) {
    process.stderr.write(`maude hub: unknown subcommand "${sub}"\n${usage()}`);
    process.exit(2);
  }

  if (sub === 'serve') return runServe({ args, pkgRoot });
  if (sub === 'token') return runToken({ args, pkgRoot });
  if (sub === 'status') return runStatus({ args });
}

function usage() {
  return `maude hub <serve|token|status> [options]

  serve [--port N] [--data PATH] [--secret HEX] [--insecure-http] [--dev]
        Start the self-hostable Yjs sync hub in the current process tree.
        --port           listen port (default 1234, env PORT)
        --data           hub.db + tokens.json dir (default ./data, env DATA_DIR)
        --secret         HUB_SECRET escape-hatch token (env HUB_SECRET)
        --insecure-http  cosmetic log-only flag for non-TLS dev
        --dev            generate a one-shot mau_dev_<hex> token, print the
                         connect command, then run the hub. Convenience for
                         contributor onboarding — drops tokens.json on exit
                         is NOT performed (tokens persist; clean by hand).

  token generate --label NAME [--data PATH] [--dev]
        Generate a new mau_<32hex> token and append it to
        <data>/tokens.json with the given label. Prints the raw token ONCE,
        plus the ready-to-paste 'maude design link' connect command.

        --dev produces a mau_dev_<hex> token (convention only — same auth).

  status [URL] [--json]
        HTTP GET <url>/health, print uptime/version/token-count. URL defaults
        to http://localhost:1234. --json emits the raw response.

NOTES
  Local dev only in v1.1 Task 2 slice — production-install packaging
  (adding plugins/design/hub to package.json:files + dep hoisting) lands
  in a follow-up slice. For now, run inside a 'maude' source checkout.

EXAMPLES
  maude hub serve --port 4400
  maude hub token generate --label alice
  maude hub status http://localhost:4400
`;
}

// ---------------------------------------------------------------- serve

async function runServe({ args, pkgRoot }) {
  const { flags } = parseArgs(args.slice(args.indexOf('serve') + 1), {
    booleans: ['insecure-http', 'dev'],
  });

  const hubRoot = findHubRoot(pkgRoot);
  if (!hubRoot) {
    process.stderr.write(
      'maude hub serve: hub workspace not found.\n\n' +
        'This slice ships in local dev tree only. Production-install packaging\n' +
        'is a follow-up Task 2 sub-slice. Run inside a maude source checkout.\n'
    );
    process.exit(1);
  }

  const env = { ...process.env };
  if (flags.port) env.PORT = String(flags.port);
  if (flags.data) env.DATA_DIR = resolve(String(flags.data));
  if (flags.secret) env.HUB_SECRET = String(flags.secret);
  if (flags['insecure-http']) env.HUB_INSECURE_HTTP = '1';

  if (flags.dev) {
    const dataDir = env.DATA_DIR ?? resolve(process.cwd(), 'data');
    const { addToken } = await import(resolveHubModule(hubRoot, 'src/tokens.mjs'));
    const port = env.PORT ?? '1234';
    const record = addToken(dataDir, { label: 'dev', dev: true });
    process.stdout.write(
      `[hub] --dev token written to ${dataDir}/tokens.json:\n      label: ${record.label}\n      value: ${record.value}\n\n      Connect from a peer:\n        maude design link http://localhost:${port} --token=${record.value}\n\n`
    );
  }

  const entry = resolveHubEntry(hubRoot);
  const child = spawn(process.execPath, [entry], {
    stdio: 'inherit',
    env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (err) => {
    process.stderr.write(`maude hub serve: ${err.message}\n`);
    process.exit(1);
  });
}

// ---------------------------------------------------------------- token generate

async function runToken({ args, pkgRoot }) {
  const tail = args.slice(args.indexOf('token') + 1);
  const op = tail[0];

  if (op !== 'generate') {
    process.stderr.write(
      `maude hub token: only "generate" is supported in v1.1 Task 2 slice.\n` +
        `"rotate" lands in a follow-up. Use "generate" with --label to mint a new token.\n`
    );
    process.exit(2);
  }

  const { flags } = parseArgs(tail.slice(1), { booleans: ['dev'] });
  const label = flags.label;
  if (!label || typeof label !== 'string') {
    process.stderr.write('maude hub token generate: --label <name> is required.\n');
    process.exit(2);
  }
  const dataDir = flags.data ? resolve(String(flags.data)) : resolve(process.cwd(), 'data');

  const hubRoot = findHubRoot(pkgRoot);
  if (!hubRoot) {
    process.stderr.write('maude hub token generate: hub workspace not found.\n');
    process.exit(1);
  }
  const { addToken } = await import(resolveHubModule(hubRoot, 'src/tokens.mjs'));
  const record = addToken(dataDir, { label, dev: !!flags.dev });

  process.stdout.write(
    `[hub] token written to ${dataDir}/tokens.json:\n  label:      ${record.label}\n  value:      ${record.value}\n  created:    ${new Date(record.createdAt).toISOString()}\n\nConnect from a peer (replace HOST):\n  maude design link https://HOST --token=${record.value}\n\nRestart the hub if it is already running for the new token to take effect.\n`
  );
}

// ---------------------------------------------------------------- status

async function runStatus({ args }) {
  const { flags, positional } = parseArgs(args.slice(args.indexOf('status') + 1), {
    booleans: ['json'],
  });
  let url = positional[0] ?? 'http://localhost:1234';
  if (url.startsWith('ws://')) url = `http://${url.slice('ws://'.length)}`;
  if (url.startsWith('wss://')) url = `https://${url.slice('wss://'.length)}`;
  if (url.endsWith('/')) url = url.slice(0, -1);

  const target = `${url}/health`;
  let payload;
  try {
    const res = await fetch(target);
    if (!res.ok) {
      process.stderr.write(
        `maude hub status: ${target} returned ${res.status} ${res.statusText}\n`
      );
      process.exit(1);
    }
    payload = await res.json();
  } catch (err) {
    process.stderr.write(`maude hub status: cannot reach ${target}: ${err.message}\n`);
    process.exit(1);
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const uptimeS = Math.round((payload.uptimeMs ?? 0) / 1000);
  process.stdout.write(
    `Maude Hub @ ${url}\n` +
      `  ok:         ${payload.ok}\n` +
      `  version:    ${payload.version}\n` +
      `  uptime:     ${formatDuration(uptimeS)}\n` +
      `  port:       ${payload.port}\n` +
      `  dataDir:    ${payload.dataDir}\n` +
      `  tokens:     ${payload.tokenCount} (mode: ${payload.authMode})\n`
  );
}

// ---------------------------------------------------------------- helpers

function findHubRoot(pkgRoot) {
  const dev = resolve(pkgRoot, 'plugins', 'design', 'hub');
  if (existsSync(resolve(dev, 'package.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(dev, 'package.json'), 'utf8'));
      if (pkg.name === '@maude/hub') return dev;
    } catch {
      /* fall through */
    }
  }
  return null;
}

function resolveHubEntry(hubRoot) {
  // Prefer the bundled binary (matches the production-install path); fall back
  // to source for fresh dev trees where bun build hasn't been run yet.
  const bundle = resolve(hubRoot, 'dist', 'hub.bundle.mjs');
  if (existsSync(bundle)) return bundle;
  return resolve(hubRoot, 'src', 'server.mjs');
}

function resolveHubModule(hubRoot, relPath) {
  // Dynamic import expects a URL or absolute path. Bundle does not include
  // standalone module exports (tokens.mjs lives in src/), so we always load
  // from src/ for CLI helpers — independent of whether the bundle exists.
  return `file://${resolve(hubRoot, relPath)}`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m${s.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h${(m % 60).toString().padStart(2, '0')}m${s.toString().padStart(2, '0')}s`;
}
