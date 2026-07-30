// Cloud Phase 18 — what gets published, and what must never be.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isShareable,
  publishPlan,
  publishSummary,
  shareMarker,
  validProjectId,
} from './share-plan.mjs';

test('SVG is never published, however it is named', () => {
  // Same reason the share origin refuses to SERVE one: an SVG is a document
  // that can carry <script>. Two lists that could disagree would be a hole,
  // so both refuse it and both say why.
  for (const bad of ['logo.svg', 'a/b.SVG', 'x.html', 'x.js', 'x.pdf', 'notes.md', 'x.tsx']) {
    assert.equal(isShareable(bad), false, bad);
  }
  for (const ok of ['a.png', 'a.JPG', 'a.jpeg', 'a.webp', 'a.avif']) {
    assert.equal(isShareable(ok), true, ok);
  }
});

test('a publish cannot climb out of the directory it was pointed at', () => {
  const { uploads, skipped } = publishPlan(
    ['../secret.png', '/etc/x.png', 'a/../../b.png', 'ok.png', 'ui/home.png'],
    'acme'
  );
  assert.deepEqual(
    uploads.map((u) => u.from),
    ['ok.png', 'ui/home.png']
  );
  assert.equal(skipped.length, 3);
});

test('every key is scoped to its own project', () => {
  const { uploads } = publishPlan(['home.png'], 'acme');
  assert.equal(uploads[0].key, 'tenants/acme/snapshots/home.png');
  assert.throws(() => publishPlan(['a.png'], '../other'), /invalid project id/);
  assert.throws(() => publishPlan(['a.png'], 'Acme'), /invalid project id/);
  assert.equal(validProjectId('a-b-1'), 'a-b-1');
});

test('the marker is what turns sharing on, and defaults closed', () => {
  const on = JSON.parse(shareMarker('acme', { enabled: true, name: 'Acme Co' }).body);
  assert.deepEqual(on, { enabled: true, name: 'Acme Co' });
  // Anything that is not exactly true is off. The share view treats a missing
  // or unparseable marker the same way, so every failure mode is closed.
  const off = JSON.parse(shareMarker('acme', { enabled: false }).body);
  assert.equal(off.enabled, false);
  assert.equal(off.name, 'acme');
});

test('the summary says what a shared view is NOT', () => {
  const out = publishSummary({ project: 'acme', uploaded: 3, skipped: 0 });
  assert.match(out, /https:\/\/view-acme\.cloud\.maude\.sh/);
  // The single most likely misunderstanding is that this is live.
  assert.match(out, /do not update\s*\n?themselves/);
});

test('a skipped file is explained, not silently dropped', () => {
  const out = publishSummary({ project: 'acme', uploaded: 1, skipped: 2 });
  assert.match(out, /SVG is excluded on purpose/);
});
