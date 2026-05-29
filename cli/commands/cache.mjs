import { readFileSync } from 'node:fs';
import { parseArgs } from '../lib/argv.mjs';
import { check, clear, entries, list, recordAccess, stats, write } from '../lib/cache.mjs';

// `maude cache <get|put|list|stats|inspect|clear>` — inspect and manage the
// sidecar cache layer (cli/lib/cache.mjs, Phase C / DDR-061).
//
// get/put are the PROGRAMMATIC surface that plugin slash-commands + agents call.
// The only cache entry point reachable from a plugin across install shapes is the
// `maude` binary on PATH (a declared plugin dependency) — NOT a relative path to
// cli/lib/cache.mjs, which the marketplace never copies beside a plugin (each
// plugin is copied alone into cache/<marketplace>/<plugin>/<version>/). See DDR-061.

export async function run({ args }) {
  const { positional, flags } = parseArgs(args);
  const sub = positional[0];

  if (!sub || sub === 'help') {
    process.stdout.write(usage());
    return;
  }
  if (sub === 'get') return cmdGet(positional[1], positional[2], flags);
  if (sub === 'put') return cmdPut(positional[1], positional[2], positional[3], flags);
  if (sub === 'list') return cmdList();
  if (sub === 'stats') return cmdStats();
  if (sub === 'inspect') return cmdInspect(positional[1], positional[2]);
  if (sub === 'clear') return cmdClear(positional[1]);

  process.stderr.write(`maude cache: unknown subcommand "${sub}"\n${usage()}`);
  process.exit(2);
}

function usage() {
  return `maude cache <get|put|list|stats|inspect|clear> [args]

  cache get <layer> <key> [--ttl-ms N]   Print the cached value (compact JSON) on a
                                         fresh hit, exit 0. On miss/stale: no stdout,
                                         exit 1. (Omit --ttl-ms for SHA-keyed layers.)
  cache put <layer> <key> [file] [--meta JSON]
                                         Write a value (from <file> or stdin) into the cache.
  cache list                    Layers with entry counts, sizes, last-write time.
  cache stats                   Hit/miss counters and hit-rate per layer.
  cache inspect <layer> [key]   List entries in a layer; with <key>, print one entry.
  cache clear [layer[/key]]     Wipe one layer (or single entry), or everything.

  Layers: research/domain, research/project, codebase-intelligence,
          design-context, security, scenario, validate.
`;
}

// Programmatic read for slash-commands: stdout = compact JSON value on a fresh
// hit (exit 0); silent + exit 1 on miss or past-TTL, so bash `&&`/`||` branches.
function cmdGet(layer, key, flags) {
  if (!layer || !key) throw new Error('maude cache get <layer> <key> [--ttl-ms N]');
  const hit = check(layer, key);
  const ttlMs = flags['ttl-ms'] != null ? Number(flags['ttl-ms']) : Number.POSITIVE_INFINITY;
  const fresh = hit && hit.ageMs <= ttlMs;
  recordAccess(layer, fresh ? 'hit' : 'miss'); // feed `maude cache stats`
  if (!fresh) {
    process.exitCode = 1; // miss / stale — no stdout
    return;
  }
  process.stdout.write(`${JSON.stringify(hit.value)}\n`);
}

// Programmatic write for slash-commands. Value JSON comes from <file> or stdin.
function cmdPut(layer, key, file, flags) {
  if (!layer || !key) throw new Error('maude cache put <layer> <key> [file] [--meta JSON]');
  const raw = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('maude cache put: input is not valid JSON');
  }
  const meta = flags.meta ? JSON.parse(flags.meta) : {};
  const { path } = write(layer, key, value, meta);
  process.stderr.write(`cached ${layer}/${key} → ${path}\n`);
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtAge(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function cmdList() {
  const layers = list();
  if (layers.length === 0) {
    process.stdout.write('cache is empty (no entries written yet)\n');
    return;
  }
  process.stdout.write('LAYER                     ENTRIES   SIZE      LAST WRITE\n');
  for (const l of layers) {
    process.stdout.write(
      `${l.layer.padEnd(25)} ${String(l.entries).padStart(7)}   ${fmtBytes(l.bytes).padEnd(9)} ${fmtAge(Date.now() - l.newest)}\n`
    );
  }
}

function cmdStats() {
  const s = stats();
  const allLayers = new Set([...Object.keys(s.hits), ...Object.keys(s.misses)]);
  if (allLayers.size === 0) {
    process.stdout.write('no cache activity recorded yet\n');
    return;
  }
  process.stdout.write('LAYER                       HITS   MISSES   HIT-RATE\n');
  for (const layer of [...allLayers].sort()) {
    const hits = s.hits[layer] || 0;
    const misses = s.misses[layer] || 0;
    const total = hits + misses;
    const rate = total ? `${Math.round((hits / total) * 100)}%` : '—';
    process.stdout.write(
      `${layer.padEnd(25)} ${String(hits).padStart(6)}  ${String(misses).padStart(7)}   ${rate.padStart(8)}\n`
    );
  }
  if (s.since) process.stdout.write(`\nsince ${new Date(s.since).toISOString()}\n`);
}

function cmdInspect(layer, key) {
  if (!layer) throw new Error('maude cache inspect <layer> [key]');
  if (key) {
    const hit = check(layer, key);
    if (!hit) {
      process.stderr.write(`(no entry ${layer}/${key})\n`);
      process.exit(1);
    }
    process.stdout.write(
      `${layer}/${key}\n  written: ${new Date(hit.writtenAt).toISOString()} (${fmtAge(hit.ageMs)})\n  meta: ${JSON.stringify(hit.meta)}\n\n${JSON.stringify(hit.value, null, 2)}\n`
    );
    return;
  }
  const list_ = entries(layer);
  if (list_.length === 0) {
    process.stdout.write(`(layer "${layer}" is empty)\n`);
    return;
  }
  process.stdout.write(`${layer} — ${list_.length} entr${list_.length === 1 ? 'y' : 'ies'}\n`);
  for (const e of list_) {
    process.stdout.write(
      `  ${e.key.padEnd(40)} ${fmtBytes(e.bytes).padEnd(9)} ${fmtAge(e.ageMs)}\n`
    );
  }
}

function cmdClear(target) {
  if (!target) {
    const { removed } = clear();
    process.stdout.write(
      `cleared entire cache (${removed} top-level item${removed === 1 ? '' : 's'})\n`
    );
    return;
  }
  // `layer/key` clears a single entry; bare `layer` clears the whole layer.
  const slash = target.lastIndexOf('/');
  if (slash > 0) {
    const layer = target.slice(0, slash);
    const key = target.slice(slash + 1);
    // Only treat as entry-clear if the entry actually exists; otherwise treat
    // the whole path as a (nested) layer to wipe.
    if (check(layer, key)) {
      clear(layer, key);
      process.stdout.write(`cleared ${layer}/${key}\n`);
      return;
    }
  }
  const { removed } = clear(target);
  if (removed) process.stdout.write(`cleared layer "${target}"\n`);
  else process.stdout.write(`nothing to clear at "${target}"\n`);
}
