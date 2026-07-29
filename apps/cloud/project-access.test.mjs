// Cloud Phase 22 — who may open which project.
//
// This is the check that separates one customer's work from another's, so it
// is tested over combinations rather than over a happy path.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACCESS_MESSAGES, can, CAPABILITIES, decideAccess, ROLES } from './project-access.mjs';

const project = (over = {}) => ({ id: 'alligators', account_id: 'acct_owner', state: 'active', ...over });

describe('access is decided from facts', () => {
  it('the owner always gets in', () => {
    assert.deepEqual(decideAccess({ accountId: 'acct_owner', project: project() }), {
      ok: true,
      role: 'owner',
    });
  });

  it('a member gets their own role, a stranger gets nothing', () => {
    const members = [{ account_id: 'acct_b', role: 'member' }];
    assert.deepEqual(decideAccess({ accountId: 'acct_b', project: project(), members }), {
      ok: true,
      role: 'member',
    });
    assert.deepEqual(decideAccess({ accountId: 'acct_z', project: project(), members }), {
      ok: false,
      reason: 'no-access',
    });
  });

  it('a role nobody defined is not a role', () => {
    const members = [{ account_id: 'acct_b', role: 'superuser' }];
    assert.equal(decideAccess({ accountId: 'acct_b', project: project(), members }).ok, false);
  });
});

describe('the answer never becomes an oracle', () => {
  it('"no such project" and "not yours" are the same answer', () => {
    // Project ids are guessable — they are named after the work — so a
    // different answer for a project that exists would enumerate customers.
    const absent = decideAccess({ accountId: 'acct_z', project: null });
    const notMine = decideAccess({ accountId: 'acct_z', project: project() });
    assert.deepEqual(absent, notMine);
  });
});

describe('a paused or deleted project says something useful', () => {
  it('a purged project does not suggest asking for access', () => {
    // "No access" invites the reader to go ask someone, which is the one thing
    // that cannot help here.
    const r = decideAccess({ accountId: 'acct_owner', project: project({ state: 'purged' }) });
    assert.equal(r.reason, 'purged');
    assert.match(ACCESS_MESSAGES.purged, /If you exported it, that copy is still yours/);
  });

  it('a suspended project stays open to its OWNER', () => {
    // They have to be able to export it and to pay. Locking the owner out of a
    // lapsed project is how a billing problem becomes a data problem.
    assert.equal(
      decideAccess({ accountId: 'acct_owner', project: project({ state: 'suspended' }) }).ok,
      true
    );
    assert.equal(
      decideAccess({
        accountId: 'acct_b',
        project: project({ state: 'suspended' }),
        members: [{ account_id: 'acct_b', role: 'member' }],
      }).reason,
      'suspended'
    );
  });

  it('every reason has a sentence, and none of them is jargon', () => {
    for (const reason of ['not-signed-in', 'no-access', 'purged', 'suspended']) {
      const msg = ACCESS_MESSAGES[reason];
      assert.ok(msg, `no message for ${reason}`);
      for (const jargon of ['tenant', 'cell', 'account_id', 'state', 'token']) {
        assert.ok(!new RegExp(`\\b${jargon}\\b`, 'i').test(msg), `"${jargon}" in "${msg}"`);
      }
    }
  });
});

describe('what a role may do lives in one table', () => {
  it('a viewer can look and comment but not change anything', () => {
    // The interesting question is what a viewer can NOT do, and that is only
    // answerable at a glance because the answers are in one place.
    assert.equal(can('viewer', 'view'), true);
    assert.equal(can('viewer', 'comment'), true);
    for (const capability of ['edit', 'invite', 'billing', 'mirror', 'share', 'delete']) {
      assert.equal(can('viewer', capability), false, capability);
    }
  });

  it('only an owner touches money, membership or deletion', () => {
    for (const capability of ['invite', 'billing', 'delete']) {
      assert.deepEqual(CAPABILITIES[capability], ['owner'], capability);
    }
  });

  it('every capability names only roles that exist', () => {
    for (const [capability, roles] of Object.entries(CAPABILITIES)) {
      for (const role of roles) assert.ok(ROLES.includes(role), `${capability} → ${role}`);
    }
  });

  it('an unknown capability is denied, not allowed', () => {
    assert.equal(can('owner', 'launch-missiles'), false);
  });
});
