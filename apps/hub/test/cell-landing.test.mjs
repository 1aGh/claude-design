// The customer-facing cell landing — validate 2026-07-30.
//
// Two rules, both learned the hard way:
//   1. a customer opening their own project must see THEIR project, not a
//      generic default (the "Studio Hub" placeholder);
//   2. cell-served HTML must not rely on inline styles, because the admin CSP
//      is `style-src 'self'` and drops them SILENTLY — the DOM shows the
//      attribute, the computed style ignores it. Third recurrence of DDR-097,
//      so it becomes a test rather than a memory.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'server.mjs');
const source = readFileSync(SRC, 'utf8');

/** The landing template, extracted from the module source. */
function landingTemplate() {
  const start = source.indexOf('function renderLanding(');
  assert.ok(start > 0, 'renderLanding must exist');
  const end = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, end > 0 ? end : undefined);
}

test('the landing carries no inline style attribute — the CSP would drop it', () => {
  const tpl = landingTemplate();
  const inline = [...tpl.matchAll(/\sstyle\s*=\s*["'][^"']*["']/g)].map((m) => m[0].trim());
  assert.deepEqual(
    inline,
    [],
    `inline styles are silently dropped by style-src 'self' — move these to admin/style.css: ${inline.join(', ')}`
  );
});

test('every class the landing uses exists in the stylesheet it links', () => {
  const tpl = landingTemplate();
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'admin', 'style.css'),
    'utf8'
  );
  const used = new Set();
  for (const m of tpl.matchAll(/class="([^"$]+)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) used.add(c);
  }
  const missing = [...used].filter((c) => !css.includes(`.${c}`));
  assert.deepEqual(missing, [], `classes with no rule: ${missing.join(', ')}`);
});

test('a customer sees their project, never the operator default', async () => {
  const { DEFAULT_HUB_NAME } = await import('../src/settings.mjs');
  // The landing is module-private; drive it through the precedence rules it
  // encodes, which is what actually broke: a defaulted name beat the tenant.
  const tpl = landingTemplate();
  assert.match(
    tpl,
    /settings\?\.name && settings\.name !== DEFAULT_HUB_NAME/,
    'an operator-set name must be distinguished from the default'
  );
  assert.match(tpl, /projectName \?\?/, 'a platform-supplied project name is honoured');
  assert.match(tpl, /nameFromSlug\(tenantId\)/, 'and the tenant slug beats the generic default');
  assert.equal(DEFAULT_HUB_NAME, 'Studio Hub');
});

// ---- the identity posture is a fact, not a claim -------------------------

test('health reports which identity mode the cell is ACTUALLY in', async () => {
  const src = readFileSync(SRC, 'utf8');
  assert.match(src, /function identityPosture\(\)/);
  // The three states must be distinguishable — "off" is not the same as
  // "hybrid", and only "strict" closes the local door.
  const fn = src.slice(src.indexOf('function identityPosture()'));
  assert.match(fn, /'strict'/);
  assert.match(fn, /'hybrid'/);
  assert.match(fn, /'off'/);
  assert.match(fn, /localDoor: mode !== 'strict'/);
  // And it must be surfaced on health, not merely computed.
  assert.ok(
    src.split('identity: identityPosture()').length - 1 >= 2,
    'both health surfaces report it'
  );
});
