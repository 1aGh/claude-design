#!/usr/bin/env node
// Mirror the dev-server "What's New" feed into the site so the /whats-new page
// can render it. Vercel uploads only site/, so site/lib/whats-new.json is
// COMMITTED (same rationale as roadmap.json) — the feed itself lives with the
// dev-server (plugins/design/dev-server/whats-new.json, the single source of
// truth, DDR-A) and may be absent at deploy time.
//
// Reads:
//   plugins/design/dev-server/whats-new.json        (entries)
//   plugins/design/.claude-plugin/plugin.json       (current version)
//
// Output: site/lib/whats-new.json  { generated, version, entries }
// Run as a prebuild step — see site/package.json `prebuild`.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const feedPath = resolve(repoRoot, 'plugins/design/dev-server/whats-new.json');
const manifestPath = resolve(repoRoot, 'plugins/design/.claude-plugin/plugin.json');
const out = resolve(__dirname, '../lib/whats-new.json');

let entries = [];
if (existsSync(feedPath)) {
  try {
    const parsed = JSON.parse(readFileSync(feedPath, 'utf8'));
    if (Array.isArray(parsed.entries)) entries = parsed.entries;
  } catch (err) {
    console.warn(`[whats-new] could not parse feed: ${err.message} — emitting empty`);
  }
}

let version = 'dev';
if (existsSync(manifestPath)) {
  try {
    const v = JSON.parse(readFileSync(manifestPath, 'utf8')).version;
    if (typeof v === 'string') version = v;
  } catch {
    /* fall through to dev */
  }
}

const payload = { generated: new Date().toISOString(), version, entries };
writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[whats-new] wrote ${out} — ${entries.length} entries (v${version})`);
