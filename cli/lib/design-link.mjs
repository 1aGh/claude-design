// `maude design link|unlink|status|adopt` — peer pairing against a hub.
//
// Phase 9 Task 3. Pairs a local `.design/`-bearing repo clone with a hub URL
// + per-user token. The actual bidirectional file sync (Yjs ↔ disk) is Task 4;
// this command sets up the linked state the sync agent later reads.
//
// Two-file plumbing:
//   .design/config.json       (committed)  →  linkedHub: { url, linkedAt, adopt? }
//   ~/.config/maude/hubs.json (per-machine) →  { [url]: { token, linkedAt } }
//
// Token NEVER lands in .design/config.json — that's git-committed.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { parseArgs } from './argv.mjs';
import { addHub, getHub, normalizeUrl, removeHub } from './hubs-config.mjs';

const DESIGN_CONFIG_PATH = '.design/config.json';

// ---------------------------------------------------------------- link

export async function runLink({ args, cwd = process.cwd(), forceAdopt = false }) {
  const tail = args.slice(args.indexOf(forceAdopt ? 'adopt' : 'link') + 1);
  const { flags, positional } = parseArgs(tail, { booleans: ['adopt', 'force'] });
  const url = positional[0];
  const token = flags.token;

  if (!url) {
    process.stderr.write('maude design link: <url> positional argument is required.\n');
    process.exit(2);
  }
  if (!token || typeof token !== 'string') {
    process.stderr.write('maude design link: --token <value> is required.\n');
    process.exit(2);
  }

  const adopt = forceAdopt || !!flags.adopt;
  const designConfigPath = resolve(cwd, DESIGN_CONFIG_PATH);
  if (!existsSync(designConfigPath)) {
    process.stderr.write(
      `maude design link: no ${DESIGN_CONFIG_PATH} in ${cwd}. Run 'maude design init' first.\n`
    );
    process.exit(1);
  }

  let normUrl;
  try {
    normUrl = normalizeUrl(url);
  } catch (err) {
    process.stderr.write(`maude design link: ${err.message}\n`);
    process.exit(2);
  }

  // Reachability probe — best-effort. Hub auth happens on WS upgrade (Task 4),
  // so a successful /health response only tells us the hub is up + reachable.
  // Token validity is verified when the sync agent connects for real.
  const probe = await probeHealth(normUrl);
  if (!probe.ok && !flags.force) {
    process.stderr.write(
      `maude design link: cannot reach ${normUrl}/health (${probe.error}).\n` +
        '  Pass --force to link anyway (e.g. hub is behind a firewall + you trust the URL).\n'
    );
    process.exit(1);
  }

  // Write hub side: tokens.json next to the user's other config.
  const hubRecord = addHub(normUrl, token);

  // Write project side: linkedHub field on .design/config.json.
  const cfg = readDesignConfig(designConfigPath);
  const existing = cfg.linkedHub;
  if (existing && !flags.force) {
    process.stdout.write(
      `[design link] note: replacing existing link to ${existing.url} (was added ${new Date(existing.linkedAt).toISOString()}).\n`
    );
  }
  cfg.linkedHub = {
    url: normUrl,
    linkedAt: hubRecord.linkedAt,
    ...(adopt ? { adopt: true } : {}),
  };
  writeDesignConfig(designConfigPath, cfg);

  process.stdout.write(
    `[design link] linked ${cwd} to ${normUrl}.\n` +
      `  token:   stored in ~/.config/maude/hubs.json (per-machine, never committed)\n` +
      `  config:  .design/config.json.linkedHub = { url, linkedAt${adopt ? ', adopt: true' : ''} }\n` +
      `  hub:     ${probe.ok ? `v${probe.version}, uptime ${Math.round((probe.uptimeMs ?? 0) / 1000)}s, ${probe.tokenCount} token(s) (${probe.authMode})` : 'NOT REACHED — linked anyway (--force)'}\n\n` +
      `Next step: start 'maude design serve' — the linked sync agent ${adopt ? 'will push local state up to the hub on first connect' : 'will mirror hub state to disk on first connect'}.\n` +
      '  (Sync agent lands in Phase 9 Task 4.)\n'
  );
}

// ---------------------------------------------------------------- adopt

export async function runAdopt({ args, cwd = process.cwd() }) {
  // Same shape as link — share the implementation.
  return runLink({ args, cwd, forceAdopt: true });
}

