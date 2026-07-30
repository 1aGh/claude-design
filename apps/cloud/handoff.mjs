// One-time handoff codes — Cloud Phase 23 B3 (and the server half of
// Phase 17's maude://).
//
// THE ONE EXCHANGE SHAPE. A signed-in person (browser session or Bearer
// personal token) asks for a code; whoever holds the code — the desktop app a
// deep link just opened, and nothing else — POSTs it back ONCE within two
// minutes and receives the same project token `/projects/open` would mint.
// From there every consumer follows the already-shipped lane: the token goes
// to the cell in a POST body (`/auth/login {token}`), never in a GET URL.
//
// Why a code exists at all: the browser cannot POST into an installed app.
// The only channel from a web page into the app is a `maude://` navigation —
// a URL — and a URL must never carry a bearer token (Referer headers, proxy
// logs, the repo's own /join decision). So the URL carries a claim ticket:
// single-use, 120-second, hashed at rest, and worth nothing after the app
// trades it in.
//
// Guessing is not a lane: 32 random bytes; the exchange burns the row on
// first use, win or lose downstream.

import { mintProjectToken } from './cell-token.mjs';
import { audit } from './db.mjs';
import { personalTokenAccount } from './device-auth.mjs';
import { ACCESS_MESSAGES, decideAccess } from './project-access.mjs';

const CODE_TTL_MS = 2 * 60 * 1000;

function b64hex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(s) {
  return b64hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' },
  });
}

/**
 * Mint a one-time code for one project. Caller must already be resolved to an
 * account (session or personal token) — this function only decides access.
 *
 * Viewer is REFUSED here, exactly like the cell exchange (B2): a code that a
 * viewer could trade for an editing credential would be the silent escalation
 * the debate ruled out.
 */
