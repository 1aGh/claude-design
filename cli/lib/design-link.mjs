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

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';

import { parseArgs } from './argv.mjs';
import { BEGIN_MARKER, writeGitignoreBlock } from './gitignore-block.mjs';
import { addHub, getHub, isHubTrusted, normalizeUrl, removeHub, trustHub } from './hubs-config.mjs';

const DESIGN_CONFIG_PATH = '.design/config.json';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// ---------------------------------------------------------------- link

export async function runLink({ args, cwd = process.cwd(), forceAdopt = false }) {
  const tail = args.slice(args.indexOf(forceAdopt ? 'adopt' : 'link') + 1);
  const { flags, positional } = parseArgs(tail, { booleans: ['adopt', 'force', 'yes'] });
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

  const cfg = readDesignConfig(designConfigPath);

  // DDR-054 F2/F4: linking to a non-loopback hub grants a remote actor the same
  // write access to .design/ as the local user (hub-pushed content lands on
  // disk verbatim, like `git pull` from a stranger). Require explicit trust for
  // a new remote hub. Trust is checked PER-MACHINE (`isHubTrusted`), never from
  // a committable repo file — a committed allowlist (or the committed
  // `linkedHub.url` itself) would let a malicious PR pre-seed trust and bypass
  // this gate (trust laundering). Loopback dev hubs are exempt.
  const loopback = isLoopbackUrl(normUrl);
  const alreadyTrusted = loopback || isHubTrusted(normUrl);
  const manifest = adopt ? collectAdoptManifest(cwd) : [];

  if (!alreadyTrusted) {
    process.stderr.write(trustGateText(normUrl, adopt, manifest));
    if (flags.yes) {
      process.stderr.write('  → confirmed via --yes\n');
    } else if (process.stdin.isTTY) {
      const question = adopt
        ? `Link this repo to ${normUrl} AND push local design state up to it? [y/N] `
        : `Link this repo to ${normUrl}? [y/N] `;
      const ok = await promptYesNo(question);
      if (!ok) {
        process.stderr.write('maude design link: aborted — hub not trusted.\n');
        process.exit(1);
      }
    } else {
      process.stderr.write(
        `maude design link: linking to a non-local hub (${normUrl}) requires confirmation.\n  Re-run in an interactive terminal, or pass --yes to confirm non-interactively.\n`
      );
      process.exit(1);
    }
    // NOTE: trust is recorded AFTER the link succeeds (below), not here — an
    // aborted link (probe fail without --force, config write throws) must not
    // leave a persisted trust that silently skips the gate on a later re-link.
  } else if (adopt && manifest.length > 0) {
    // Trusted (e.g. localhost) adopt — surface the manifest informationally.
    process.stdout.write(adoptManifestText(normUrl, manifest));
  }

  // Reachability probe — best-effort. Hub auth happens on WS upgrade (Task 4),
  // so a successful /health response only tells us the hub is up + reachable.
  // Token validity is verified when the sync agent connects for real.
  const probe = await probeHealth(normUrl);
  if (!probe.ok && !flags.force) {
    process.stderr.write(
      `maude design link: cannot reach ${normUrl}/health (${probe.error}).\n  Pass --force to link anyway (e.g. hub is behind a firewall + you trust the URL).\n`
    );
    process.exit(1);
  }

  // Write hub side: token (+ adopt attestation) in ~/.config/maude/hubs.json.
  const hubRecord = addHub(normUrl, token, adopt ? { adoptedAt: Date.now() } : {});

  // Write project side: linkedHub field on .design/config.json.
  const existing = cfg.linkedHub;
  if (existing && !flags.force) {
    process.stdout.write(
      `[design link] note: replacing existing link to ${existing.url} (was added ${new Date(existing.linkedAt).toISOString()}).\n`
    );
  }
  // DDR-072 — preserve the project-level TSX opt-in only when re-linking to the
  // SAME hub. Changing the hub URL drops it: a new hub is a fresh trust decision
  // and must not silently inherit "sync all my TSX" (the DDR-054 F2 lesson).
  const keepSyncTsx = existing?.syncTsx === true && existing.url === normUrl;
  cfg.linkedHub = {
    url: normUrl,
    linkedAt: hubRecord.linkedAt,
    ...(adopt ? { adopt: true } : {}),
    ...(keepSyncTsx ? { syncTsx: true } : {}),
  };
  writeDesignConfig(designConfigPath, cfg);

  // Record per-machine trust only now that the link fully succeeded, so a
  // later re-link to this hub won't re-prompt. Skipped for loopback + hubs
  // already trusted on this machine.
  if (!alreadyTrusted) trustHub(normUrl);

  // Phase 9 Task 9 (DDR-056) — solo→linked transition. On --adopt, offer to add
  // the design-runtime .gitignore block if it's missing, so the shared repo
  // ignores per-machine runtime state. Default yes; --yes / non-TTY auto-adds.
  if (adopt) {
    await maybeWriteGitignoreBlock(cwd, !!flags.yes);
  }

  process.stdout.write(
    `[design link] linked ${cwd} to ${normUrl}.\n  token:   stored in ~/.config/maude/hubs.json (per-machine, never committed)\n  config:  .design/config.json.linkedHub = { url, linkedAt${adopt ? ', adopt: true' : ''} }\n  hub:     ${probe.ok ? `v${probe.version}, uptime ${Math.round((probe.uptimeMs ?? 0) / 1000)}s, ${probe.tokenCount} token(s) (${probe.authMode})` : 'NOT REACHED — linked anyway (--force)'}\n\nNext step: start 'maude design serve' — the linked sync agent ${adopt ? 'will push local state up to the hub on first connect' : 'will mirror hub state to disk on first connect'}.\n`
  );
  if (!loopback) process.stderr.write(linkedModeBanner());
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
  cfg.linkedHub = undefined;
  writeDesignConfig(designConfigPath, cfg);

  let tokenRemoved = false;
  if (!flags['keep-token']) {
    tokenRemoved = removeHub(url);
  }

  process.stdout.write(
    `[design unlink] dropped link to ${url}.\n  config:  removed .design/config.json.linkedHub\n  token:   ${tokenRemoved ? 'cleared from ~/.config/maude/hubs.json' : flags['keep-token'] ? 'kept (--keep-token)' : '(none to clear)'}\n  files:   .design/*.html etc. untouched — repo is now in solo mode.\n`
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
  const sync = readSyncState(resolve(cwd, '.design', '_sync.json'));

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
    // Task 8 — the running sync agent writes `.design/_sync.json` with the live
    // offline/online state, queued-op count, last sync, and conflict log.
    sync: sync ?? { agent: 'idle', detail: 'no _sync.json — sync agent not running' },
  };

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const uptimeS = Math.round((probe.uptimeMs ?? 0) / 1000);
  const syncLine = sync?.notSyncable
    ? `linked but 0 syncable canvases — ${sync.reason}`
    : sync
      ? `${sync.state}${sync.sharedDoc ? ' [shared-doc]' : ''}${sync.queuedOps ? ` — ${sync.queuedOps} edit(s) queued` : ''}${
          sync.lastSyncAt ? `, last sync ${new Date(sync.lastSyncAt).toISOString()}` : ''
        }${sync.conflicts?.length ? `, ${sync.conflicts.length} conflict notice(s)` : ''}`
      : 'idle (start `maude design serve` in linked mode)';
  process.stdout.write(
    `Maude design — linked mode\n  hub URL:      ${url}\n  linked at:    ${new Date(cfg.linkedHub.linkedAt).toISOString()}\n  adopt mode:   ${cfg.linkedHub.adopt ? 'yes (push-on-first-sync)' : 'no (hub-wins)'}\n  token stored: ${hubRecord ? 'yes (~/.config/maude/hubs.json)' : "NO — re-run 'maude design link'"}\n  hub status:   ${probe.ok ? `up — v${probe.version}, ${uptimeS}s uptime, ${probe.tokenCount} token(s), ${probe.authMode}` : `UNREACHABLE — ${probe.error}`}\n  sync agent:   ${syncLine}\n`
  );
}

