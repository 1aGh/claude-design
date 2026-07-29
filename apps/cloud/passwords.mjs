// Control-plane password hashing — Cloud Phase 13.
//
// DELIBERATE DIVERGENCE from apps/hub/src/users.mjs (scrypt via node:crypto):
// this code runs inside a Cloudflare Worker, where node:crypto's scrypt is a
// compat-flag gamble and WebCrypto is the native primitive. PBKDF2-SHA256 at
// OWASP's current iteration floor is the sanctioned WebCrypto alternative —
// portable to Node ≥20 unchanged, which is what the tests run on.
//
// The API SHAPE mirrors the hub's on purpose (same self-describing format
// idea, same "unknown user burns full cost" discipline in accounts.mjs), so a
// future consolidation is a mapping, not a rewrite.
//
// Format: `pbkdf2$<iterations>$<saltHex>$<hashHex>` — self-describing so the
// iteration count can rise without invalidating stored hashes.

// OWASP's 2023+ floor for PBKDF2-HMAC-SHA256 is 600k iterations. Workers'
// WebCrypto REFUSES any single call above 100k:
//
//   NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
//   supported (requested 600000).
//
// Found by deploying and running a real signup, not by reading a doc. Lowering
// the work factor to fit the cap was the tempting move and the wrong one — it
// weakens every password in the system to suit an API limit.
//
// Instead the work is CHAINED: six rounds of 100k, each round's output
// becoming the next round's input keying material. Total work is identical to
// 600k sequential iterations (the rounds cannot be parallelised — round n+1
// needs round n's output), so the cost to an attacker is unchanged while every
// individual call stays inside the platform's cap.
const ROUND_ITERATIONS = 100_000;
const ROUNDS = 6;
const ITERATIONS = ROUND_ITERATIONS * ROUNDS; // 600k effective — the stored label
const KEYLEN_BITS = 256;
const SALT_BYTES = 16;

const encoder = new TextEncoder();

function toHex(buf) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function deriveOnce(material, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      key,
      KEYLEN_BITS
    )
  );
}

/**
 * Derive `iterations` worth of work as a CHAIN of calls no larger than the
 * platform cap. Sequential by construction: an attacker cannot skip a round.
 */
async function derive(password, salt, iterations) {
  let rounds = Math.ceil(iterations / ROUND_ITERATIONS);
  const per = Math.min(iterations, ROUND_ITERATIONS);
  let material = encoder.encode(String(password ?? ''));
  let done = 0;
  while (rounds-- > 0) {
    const step = Math.min(per, iterations - done);
    if (step <= 0) break;
    material = await deriveOnce(material, salt, step);
    done += step;
  }
  return toHex(material);
}

export function assertValidPassword(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('password must be at least 12 characters');
  }
  if (password.length > 512) throw new Error('password is too long');
}

export async function hashPassword(password) {
  assertValidPassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${hash}`;
}

/** Constant-time compare over the derived hex. */
function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10_000_000) return false;
  const derived = await derive(
    typeof password === 'string' ? password : '',
    fromHex(parts[2]),
    iterations
  );
  return timingSafeEqualHex(derived, parts[3]);
}

/**
 * A dummy hash to burn full verification cost on an unknown account, so the
 * response clock never says whether an address exists (same discipline as the
 * hub's DUMMY_HASH).
 */
export const DUMMY_HASH = `pbkdf2$${ITERATIONS}$${'0'.repeat(SALT_BYTES * 2)}$${'0'.repeat(64)}`;
