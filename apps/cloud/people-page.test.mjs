// Cloud Phase 22 Task 5 — the people panel.
//
// Adding somebody is a form. Removing them is the part that has to be honest,
// because "Remove" reads as instantaneous and is not.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { allPeopleHtml, peoplePage, removeConfirmPage } from './people-page.mjs';

const project = { id: 'alligators', name: 'Brno Alligators' };
const people = [
  { account_id: 'a1', email: 'owner@example.com', role: 'owner' },
  { account_id: 'a2', email: 'member@example.com', role: 'member' },
];

describe('the removal confirmation is honest about timing', () => {
  it('says how long an open project keeps working', () => {
    // The whole reason this page exists as a confirmation rather than a
    // one-click action. An admin who thinks removal is instant makes a
    // decision they would not otherwise make.
    const html = removeConfirmPage({
      project,
      person: people[1],
      tokenTtlMs: 12 * 3_600_000,
    });
    assert.match(html, /Remove member@example\.com\?/);
    assert.match(html, /keeps working for up to 12 hours/);
    assert.match(html, /no longer open the project/);
  });

  it('offers the urgent answer instead of burying it', () => {
    const html = removeConfirmPage({ project, person: people[1], tokenTtlMs: 3_600_000 });
    assert.match(html, /pause the project/);
    assert.match(html, /stops working within the hour/);
  });

  it('offers a way out of the confirmation', () => {
    const html = removeConfirmPage({ project, person: people[1], tokenTtlMs: 3_600_000 });
    assert.match(html, />Cancel</);
  });
});

describe('the owner is not something you can edit here', () => {
  it('shows no controls at all for the owner row', () => {
    // Not disabled controls — a disabled button invites somebody to go hunting
    // for the way to enable it.
    const html = peoplePage({ project, people, isOwner: true });
    const ownerRow = html.split('<tr>').find((r) => r.includes('owner@example.com'));
    assert.ok(!/<button/.test(ownerRow), 'the owner row must carry no buttons');
    assert.ok(!/<select/.test(ownerRow));
  });

  it('never offers "owner" as a role you can assign', () => {
    // Handing the project over is a transfer, not a role change — and doing it
    // here would leave a project with nobody who can pay for it.
    const html = peoplePage({ project, people, isOwner: true });
    assert.ok(!/<option value="owner"/.test(html));
    assert.match(html, /<option value="member"/);
    assert.match(html, /<option value="viewer"/);
  });
});

describe('a non-owner sees the truth, not a broken form', () => {
  it('gets no management controls and is told why', () => {
    // The SHELL chrome (Sign out) is allowed; the people panel's own
    // controls — invite, role save, remove — must be absent entirely.
    const html = peoplePage({ project, people, isOwner: false });
    assert.ok(!/Remove…/.test(html));
    assert.ok(!/value="invite"/.test(html));
    assert.ok(!/value="role"/.test(html));
    assert.ok(!/<select/.test(html));
    assert.match(html, /Only the project’s owner can add or remove people/);
  });
});

describe('roles are explained, not just named', () => {
  it('says what each role can actually do', () => {
    // "viewer" is a word we chose. What somebody needs to know is whether that
    // person can change their work.
    const html = peoplePage({ project, people, isOwner: true });
    assert.match(html, /Can design, edit and comment/);
    assert.match(html, /Everything, plus billing, people and deleting/);
  });
});

describe('copy and safety', () => {
  it('escapes an email rather than trusting it', () => {
    const html = peoplePage({
      project,
      people: [{ account_id: 'x', email: '<img src=x onerror=alert(1)>', role: 'member' }],
      isOwner: true,
    });
    assert.ok(!/<img/.test(html));
    assert.match(html, /&lt;img/);
  });

  // Cloud Phase 24 A12a. The select rendered bare single words, which asks the
  // inviter to already know a vocabulary we invented. With no script on the
  // page, the option text is the only place the meaning can appear at the
  // moment of the decision.
  it('the role dropdown says what each role means while it is being chosen', () => {
    const html = peoplePage({ project, people: [], isOwner: true });
    assert.match(html, /<option value="member"[^>]*>Member — can change the designs<\/option>/);
    assert.match(
      html,
      /<option value="viewer"[^>]*>Viewer — can look and download, not change<\/option>/
    );
    assert.doesNotMatch(html, /<option value="member"[^>]*>member<\/option>/);
  });

  it('ships no script', () => {
    const html = allPeopleHtml();
    assert.ok(!/<script/i.test(html));
    assert.ok(!/\son[a-z]+\s*=/i.test(html));
  });

  it('uses no vocabulary of ours', () => {
    const html = allPeopleHtml();
    for (const jargon of ['tenant', 'cell', 'token', 'revoke', 'session', 'container']) {
      assert.ok(
        !new RegExp(`\\b${jargon}`, 'i').test(html),
        `"${jargon}" leaked into the people panel`
      );
    }
  });
});