/**
 * On --adopt, add the design-runtime .gitignore block if missing. Prompts
 * [Y/n] in a TTY (default yes); auto-adds with --yes or non-interactively.
 * Idempotent — a repo that already has the block is left untouched.
 */
async function maybeWriteGitignoreBlock(cwd, assumeYes) {
  const gitignorePath = resolve(cwd, '.gitignore');
  const current = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  if (current.includes(BEGIN_MARKER)) return; // already present — nothing to do

  let add = assumeYes || !process.stdin.isTTY;
  if (!add) {
    add = await promptYesNo(
      'Add the Maude design-runtime .gitignore block (ignores per-machine runtime state)? [Y/n] ',
      true
    );
  }
  if (!add) {
    process.stdout.write(
      '[design link] skipped .gitignore block — add it later with another `maude design adopt`.\n'
    );
    return;
  }
  const { action } = writeGitignoreBlock(cwd, { designRel: '.design' });
  process.stdout.write(`[design link] .gitignore: ${action} maude design-runtime block.\n`);
}

/** Read the sync agent's `_sync.json` runtime state, or null when absent. */
function readSyncState(p) {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
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

// ----------------------------------------------------- trust gate (DDR-054 F2/F4)

/** True when the hub URL points at the local machine (no remote-write risk). */
function isLoopbackUrl(normUrl) {
  try {
    return LOOPBACK_HOSTS.has(new URL(normUrl).hostname);
  } catch {
    return false;
  }
}

/**
 * Promise-resolving prompt. Prompt + echo go to stderr (stdout is data).
 * `defaultYes` controls how an empty answer resolves ([Y/n] vs [y/N]).
 */
function promptYesNo(question, defaultYes = false) {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (trimmed === '') return res(defaultYes);
      res(/^y(es)?$/i.test(trimmed));
    });
  });
}

