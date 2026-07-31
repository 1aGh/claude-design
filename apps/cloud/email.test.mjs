// The email boundary — Cloud Phase 22.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emailConfigured, fromAddress, inviteEmail, sendEmail } from './email.mjs';

describe('inviteEmail', () => {
  const mail = inviteEmail({
    projectName: 'Brno Alligators',
    role: 'member',
    inviteUrl: 'https://cloud.maude.sh/invite/abc',
    invitedBy: 'owner@example.com',
  });

  it('carries the link, the project, and who is asking', () => {
    assert.match(mail.subject, /owner@example\.com invited you to Brno Alligators/);
    assert.match(mail.text, /https:\/\/cloud\.maude\.sh\/invite\/abc/);
    assert.match(mail.text, /14 days/);
  });

  it('tells a viewer and a member different truths about what they can do', () => {
    const viewer = inviteEmail({
      projectName: 'P',
      role: 'viewer',
      inviteUrl: 'u',
      invitedBy: 'a@b.c',
    });
    assert.match(viewer.text, /comments/);
    assert.match(mail.text, /design and edit/);
  });

  it('uses no vocabulary of ours', () => {
    const all = `${mail.subject}\n${mail.text}`;
    for (const jargon of ['tenant', 'cell', 'token', 'hub', 'container', 'provision']) {
      assert.ok(!new RegExp(`\\b${jargon}`, 'i').test(all), `"${jargon}" leaked into the email`);
    }
  });
});

describe('sendEmail', () => {
  it('refuses quietly when no key is configured — and never calls out', async () => {
    let called = false;
    const out = await sendEmail(
      {},
      { to: 'a@b.c', subject: 's', text: 't' },
      {
        fetchImpl: async () => {
          called = true;
        },
      }
    );
    assert.equal(out.ok, false);
    assert.equal(called, false);
  });

  it('posts the payload Resend expects, from the configured sender', async () => {
    let seen;
    const out = await sendEmail(
      { RESEND_API_KEY: 'key', EMAIL_FROM: 'Maude <x@y.z>' },
      { to: 'a@b.c', subject: 's', text: 't' },
      {
        fetchImpl: async (url, init) => {
          seen = { url, init };
          return new Response(JSON.stringify({ id: 'em_1' }), { status: 200 });
        },
      }
    );
    assert.equal(out.ok, true);
    assert.equal(out.id, 'em_1');
    assert.equal(seen.url, 'https://api.resend.com/emails');
    assert.equal(seen.init.headers.authorization, 'Bearer key');
    assert.deepEqual(JSON.parse(seen.init.body), {
      from: 'Maude <x@y.z>',
      to: ['a@b.c'],
      subject: 's',
      text: 't',
    });
  });

  it('a provider rejection or outage is a false, never a throw', async () => {
    const rejected = await sendEmail(
      { RESEND_API_KEY: 'key' },
      { to: 'a@b.c', subject: 's', text: 't' },
      { fetchImpl: async () => new Response('nope', { status: 422 }) }
    );
    assert.equal(rejected.ok, false);

    const outage = await sendEmail(
      { RESEND_API_KEY: 'key' },
      { to: 'a@b.c', subject: 's', text: 't' },
      {
        fetchImpl: async () => {
          throw new Error('ECONNRESET');
        },
      }
    );
    assert.equal(outage.ok, false);
  });

  it('defaults the sender to the product address', () => {
    assert.match(fromAddress({}), /cloud@maude\.sh/);
    assert.equal(emailConfigured({ RESEND_API_KEY: 'k' }), true);
    assert.equal(emailConfigured({}), false);
  });
});
