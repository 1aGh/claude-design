// Control-plane accounts + sessions — Cloud Phase 13.
//
// ONE account (DDR-197 debate: "nobody logs in twice"). Two doors into it:
// email+password here, Google in oauth-google.mjs — both land on the same row.
//
// The rules that carry the security weight:
//
//   1. UNKNOWN ADDRESS BURNS FULL COST. authenticate() derives against a dummy
//      hash when there is no row, so neither the body nor the clock says
//      whether an address exists (same discipline as the hub).
//   2. NO SILENT MERGE. A Google sign-in whose email matches an existing
//      password account links ONLY if that account's address was verified.
//      Otherwise anyone could pre-register victim@gmail.com with a password
//      and capture the victim's Google sign-in — or the reverse.
//   3. SESSIONS ARE ROWS; the cookie value is random and only its SHA-256 is
//      stored. Revocation deletes the row and the session is over — not
//      "over at the next refresh".

import { assertValidPassword, DUMMY_HASH, hashPassword, verifyPassword } from './passwords.mjs';

const SESSION_TTL_MS = 30 * 24 * 3600_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const encoder = new TextEncoder();

async function sha256Hex(value) {
  const d = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

export function normalizeEmail(raw) {
  const email = String(raw ?? '')
    .trim()
    .toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

// ------------------------------------------------------------------ accounts

export async function createAccount(
  db,
  { email, password = null, name = null, googleSub = null, emailVerified = false },
  { now = Date.now() } = {}
) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('that address does not look like an email');
  if (password !== null) assertValidPassword(password);

  const existing = await db
    .prepare('SELECT id FROM accounts WHERE email = ?')
    .bind(normalized)
    .first();
  // A duplicate signup must not say "this address already has an account" to a
  // stranger — but the flow needs to know. Callers translate to a neutral
  // user-facing message; the thrown name is for code, not for the response.
  if (existing) {
    const err = new Error('account-exists');
    err.code = 'account-exists';
    throw err;
  }

  const id = `acct_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await db
    .prepare(
      'INSERT INTO accounts (id, email, name, created_at, password_hash, google_sub, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      id,
      normalized,
      name,
      now,
      password !== null ? await hashPassword(password) : null,
      googleSub,
      emailVerified ? now : null
    )
    .run();
  return { id, email: normalized };
}

export async function getAccountByEmail(db, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return db.prepare('SELECT * FROM accounts WHERE email = ?').bind(normalized).first();
}

/**
 * Email+password authentication. Returns `{ ok, account? , reason? }` with one
 * opaque failure shape — the caller's HTTP response must not distinguish.
 */
export async function authenticate(db, email, password) {
  const row = await getAccountByEmail(db, email);
  if (!row || !row.password_hash) {
    await verifyPassword(typeof password === 'string' ? password : '', DUMMY_HASH);
    return { ok: false, reason: row ? 'no-password-set' : 'unknown-account' };
  }
  if (!(await verifyPassword(password, row.password_hash))) {
    return { ok: false, reason: 'bad-password' };
  }
  return { ok: true, account: { id: row.id, email: row.email, name: row.name } };
}

/**
 * Resolve a Google identity to an account — the NO-SILENT-MERGE rule.
 *
 * Returns `{ action: 'signed-in'|'created'|'refused', account?, reason? }`.
 */
export async function accountForGoogle(
  db,
  { sub, email, emailVerified },
  { now = Date.now() } = {}
) {
  if (!sub) return { action: 'refused', reason: 'no-google-subject' };

  const linked = await db.prepare('SELECT * FROM accounts WHERE google_sub = ?').bind(sub).first();
  if (linked) {
    return { action: 'signed-in', account: { id: linked.id, email: linked.email } };
  }

  // Google-side unverified addresses never link or create — Google itself
  // does not vouch for them.
  if (!emailVerified) return { action: 'refused', reason: 'google-email-unverified' };

  const normalized = normalizeEmail(email);
  if (!normalized) return { action: 'refused', reason: 'bad-email' };

  const byEmail = await db
    .prepare('SELECT * FROM accounts WHERE email = ?')
    .bind(normalized)
    .first();
  if (byEmail) {
    if (!byEmail.email_verified_at && byEmail.password_hash) {
      // The account-takeover primitive from the plan: an unverified password
      // account squatting on this address must not capture the Google user
      // (nor be captured). The password holder proves the address first.
      return { action: 'refused', reason: 'unverified-password-account' };
    }
    await db
      .prepare(
        'UPDATE accounts SET google_sub = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?'
      )
      .bind(sub, now, byEmail.id)
      .run();
    return { action: 'signed-in', account: { id: byEmail.id, email: byEmail.email } };
  }

  const account = await createAccount(
    db,
    { email: normalized, googleSub: sub, emailVerified: true },
    { now }
  );
  return { action: 'created', account };
}

// ------------------------------------------------------------------ sessions

export async function createSession(db, accountId, { now = Date.now() } = {}) {
  const token = randomToken('mcs');
  await db
    .prepare('INSERT INTO sessions (id, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), accountId, now, now + SESSION_TTL_MS)
    .run();
  return { token, expiresAt: now + SESSION_TTL_MS };
}

export async function sessionAccount(db, token, { now = Date.now() } = {}) {
  if (typeof token !== 'string' || !token.startsWith('mcs_')) return null;
  const row = await db
    .prepare(
      'SELECT a.id, a.email, a.name, a.stripe_customer_id, a.disclosure_accepted_at FROM sessions s JOIN accounts a ON a.id = s.account_id ' +
        'WHERE s.id = ? AND s.revoked_at IS NULL AND s.expires_at > ?'
    )
    .bind(await sha256Hex(token), now)
    .first();
  return row ?? null;
}

export async function revokeSession(db, token, { now = Date.now() } = {}) {
  if (typeof token !== 'string') return;
  await db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
    .bind(now, await sha256Hex(token))
    .run();
}

/** Revoke every live session for an account — offboarding that offboards. */
export async function revokeAccountSessions(db, accountId, { now = Date.now() } = {}) {
  await db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL')
    .bind(now, accountId)
    .run();
}
