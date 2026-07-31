// Stripe webhook signature verification — Cloud Phase 12.
//
// Decision layer (DDR-196 §1): pure functions over (payload, header, secret,
// clock). The Worker calls this; it never grows its own crypto inline.
//
// Scheme (Stripe "v1"): header `t=<unix>,v1=<hex>,...`; signed payload is
// `${t}.${rawBody}`; signature is HMAC-SHA-256. Two rules:
//
//   1. TIMESTAMP TOLERANCE IS PART OF THE CHECK. A valid signature on an old
//      payload is a replay, not a webhook.
//   2. CONSTANT-TIME COMPARISON. A hex comparison that bails at the first
//      wrong nibble hands out a timing oracle on the one secret that lets an
//      attacker mint billing events.
//
// WebCrypto only (crypto.subtle) — this runs inside a Cloudflare Worker where
// node:crypto is not a given. Node ≥20 exposes the same global for tests.

const encoder = new TextEncoder();

/** Parse Stripe's Signature header. Returns null on any malformed shape. */
export function parseSignatureHeader(header) {
  if (typeof header !== 'string' || header.length === 0 || header.length > 4096) return null;
  let timestamp = null;
  const v1 = [];
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) return null;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') {
      if (!/^\d{1,12}$/.test(value)) return null;
      timestamp = Number(value);
    } else if (key === 'v1') {
      if (!/^[0-9a-f]{64}$/.test(value)) return null;
      v1.push(value);
    }
    // other keys (v0…) are ignored, per Stripe's own guidance
  }
  if (timestamp === null || v1.length === 0) return null;
  return { timestamp, signatures: v1 };
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time equality over equal-length hex strings. */
function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a Stripe webhook. Returns `{ ok: true }` or `{ ok: false, reason }`.
 *
 * `reason` is for LOGS — the HTTP response to a failed verification is a bare
 * 400 either way, so the response never says which part failed.
 */
export async function verifyStripeSignature(
  rawBody,
  header,
  secret,
  { now = Date.now(), toleranceSeconds = 300 } = {}
) {
  if (!secret) return { ok: false, reason: 'no-signing-secret-configured' };
  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: 'malformed-signature-header' };

  const ageSeconds = Math.abs(now / 1000 - parsed.timestamp);
  if (ageSeconds > toleranceSeconds) return { ok: false, reason: 'timestamp-outside-tolerance' };

  const expected = await hmacHex(secret, `${parsed.timestamp}.${rawBody}`);
  for (const candidate of parsed.signatures) {
    if (timingSafeEqualHex(candidate, expected)) return { ok: true };
  }
  return { ok: false, reason: 'signature-mismatch' };
}

/**
 * What a verified webhook is allowed to DO: name a project to reconcile.
 *
 * The webhook never carries an instruction (DDR-196) — this extracts the
 * project id (or the subscription id to look it up by) and nothing else.
 * Unhandled event types return null and are 200-acked; Stripe retries only
 * failures, and an event we don't act on is not a failure.
 */
export function projectRefFromEvent(event) {
  const type = event?.type ?? '';
  const object = event?.data?.object ?? {};
  if (type === 'checkout.session.completed') {
    const projectId = object?.metadata?.project_id;
    return projectId ? { projectId, reason: 'webhook' } : null;
  }
  if (type.startsWith('customer.subscription.') || type.startsWith('invoice.')) {
    const subscriptionId =
      typeof object.subscription === 'string' ? object.subscription : object.id;
    return subscriptionId ? { subscriptionId, reason: 'webhook' } : null;
  }
  return null;
}
