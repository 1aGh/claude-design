// Bundle-size guardrail: the combined gzipped size of the admin shell + CSS +
// JS must stay under 15 KB (per Phase 9 Task 2.5 spec).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';

import { ADMIN_CSS, ADMIN_HTML, ADMIN_JS } from '../src/admin-assets.mjs';

const BUDGET_BYTES = 15 * 1024; // 15 KB gz, hard ceiling.

test('combined gzipped admin bundle is under 15 KB', () => {
  const combined = `${ADMIN_HTML}\n${ADMIN_CSS}\n${ADMIN_JS}`;
  const gz = gzipSync(Buffer.from(combined, 'utf8'), { level: 9 });
  assert.ok(
    gz.byteLength < BUDGET_BYTES,
    `admin bundle gz=${gz.byteLength} exceeds ${BUDGET_BYTES} budget`
  );
});

test('individual admin files are non-empty (loader resolved them)', () => {
  assert.ok(ADMIN_HTML.length > 100, 'index.html missing or empty');
  assert.ok(ADMIN_CSS.length > 100, 'style.css missing or empty');
  assert.ok(ADMIN_JS.length > 100, 'app.js missing or empty');
});
