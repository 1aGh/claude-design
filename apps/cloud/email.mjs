// Sending email — Cloud Phase 22, the invite's missing half.
//
// An invitation that only writes a row is a message nobody receives. This
// module is the ONE place the control plane talks to the email provider
// (Resend), so "which address do we send from" and "what happens when sending
// fails" are each decided exactly once.
//
// Posture:
//   - Content is built by pure functions (testable, vocabulary-lintable).
//   - `sendEmail` NEVER throws. An invitation whose email bounced is still an
//     invitation — the caller decides what to tell the person on screen, and a
//     provider outage must not turn into a 500 on a form submit.
//   - The API key is read at call time from env, never captured or logged.

/** Is sending configured at all? Absent key = local dev / tests. */
export function emailConfigured(env) {
  return Boolean(env?.RESEND_API_KEY);
}

/**
 * The sender. `EMAIL_FROM` overrides for the (temporary) Resend testing
 * domain; once maude.sh is verified at Resend this default takes over.
 */
export function fromAddress(env) {
  return env?.EMAIL_FROM || 'Maude Cloud <cloud@maude.sh>';
}

/**
 * The invitation email, plain text.
 *
 * Plain text deliberately: an invite from a person reads like mail, not like
 * marketing, and text-only mail with one link has the best odds with both
 * spam filters and skeptical recipients. The link is the whole payload.
 */
export function inviteEmail({ projectName, role, inviteUrl, invitedBy }) {
  const doing =
    role === 'viewer'
      ? 'look at the work and leave comments'
      : 'design and edit alongside them';
  return {
    subject: `${invitedBy} invited you to ${projectName}`,
    text: [
      `${invitedBy} invited you to the project “${projectName}” on Maude Cloud,`,
      `where you can ${doing}.`,
      '',
      'Accept the invitation here:',
      '',
      `  ${inviteUrl}`,
      '',
      'The link is yours alone and stops working after 14 days.',
      'If you were not expecting this, you can simply ignore it —',
      'nothing has been created in your name.',
    ].join('\n'),
  };
}

/**
 * Send one email through Resend. Resolves `{ ok, id?, error? }`; never throws.
 */
export async function sendEmail(env, { to, subject, text }, { fetchImpl = fetch } = {}) {
  if (!emailConfigured(env)) return { ok: false, error: 'email is not configured' };
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress(env), to: [to], subject, text }),
    });
    if (!res.ok) {
      // The provider's reason goes to logs; callers get a boolean. Nothing in
      // a Resend error body belongs in front of a customer.
      const detail = await res.text().catch(() => '');
      console.warn(`[email] send to ${to} failed: ${res.status} ${detail.slice(0, 200)}`);
      return { ok: false, error: `send failed (${res.status})` };
    }
    const body = await res.json().catch(() => ({}));
    return { ok: true, id: body?.id ?? null };
  } catch (err) {
    console.warn(`[email] send to ${to} failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}
