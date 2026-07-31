// Cloud Phase 22 Task 5 — removal is the hard half.
//
// Adding somebody is a row. Removing them has to answer "and what about the
// access they already have" — and because a project token is verified OFFLINE
// so an outage cannot lock anyone out, that access cannot be recalled. These
// tests are mostly about telling the truth about that.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  decideMembershipChange,
  ROLES,
  removalConfirmation,
  removalEffect,
} from './membership.mjs';

const base = {
  actorId: 'acct_owner',
  actorRole: 'owner',
  ownerId: 'acct_owner',
  targetAccountId: 'acct_b',
  targetRole: 'member',
};

describe('only the owner changes who has access', () => {
  it('refuses a member, a viewer, and a stranger', () => {
    for (const actorRole of ['member', 'viewer', undefined]) {
      const r = decideMembershipChange({ ...base, actorRole, newRole: null });
      assert.equal(r.ok, false, String(actorRole));
      assert.equal(r.reason, 'not-allowed');
    }
  });
});

describe('the owner cannot be removed or demoted here', () => {
  it('refuses, and says what to do instead', () => {
    // Not because it is unthinkable — handing a project over is real — but
    // because doing it here leaves a project with nobody who can pay for it
    // or delete it, and recovering from that requires us.
    const r = decideMembershipChange({ ...base, targetAccountId: 'acct_owner', newRole: null });
    assert.equal(r.reason, 'owner-immutable');
    assert.match(r.message, /Transfer the project first/);
  });

  it('promoting someone to owner is a transfer, not a role change', () => {
    const r = decideMembershipChange({ ...base, newRole: 'owner' });
    assert.equal(r.reason, 'owner-immutable');
    assert.match(r.message, /transfer, not a role change/);
  });
});

describe('a demotion revokes, not just updates', () => {
  it('member → viewer revokes sessions', () => {
    // A session opened as a member still carries the ability to edit, and
    // offline verification cannot be told otherwise. Treating this as "just an
    // update" would leave them editing until the token expired.
    const r = decideMembershipChange({ ...base, targetRole: 'member', newRole: 'viewer' });
    assert.equal(r.action, 'change-role');
    assert.equal(r.revokeSessions, true);
  });

  it('a promotion does not need to revoke anything', () => {
    const r = decideMembershipChange({ ...base, targetRole: 'viewer', newRole: 'member' });
    assert.equal(r.revokeSessions, false);
  });

  it('a removal always revokes', () => {
    const r = decideMembershipChange({ ...base, newRole: null });
    assert.deepEqual(r, { ok: true, action: 'remove', revokeSessions: true });
  });

  it('removing someone who was never there is not a removal', () => {
    const r = decideMembershipChange({ ...base, targetRole: null, newRole: null });
    assert.equal(r.reason, 'not-a-member');
  });

  it('an invented role is refused', () => {
    assert.equal(decideMembershipChange({ ...base, newRole: 'superuser' }).reason, 'unknown-role');
    for (const role of ROLES.filter((r) => r !== 'owner')) {
      assert.equal(decideMembershipChange({ ...base, newRole: role }).ok, true, role);
    }
  });
});

describe('removal tells the truth about how long it takes', () => {
  it('says plainly that an open session keeps working', () => {
    // "They are removed" implies immediacy. An admin who believes that and is
    // wrong makes a decision they would not otherwise make.
    const e = removalEffect({ tokenTtlMs: 12 * 3_600_000 });
    assert.match(e.delayed, /keeps working for up to 12 hours/);
    assert.match(e.immediate[0], /no longer open the project/);
  });

  it('offers the urgent escape hatch rather than burying it', () => {
    const e = removalEffect({ tokenTtlMs: 12 * 3_600_000 });
    assert.match(e.ifUrgent, /pause the project/);
    assert.match(e.ifUrgent, /stops everyone immediately/);
  });

  it('a short token changes the sentence, not just the number', () => {
    const e = removalEffect({ tokenTtlMs: 3_600_000 });
    assert.match(e.delayed, /stops working within the hour/);
  });
});

describe('the confirmation names the human', () => {
  it('shows the email and the project, never an id', () => {
    // An admin confirming a destructive action against an opaque identifier is
    // an admin who occasionally removes the wrong person.
    const c = removalConfirmation({
      email: 'b@example.com',
      projectName: 'Brno Alligators',
      tokenTtlMs: 12 * 3_600_000,
    });
    assert.equal(c.title, 'Remove b@example.com from Brno Alligators?');
    assert.equal(c.points.length, 2);
    assert.match(c.points[1], /12 hours/);
    assert.match(c.footnote, /pause the project/);
  });
});
