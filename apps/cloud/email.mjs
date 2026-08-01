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
    role === 'viewer' ? 'look at the work and leave comments' : 'design and edit alongside them';
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
 * `1753...` ms → `28 August 2026`. The same format the billing pages use; a
 * date that reads one way on screen and another in the inbox is a date nobody
 * trusts.
 */
function day(ms) {
  return new Date(Number(ms)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * "Your project has paused, and here is your copy" — Cloud Phase 24 B3/A11.
 *
 * THE EXPORT GUARANTEE'S ACTUAL DELIVERY. DDR-193 §3 says an export always
 * goes out before any teardown, and until this phase the reconciler computed
 * that intent and sent nothing. This is the email; it carries both halves,
 * because a pause notice with no copy attached is the notice people ignore.
 */
export function projectPausedEmail({ projectName, downloadUrl, deletesAt }) {
  return {
    subject: `${projectName} has paused`,
    text: [
      `Your subscription ended, so “${projectName}” is paused.`,
      'Nothing has been deleted.',
      '',
      `A complete copy of your work has been prepared and is waiting here:`,
      '',
      `  ${downloadUrl}`,
      '',
      `On ${day(deletesAt)} the project is deleted from our computers.`,
      'Restart it before then and everything comes back exactly as it was —',
      'same address, same people, nothing lost.',
      '',
      'The copy you download stays yours, whatever you decide.',
    ].join('\n'),
  };
}

/** The last-chance notice, two days out (canvas board E0, email 2). */
export function deletionWarningEmail({ projectName, downloadUrl, deletesAt }) {
  return {
    subject: `Two days left to keep ${projectName}`,
    text: [
      `“${projectName}” will be deleted on ${day(deletesAt)}.`,
      '',
      'If you want a copy, this is the moment — it takes a minute and it is',
      'yours to keep afterwards:',
      '',
      `  ${downloadUrl}`,
      '',
      'Restarting the subscription before that date keeps everything instead.',
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