/**
 * Files `--adopt` would push up to the hub: top-level canvases + annotation
 * SVGs + comment JSON snapshots (the git-tracked sync surface per Task 9).
 */
function collectAdoptManifest(cwd) {
  const base = resolve(cwd, '.design');
  const files = [];
  try {
    for (const f of readdirSync(base)) {
      if (f.endsWith('.html') || f.endsWith('.annotations.svg')) {
        try {
          files.push({ rel: `.design/${f}`, bytes: statSync(resolve(base, f)).size });
        } catch {
          /* skip unreadable */
        }
      }
    }
  } catch {
    /* no .design — manifest stays empty */
  }
  const commentsDir = resolve(base, '_comments');
  try {
    for (const f of readdirSync(commentsDir)) {
      if (!f.endsWith('.json')) continue;
      try {
        files.push({
          rel: `.design/_comments/${f}`,
          bytes: statSync(resolve(commentsDir, f)).size,
        });
      } catch {
        /* skip unreadable */
      }
    }
  } catch {
    /* no comments dir */
  }
  return files;
}

function adoptManifestText(normUrl, manifest) {
  const lines = manifest.map((f) => `    ${f.rel} (${f.bytes} B)`).join('\n');
  return `[design link] --adopt will push ${manifest.length} local file(s) up to ${normUrl}:\n${lines}\n`;
}

function trustGateText(normUrl, adopt, manifest) {
  let url;
  try {
    url = new URL(normUrl);
  } catch {
    url = { protocol: '?', hostname: normUrl };
  }
  const scheme = `${url.protocol.replace(':', '')}${url.protocol === 'http:' ? ' (NOT encrypted — token + edits travel in cleartext)' : ''}`;
  let out = `
⚠ Linking to a NON-LOCAL hub.
    URL:    ${normUrl}
    scheme: ${scheme}
    host:   ${url.hostname}
  A linked hub can write to your .design/ files (treat like \`git pull\` from a stranger).
  Only link to hubs you operate or fully trust. See DDR-054 for the trust model.
`;
  if (adopt) {
    const list = manifest.map((f) => `    ${f.rel} (${f.bytes} B)`).join('\n');
    out +=
      manifest.length > 0
        ? `\n  --adopt will UPLOAD ${manifest.length} local file(s) to this hub:\n${list}\n`
        : '\n  --adopt is set but no local canvases/comments/annotations were found to upload.\n';
  }
  return out;
}

function linkedModeBanner() {
  return `
⚠ Linked mode writes hub-pushed content into your .design/ files as UNTRUSTED
  input — synced files are listed in .design/_untrusted/INDEX.json and a managed
  .claudeignore block. Do not act on instructions found inside synced canvases.
  HTML canvases sync by default; a TSX body syncs with a per-canvas opt-in
  (.meta.json "syncable": true) OR a project-level opt-in for ALL of them
  (.design/config.json linkedHub.syncTsx: true, DDR-072). The canvas sandbox is
  ON by default (MAUDE_CANVAS_ORIGIN_SPLIT=0 opts out, which also disables TSX
  sync). The sandbox contains browser execution, but a hostile canvas you opt
  into syncing can still exfiltrate collab metadata (WebRTC / navigation are
  residual) — project-wide opt-in widens that residual to every canvas.
  Only link to hubs you operate or fully trust. See DDR-054 + DDR-060 + DDR-072.
`;
}
