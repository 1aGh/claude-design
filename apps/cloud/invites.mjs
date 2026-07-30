// Accepting a project invitation — Cloud Phase 22 Task 5 (DDR-204).
//
// The invite IS the account: somebody with no Maude account follows one link,
// chooses a password, and lands in the project — they never sign up first and
// then have to find their way. Somebody who already has an account signs in
// (or already is) and the same link attaches them.
//
// One rule carried from the rest of the identity surface: the page never
// reveals more than the link-holder is entitled to. A dead link — expired,
// revoked, already used, or simply wrong — gets ONE neutral sentence, because
// "this invite was revoked" tells a fired contractor exactly what happened and
// a guessed UUID must learn nothing at all.

import { createAccount, createSession, getAccountByEmail } from './accounts.mjs';
import { audit } from './db.mjs';
import { lockup, PAGE_CSS } from './brand.mjs';

const DEAD_LINK = 'This invitation link is not valid. Ask the person who invited you for a new one.';

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} — Maude</title><style>${PAGE_CSS}\n  main { max-width: 26rem; }</style></head><body><main>${lockup()}${body}</main></body></html>`;
}

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
      'referrer-policy': 'no-referrer',
      ...extraHeaders,
    },
  });
}

const ROLE_MEANING = {
  viewer: 'You’ll be able to look at the work and leave comments.',
  member: 'You’ll be able to design and edit alongside the team.',
};

/**
 * The invitation page, in the shape the visitor's situation calls for.
 *
 * `mode` is one of:
 *   'join'    — signed in as the invited address; one button.
 *   'sign-in' — an account with this address exists; go sign in first.
 *   'create'  — no account; choose a password right here.
 */
export function invitePage({ projectName, role, mode, email, inviteId, error = null }) {
  const meaning = ROLE_MEANING[role] ?? '';
  const action = `/invite/${esc(inviteId)}`;
  let body = '';
  if (mode === 'join') {
    body = `<form method="post" action="${action}"><button type="submit">Join the project</button></form>`;
  } else if (mode === 'sign-in') {
    body = `<p>You already have a Maude account for <strong>${esc(email)}</strong>.
      Sign in, then open this link again to join.</p>
      <p><a class="btn" href="/login">Sign in</a></p>`;
  } else {
    body = `<form method="post" action="${action}">
      <label for="password">Choose a password</label>
      <input type="password" id="password" name="password" minlength="12" required
             autocomplete="new-password" placeholder="at least 12 characters">
      <label style="font-weight:400"><input type="checkbox" name="disclosure" value="yes" required>
        I’ve read <a href="/signup" target="_blank">what Maude Cloud stores</a>.</label>
      <p style="margin-top:1rem"><button type="submit">Create account and join</button></p>
    </form>`;
  }
  return page(
    `Join ${projectName}`,
    `<h1>Join ${esc(projectName)}</h1>
     <p class="quiet">This invitation is for <strong>${esc(email)}</strong>. ${esc(meaning)}</p>
     ${error ? `<p class="error">${esc(error)}</p>` : ''}
     <div class="card">${body}</div>`
  );
}

/** Look up an invite and decide whether it can still be used. */
async function liveInvite(env, inviteId, { now = Date.now() } = {}) {
  if (!/^[0-9a-f-]{36}$/.test(inviteId)) return null;
  const row = await env.DB.prepare(
    `SELECT i.*, p.name AS project_name FROM project_invites i
       JOIN projects p ON p.id = i.project_id
      WHERE i.id = ?`
  )
    .bind(inviteId)
    .first();
  if (!row) return null;
  if (row.redeemed_at || row.revoked_at || row.expires_at < now) return null;
  return row;
}

/** Add the membership, mark the invite spent, and write the audit line. */
async function redeem(env, invite, accountId, { now = Date.now() } = {}) {
  await env.DB.prepare(
    `INSERT INTO project_members (project_id, account_id, role, added_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (project_id, account_id) DO UPDATE SET role = excluded.role`
  )
    .bind(invite.project_id, accountId, invite.role, now)
    .run();
  await env.DB.prepare('UPDATE project_invites SET redeemed_at = ? WHERE id = ?')
    .bind(now, invite.id)
    .run();
  await audit(env.DB, {
    accountId,
    projectId: invite.project_id,
    actor: `customer:${invite.email}`,
    action: 'invite.redeem',
    detail: JSON.stringify({ invite: invite.id, role: invite.role }),
  });
}

/**
 * Route `/invite/<id>`. Returns a Response, or null when the path is not ours.
 *
 * @param {{ account: {id: string, email: string} | null }} ctx  the signed-in
 *   account, resolved by the caller the same way every surface resolves it.
 */
export async function handleInviteRoutes(request, env, { account }) {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/invite\/([^/]+)$/);
  if (!m) return null;

  const invite = await liveInvite(env, decodeURIComponent(m[1]));
  if (!invite) return html(page('Invitation', `<h1>Invitation</h1><p>${DEAD_LINK}</p>`), 404);

  const view = {
    projectName: invite.project_name,
    role: invite.role,
    email: invite.email,
    inviteId: invite.id,
  };
  const existing = await getAccountByEmail(env.DB, invite.email);
  const signedInAsInvitee = account && existing && account.id === existing.id;
  const mode = signedInAsInvitee ? 'join' : existing ? 'sign-in' : 'create';

  if (request.method === 'GET') return html(invitePage({ ...view, mode }));
  if (request.method !== 'POST') return html('<p>Not allowed.</p>', 405);

  if (mode === 'join') {
    await redeem(env, invite, account.id);
    return new Response(null, { status: 303, headers: { location: '/' } });
  }

  if (mode === 'sign-in') {
    // A POST in this state is a stale form or a probe — either way, the answer
    // is the same page that says to sign in first.
    return html(invitePage({ ...view, mode }), 409);
  }

  const form = await request.formData();
  if (form.get('disclosure') !== 'yes') {
    return html(
      invitePage({ ...view, mode, error: 'Please confirm you’ve read what Maude Cloud stores.' }),
      400
    );
  }
  let created;
  try {
    created = await createAccount(env.DB, {
      email: invite.email,
      password: String(form.get('password') ?? ''),
    });
  } catch {
    return html(
      invitePage({ ...view, mode, error: 'That didn’t work — use at least 12 characters.' }),
      400
    );
  }
  await env.DB.prepare('UPDATE accounts SET disclosure_accepted_at = ? WHERE id = ?')
    .bind(Date.now(), created.id)
    .run();
  await redeem(env, invite, created.id);
  const session = await createSession(env.DB, created.id);
  return new Response(null, {
    status: 303,
    headers: {
      location: '/',
      'set-cookie': `maude_session=${session.token}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax; Secure; HttpOnly`,
    },
  });
}

/** Every customer-facing string here, for the vocabulary lint. */
export function allInviteHtml() {
  const base = { projectName: 'Brno Alligators', inviteId: 'x'.repeat(36) };
  return [
    invitePage({ ...base, role: 'member', mode: 'create', email: 'new@example.com' }),
    invitePage({ ...base, role: 'viewer', mode: 'sign-in', email: 'old@example.com' }),
    invitePage({ ...base, role: 'member', mode: 'join', email: 'me@example.com' }),
    invitePage({ ...base, role: 'member', mode: 'create', email: 'n@example.com', error: 'Please confirm you’ve read what Maude Cloud stores.' }),
    page('Invitation', `<h1>Invitation</h1><p>${DEAD_LINK}</p>`),
  ].join('\n');
}