export async function mintHandoffCode(env, { account, projectId, now = Date.now() }) {
  let project = null;
  let members = [];
  try {
    project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
    const rows = await env.DB.prepare(
      'SELECT account_id, role FROM project_members WHERE project_id = ?'
    )
      .bind(projectId)
      .all();
    members = rows?.results ?? [];
  } catch {
    /* unreadable membership is not access */
  }
  const verdict = decideAccess({ accountId: account?.id ?? null, project, members });
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  if (verdict.role === 'viewer') return { ok: false, reason: 'viewer-not-supported' };

  const code = `mhc_${b64hex(crypto.getRandomValues(new Uint8Array(32)))}`;
  await env.DB.prepare(
    `INSERT INTO handoff_codes (id, project_id, account_id, role, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(await sha256Hex(code), projectId, account.id, verdict.role, now, now + CODE_TTL_MS)
    .run();
  return { ok: true, code, role: verdict.role, expiresIn: CODE_TTL_MS / 1000 };
}

/**
 * Route the handoff surface. Returns a Response or null.
 *
 *   POST /projects/<id>/handoff     mint (session or Bearer personal token);
 *                                   HTML form POST → the maude:// launch page,
 *                                   JSON → { code, url, expires_in }
 *   POST /auth/handoff/exchange     { code } → project token (single use)
 */
export async function handleHandoff(request, env, { account }) {
  const url = new URL(request.url);
  const { pathname } = url;
  const now = Date.now();

  const mintMatch =
    request.method === 'POST' && /^\/projects\/([a-z0-9]+(?:-[a-z0-9]+)*)\/handoff$/.exec(pathname);
  if (mintMatch) {
    // A browser session and a device's personal token are the same person
    // through two doors — same rule as /projects/open.
    if (!account) account = await personalTokenAccount(env, request, { now });
    if (!account) return json({ error: ACCESS_MESSAGES['not-signed-in'] }, 401);
    const projectId = mintMatch[1];
    const minted = await mintHandoffCode(env, { account, projectId, now });
    if (!minted.ok) {
      if (minted.reason === 'viewer-not-supported') {
        return json(
          {
            error:
              'Viewing works from the shared gallery link — opening the project in the app needs the member role.',
          },
          403
        );
      }
      const status = minted.reason === 'not-signed-in' ? 401 : 404;
      return json({ error: ACCESS_MESSAGES[minted.reason] ?? ACCESS_MESSAGES['no-access'] }, status);
    }
    await audit(env.DB, {
      accountId: account.id,
      projectId,
      actor: `customer:${account.email}`,
      action: 'app.handoff',
    });

    const deepLink = `maude://open/${encodeURIComponent(projectId)}?code=${encodeURIComponent(minted.code)}&origin=${encodeURIComponent(url.origin)}`;
    const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
    if (wantsJson) return json({ code: minted.code, url: deepLink, expires_in: minted.expiresIn });

    // The browser lane: a tiny no-script page whose meta refresh fires the
    // maude:// navigation, with the same link visible for when the browser
    // asks first — and honest fallbacks for "nothing happened".
    return new Response(launchPage({ projectId, deepLink }), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
        'referrer-policy': 'no-referrer',
      },
    });
  }

  if (request.method === 'POST' && pathname === '/auth/handoff/exchange') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid request' }, 400);
    }
    const presented = String(body?.code ?? '');
    if (!presented.startsWith('mhc_')) return json({ error: 'that code is not valid' }, 400);
    const id = await sha256Hex(presented);

    // Burn first, decide after — a second presentation of the same code must
    // lose even if it races the first. D1 reports changed rows; zero means
    // someone else already burned it (or it never existed).
    const burn = await env.DB.prepare(
      'UPDATE handoff_codes SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?'
    )
      .bind(now, id, now)
      .run();
    if (!burn?.meta?.changes) return json({ error: 'that code is not valid or has expired' }, 400);

    const row = await env.DB.prepare('SELECT * FROM handoff_codes WHERE id = ?').bind(id).first();
    const who = await env.DB.prepare('SELECT * FROM accounts WHERE id = ?')
      .bind(row.account_id)
      .first();

    // Re-decide access at exchange time: a code must not outlive a removal
    // that happened in its two-minute window.
    let project = null;
    let members = [];
    try {
      project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?')
        .bind(row.project_id)
        .first();
      const rows = await env.DB.prepare(
        'SELECT account_id, role FROM project_members WHERE project_id = ?'
      )
        .bind(row.project_id)
        .all();
      members = rows?.results ?? [];
    } catch {
      /* unreadable membership is not access */
    }
    const verdict = decideAccess({ accountId: row.account_id, project, members });
    if (!verdict.ok || verdict.role === 'viewer' || !who) {
      return json({ error: 'that code is not valid or has expired' }, 400);
    }

    const { token, claims } = await mintProjectToken({
      master: env.CELL_SECRET_MASTER ?? '',
      project: row.project_id,
      email: who.email,
      role: verdict.role,
    });
    return json({
      token,
      role: verdict.role,
      project: row.project_id,
      url: `https://${row.project_id}.${env.CELL_ZONE ?? 'cloud.maude.sh'}`,
      expiresAt: claims.exp,
    });
  }

  return null;
}

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function launchPage({ projectId, deepLink }) {
  // No script (CSP default-src 'none'): the meta refresh fires the app, the
  // visible link covers browsers that ask before leaving the page.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=${esc(deepLink)}">
<title>Opening ${esc(projectId)} in Maude</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background:#111318; color:#f2f3f7;
         display:grid; place-items:center; min-height:100vh; margin:0; padding:24px; }
  main { max-width:26rem; text-align:center; }
  a.btn { display:inline-block; background:#7a86f8; color:#14162b; font-weight:600;
          padding:10px 18px; border-radius:10px; text-decoration:none; margin-top:12px; }
  p.quiet { color:#9aa0b0; font-size:14px; line-height:1.5; }
</style></head><body><main>
  <h1>Opening in Maude…</h1>
  <p class="quiet">If nothing happened, use the button below.</p>
  <a class="btn" href="${esc(deepLink)}">Open ${esc(projectId)} in Maude</a>
  <p class="quiet">Don’t have the app yet? <a href="https://maude.sh" style="color:#aab3ff">Download Maude</a>,
  then come back here and press the button again. The link works once and expires after two
  minutes — coming back later just needs another press of “Open in Maude” on the project page.</p>
</main></body></html>`;
}

/** Customer-facing strings for the vocabulary lint. */
export function allHandoffHtml() {
  return launchPage({
    projectId: 'alligators',
    deepLink: 'maude://open/alligators?code=mhc_x&origin=https://cloud.maude.sh',
  });
}
