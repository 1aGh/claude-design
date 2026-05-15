#!/usr/bin/env node
// Sync MDCC-DSN/01 design tokens from .design/system/project/colors_and_type.css
// into site/app/mdcc-tokens.css. The source-of-truth lives in .design; this
// script just keeps the published copy under site/app/ in lock-step.
//
// Usage:
//   node scripts/sync-mdcc-tokens.mjs           # copy SRC → DST (overwrites)
//   node scripts/sync-mdcc-tokens.mjs --check   # exit non-zero on drift, no write

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SRC = resolve(REPO_ROOT, '.design/system/project/colors_and_type.css');
const DST = resolve(REPO_ROOT, 'site/app/mdcc-tokens.css');

const check = process.argv.includes('--check');

if (!existsSync(SRC)) {
  console.error(`[sync-mdcc-tokens] source missing: ${SRC}`);
  process.exit(2);
}

const src = readFileSync(SRC, 'utf8');
const dst = existsSync(DST) ? readFileSync(DST, 'utf8') : null;

if (check) {
  if (src !== dst) {
    console.error(
      `[sync-mdcc-tokens] DRIFT: ${DST} differs from ${SRC}.\nRun: pnpm --filter @md-claude/site sync:tokens`
    );
    process.exit(1);
  }
  console.log('[sync-mdcc-tokens] in sync');
  process.exit(0);
}

writeFileSync(DST, src);
console.log(`[sync-mdcc-tokens] wrote ${DST} (${src.length} bytes)`);
