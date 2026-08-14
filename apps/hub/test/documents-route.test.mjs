// The document listing a syncing peer needs — see src/documents.mjs.
//
// The bug it exists for: a desktop syncs one provider per LOCAL canvas, so a
// document that exists only on the hub is invisible to it by construction. The
// peer reports "72/72 synced" and is telling the truth about the wrong set.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DOCUMENTS_PATH,
  handleDocumentItemRoute,
  handleDocumentsRoute,
} from '../src/documents.mjs';

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

  it('carries the tombstones a peer needs to stop resurrecting a delete', () => {
    const { sent } = call({ listTombstones: () => [{ name: 'ui-gone', deletedAt: 1000 }] });
    assert.deepEqual(sent[0].payload.tombstones, [{ name: 'ui-gone', deletedAt: 1000 }]);
  });

  it('scope-filters tombstones exactly like documents', () => {
    // "Which canvases were deleted" leaks the same names "which canvases exist"
    // does — one gate, both lists.
    const { sent } = call({
      verify: () => ({ scope: 'ws/acme/main/' }),
      matchesScope: (scope, name) => name.startsWith(scope),
      listTombstones: () => [
        { name: 'ui-gone', deletedAt: 1 },
        { name: 'ws/acme/main/ui-secret', deletedAt: 2 },
      ],
    });
    assert.deepEqual(
      sent[0].payload.tombstones.map((t) => t.name),
      ['ws/acme/main/ui-secret']
    );
  });

  it('a hub with no tombstone store answers with an empty set, not a failure', () => {
    const { sent } = call({ listTombstones: undefined });
    assert.equal(sent[0].status, 200);
    assert.deepEqual(sent[0].payload.tombstones, []);
  });
});

function callItem(overrides = {}) {
  const sent = [];
  const deleted = [];
  const revived = [];
  const handled = handleDocumentItemRoute({
    path: '/api/documents/ui-welcome',
    method: 'DELETE',
    bearer: 'good',
    verify: (t) => (t === 'good' ? { scope: '*' } : null),
    matchesScope: () => true,
    deleteDocument: (n) => deleted.push(n),
    reviveDocument: (n) => revived.push(n),
    respondJson: (status, payload) => sent.push({ status, payload }),
    ...overrides,
  });
  return { handled, sent, deleted, revived };
}

describe('DELETE/POST /api/documents/<name>', () => {
  it('tombstones the named document', () => {
    const { handled, sent, deleted } = callItem();
    assert.equal(handled, true);
    assert.equal(sent[0].status, 200);
    assert.deepEqual(deleted, ['ui-welcome']);
  });

  it('POST revives instead of deleting, so a re-created name is not eaten', () => {
    const { sent, deleted, revived } = callItem({ method: 'POST' });
    assert.equal(sent[0].status, 200);
    assert.deepEqual(deleted, []);
    assert.deepEqual(revived, ['ui-welcome']);
  });

  it('decodes a percent-encoded name (document names contain `/`)', () => {
    const { deleted } = callItem({ path: '/api/documents/ws%2Facme%2Fmain%2Fui-x' });
    assert.deepEqual(deleted, ['ws/acme/main/ui-x']);
  });

  it('refuses a missing and an invalid token identically', () => {
    const missing = callItem({ bearer: null });
    const bad = callItem({ bearer: 'nope' });
    assert.equal(missing.sent[0].status, 401);
    assert.deepEqual(missing.sent[0].payload, bad.sent[0].payload);
    assert.deepEqual(missing.deleted, []);
  });

  it('refuses a read-only token — deleting is the most destructive write', () => {
    const { sent, deleted } = callItem({ verify: () => ({ scope: '*', readOnly: true }) });
    assert.equal(sent[0].status, 403);
    assert.deepEqual(deleted, []);
  });

  it('an out-of-scope name is not deleted, and answers like an in-scope one', () => {
    // Distinguishable answers would make this an existence oracle for names the
    // token may not open.
    const outside = callItem({
      verify: () => ({ scope: 'ws/acme/main/' }),
      matchesScope: (scope, name) => name.startsWith(scope),
    });
    const inside = callItem({
      path: '/api/documents/ws%2Facme%2Fmain%2Fui-x',
      verify: () => ({ scope: 'ws/acme/main/' }),
      matchesScope: (scope, name) => name.startsWith(scope),
    });
    assert.deepEqual(outside.deleted, []);
    assert.equal(outside.sent[0].status, inside.sent[0].status);
  });

  it('refuses a name outside the document charset', () => {
    const { sent, deleted } = callItem({ path: '/api/documents/..%2F..%2Fetc%2Fpasswd' });
    assert.equal(sent[0].status, 400);
    assert.deepEqual(deleted, []);
  });

  it('refuses a malformed percent-encoding rather than throwing', () => {
    const { sent, deleted } = callItem({ path: '/api/documents/%E0%A4%A' });
    assert.equal(sent[0].status, 400);
    assert.deepEqual(deleted, []);
  });

  it('refuses a method that is neither delete nor revive', () => {
    const { sent } = callItem({ method: 'PUT' });
    assert.equal(sent[0].status, 405);
  });

  it('declines paths that are not its own', () => {
    const { handled, sent } = callItem({ path: '/api/export' });
    assert.equal(handled, false);
    assert.equal(sent.length, 0);
  });
});
