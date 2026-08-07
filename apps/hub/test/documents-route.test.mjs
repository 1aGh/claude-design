// The document listing a syncing peer needs — see src/documents.mjs.
//
// The bug it exists for: a desktop syncs one provider per LOCAL canvas, so a
// document that exists only on the hub is invisible to it by construction. The
// peer reports "72/72 synced" and is telling the truth about the wrong set.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DOCUMENTS_PATH, handleDocumentsRoute } from '../src/documents.mjs';

const DOCS = [
  { name: 'ui-welcome', bytes: 2931 },
  { name: 'ui-home', bytes: 100 },
  { name: 'ws/acme/main/ui-secret', bytes: 42 },
];

function call(overrides = {}) {
  const sent = [];
  const handled = handleDocumentsRoute({
    path: DOCUMENTS_PATH,
    method: 'GET',
    bearer: 'good',
    verify: (t) => (t === 'good' ? { scope: '*' } : null),
    matchesScope: () => true,
    listDocuments: () => DOCS,
    respondJson: (status, payload) => sent.push({ status, payload }),
    ...overrides,
  });
  return { handled, sent };
}

describe('GET /api/documents', () => {
  it('lists names and sizes for a valid project token', () => {
    const { handled, sent } = call();
    assert.equal(handled, true);
    assert.equal(sent[0].status, 200);
    assert.equal(sent[0].payload.count, 3);
    assert.deepEqual(sent[0].payload.documents[0], { name: 'ui-welcome', bytes: 2931 });
  });

  it('never leaks document CONTENT — names and sizes only', () => {
    const { sent } = call({
      listDocuments: () => [{ name: 'ui-home', bytes: 10, data: 'SECRET', extra: 1 }],
    });
    assert.deepEqual(Object.keys(sent[0].payload.documents[0]).sort(), ['bytes', 'name']);
  });

  it('a token may not learn that a document it cannot open exists', () => {
    // The same gate `onAuthenticate` applies per document. A listing that
    // ignored scope would be a disclosure channel the WS door does not have.
    const { sent } = call({
      verify: () => ({ scope: 'ws/acme/main/' }),
      matchesScope: (scope, name) => name.startsWith(scope),
    });
    assert.equal(sent[0].payload.count, 1);
    assert.deepEqual(
      sent[0].payload.documents.map((d) => d.name),
      ['ws/acme/main/ui-secret']
    );
  });

  it('refuses a missing and an invalid token identically', () => {
    // Distinguishable answers here would make this a token-probing oracle.
    const missing = call({ bearer: null });
    const bad = call({ bearer: 'nope' });
    assert.equal(missing.sent[0].status, 401);
    assert.equal(bad.sent[0].status, 401);
    assert.deepEqual(missing.sent[0].payload, bad.sent[0].payload);
  });

  it('is read-only: a write method is refused, not served', () => {
    const { sent } = call({ method: 'POST' });
    assert.equal(sent[0].status, 405);
  });

  it('declines paths that are not its own', () => {
    const { handled, sent } = call({ path: '/api/export' });
    assert.equal(handled, false);
    assert.equal(sent.length, 0);
  });
});
