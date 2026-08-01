// A viewer can look and cannot change — Cloud Phase 25 C1.
//
// The role has existed since Phase 22 and enforced nothing: `viewer` lived in
// invites and membership, and the cell refused those tokens at the door rather
// than admit a session it could not restrain. This is the enforcement that
// lets the door open.
//
// THE PROPERTY UNDER TEST IS "CANNOT", NOT "IS NOT SHOWN". Hiding the editing
// UI is the last layer; these tests are about the layers underneath, because a
// viewer with a patched client, a stale build, or curl is the case that
// matters.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import { addToken, rotateToken, verifyToken } from '../src/tokens.mjs';

const dirs = [];
function freshDir() {
  const d = mkdtempSync(join(tmpdir(), 'maude-readonly-'));
  dirs.push(d);
  return d;
}
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('the capability lives on the token, not in the UI', () => {
  it('a read-only token verifies as read-only', () => {
    const dir = freshDir();
    const minted = addToken(dir, { label: 'viewer-1', owner: 'v@example.com', readOnly: true });
    assert.equal(minted.readOnly, true);
    const seen = verifyToken(dir, minted.value);
    assert.equal(seen.readOnly, true);
    assert.equal(seen.owner, 'v@example.com');
  });

  it('an ordinary token is write-capable, and says so explicitly', () => {
    const dir = freshDir();
    const minted = addToken(dir, { label: 'member-1', owner: 'm@example.com' });
    assert.equal(minted.readOnly, undefined, 'the common case carries no extra field');
    assert.equal(verifyToken(dir, minted.value).readOnly, false);
  });

  it('a token minted before this shipped reads as write-capable, not read-only', () => {
    // The additive-migration promise: an operator upgrading a live hub loses
    // nothing, and nobody silently becomes a viewer.
    const dir = freshDir();
    const minted = addToken(dir, { label: 'legacy', owner: 'old@example.com' });
    assert.equal(verifyToken(dir, minted.value).readOnly, false);
  });

  it('ROTATION PRESERVES IT — otherwise rotate is a silent promotion', () => {
    // The escalation this file exists to prevent: rotate a viewer's token and
    // hand them an editor's session, with no audit trail and no UI change.
    const dir = freshDir();
    addToken(dir, { label: 'viewer-2', owner: 'v@example.com', readOnly: true });
    const rotated = rotateToken(dir, 'viewer-2');
    assert.equal(rotated.readOnly, true);
    assert.equal(verifyToken(dir, rotated.value).readOnly, true);
  });

  it('the env-secret escape hatch is never read-only — it is the operator', () => {
    const dir = freshDir();
    const seen = verifyToken(dir, 'the-hub-secret', 'the-hub-secret');
    assert.equal(seen.source, 'env');
    assert.equal(seen.readOnly, false);
  });
});