// ---------------------------------------------------------------- unlink

export async function runUnlink({ args, cwd = process.cwd() }) {
  const tail = args.slice(args.indexOf('unlink') + 1);
  const { flags } = parseArgs(tail, { booleans: ['keep-token'] });
  const designConfigPath = resolve(cwd, DESIGN_CONFIG_PATH);

  if (!existsSync(designConfigPath)) {
    process.stderr.write(`maude design unlink: no ${DESIGN_CONFIG_PATH} in ${cwd}.\n`);
    process.exit(1);
  }
  const cfg = readDesignConfig(designConfigPath);
  if (!cfg.linkedHub) {
    process.stdout.write('[design unlink] already in solo mode — nothing to do.\n');
    return;
  }
  const url = cfg.linkedHub.url;
  delete cfg.linkedHub;
  writeDesignConfig(designConfigPath, cfg);

  let tokenRemoved = false;
  if (!flags['keep-token']) {
    tokenRemoved = removeHub(url);
  }

  process.stdout.write(
    `[design unlink] dropped link to ${url}.\n` +
      `  config:  removed .design/config.json.linkedHub\n` +
      `  token:   ${tokenRemoved ? 'cleared from ~/.config/maude/hubs.json' : flags['keep-token'] ? 'kept (--keep-token)' : '(none to clear)'}\n` +
      '  files:   .design/*.html etc. untouched — repo is now in solo mode.\n'
  );
}

// ---------------------------------------------------------------- status

export async function runStatus({ args, cwd = process.cwd() }) {
  const tail = args.slice(args.indexOf('status') + 1);
  const { flags } = parseArgs(tail, { booleans: ['json'] });
  const designConfigPath = resolve(cwd, DESIGN_CONFIG_PATH);

  if (!existsSync(designConfigPath)) {
    const payload = { mode: 'no-design', reason: `no ${DESIGN_CONFIG_PATH} in ${cwd}` };
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stdout.write(`[design status] ${payload.reason}.\n`);
    }
    return;
  }
  const cfg = readDesignConfig(designConfigPath);
  if (!cfg.linkedHub) {
    const payload = { mode: 'solo' };
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stdout.write('[design status] solo mode — no linkedHub configured.\n');
    }
    return;
  }

  const url = cfg.linkedHub.url;
  const hubRecord = getHub(url);
  const probe = await probeHealth(url);

  const payload = {
    mode: 'linked',
    url,
    linkedAt: cfg.linkedHub.linkedAt,
    adopt: !!cfg.linkedHub.adopt,
    tokenStored: !!hubRecord,
    hub: probe.ok
      ? {
          reachable: true,
          version: probe.version,
          uptimeMs: probe.uptimeMs,
          tokenCount: probe.tokenCount,
          authMode: probe.authMode,
        }
      : { reachable: false, error: probe.error },
    // Sync agent surfaces ('lastSync', 'pendingOps', 'conflictState') land
    // in Phase 9 Task 4. For now report n/a.
    sync: { agent: 'not-implemented' },
  };

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const uptimeS = Math.round((probe.uptimeMs ?? 0) / 1000);
  process.stdout.write(
    `Maude design — linked mode\n` +
      `  hub URL:      ${url}\n` +
      `  linked at:    ${new Date(cfg.linkedHub.linkedAt).toISOString()}\n` +
      `  adopt mode:   ${cfg.linkedHub.adopt ? 'yes (push-on-first-sync)' : 'no (hub-wins)'}\n` +
      `  token stored: ${hubRecord ? 'yes (~/.config/maude/hubs.json)' : "NO — re-run 'maude design link'"}\n` +
      `  hub status:   ${probe.ok ? `up — v${probe.version}, ${uptimeS}s uptime, ${probe.tokenCount} token(s), ${probe.authMode}` : `UNREACHABLE — ${probe.error}`}\n` +
      `  sync agent:   not-implemented (Phase 9 Task 4 follow-up)\n`
  );
}

// ---------------------------------------------------------------- helpers

function readDesignConfig(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`unable to read ${path}: ${err.message}`);
  }
}

function writeDesignConfig(path, cfg) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    throw new Error(`design root ${dir} does not exist`);
  }
  writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
}

async function probeHealth(url) {
  const target = `${url}/health`;
  try {
    const res = await fetch(target);
    if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
    const body = await res.json();
    return { ok: true, ...body };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
