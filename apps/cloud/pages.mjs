// The signup surface — Cloud Phase 13. Server-rendered minimal HTML.
//
// Copy discipline (DDR-193 §5, enforced by pages.test.mjs): these strings are
// read by people who have never used git. No "token", no "repository", no
// "OAuth" — the Google button says "Continue with Google", which is all a
// human needs to know about OAuth.
//
// The DDR-193 §4 disclosure lives INSIDE signup — consent collected where the
// decision happens, not on a page nobody visits. `disclosure_accepted_at` is
// written only when the box was actually ticked.

import { GOOGLE_BUTTON_CSS, googleButton, lockup, PAGE_CSS } from './brand.mjs';
import { allDashboardHtml } from './dashboard.mjs';
import { allHandoffHtml } from './handoff.mjs';
import { allInviteHtml } from './invites.mjs';
import { allPeopleHtml } from './people-page.mjs';

// Styling comes from the design system (brand.mjs), not from ad-hoc CSS.
// These pages are the first thing anyone sees of Maude and were the one
// surface not wearing it.
const BASE_CSS =
  PAGE_CSS +
  GOOGLE_BUTTON_CSS +
  `
  body { display: grid; place-items: center; min-height: 100vh; padding: var(--space-8) var(--space-5); }
  main { width: 100%; max-width: 26rem; }
  main > :last-child { margin-bottom: 0; }
  .cta { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
`;

function page(title, body) {
  // The home page's title IS the product name — suffixing it again would read
  // "Maude Cloud — Maude Cloud" in the tab (Cloud Phase 23 A4).
  const tab = title === 'Maude Cloud' ? title : `${title} — Maude Cloud`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${tab}</title><style>${BASE_CSS}</style></head><body><main>${body}</main></body></html>`;
}

// `googleButton` + its CSS moved to brand.mjs in Cloud Phase 24 (A12b) — the
// invitation's join screen needs the same button, and a second copy is how two
// of them drift. Re-exported so existing importers keep working.
export { googleButton };

/**
 * The bill of materials, said BEFORE anybody reaches a card (Cloud Phase 24 A1).
 *
 * The audit's sharpest finding was that every page is honest and the journey
 * lies: a customer authorizes payment for "a home for your design projects" and
 * then discovers, one door at a time, that they need a desktop computer, an
 * install, and a SECOND paid subscription with Anthropic. The string "Claude"
 * appeared in zero customer-facing cloud pages.
 *
 * It is framed as the reason the work stays private rather than as a caveat,
 * because that is what it actually is — the disclosure's own argument, told
 * forwards. Same block on the landing and in the wizard: the two places
 * somebody decides.
 */
export const BILL_OF_MATERIALS_HTML = `
  <div class="card">
    <strong>What you’ll need</strong>
    <p class="quiet">Maude runs on your own computer — a Mac or a PC, not a phone or a tablet.
    You’ll install the free Maude app, and the AI that draws with you runs on
    <strong>your own Claude subscription</strong> (about €20 a month, paid to Anthropic,
    not to us).</p>
    <p class="quiet" style="margin-bottom:0">That is also why your work stays private: we sync and
    version your project, but it is only ever drawn on your machine.</p>
  </div>`;

export const DISCLOSURE_HTML = `
  <div class="card">
    <strong>What Maude Cloud can and cannot see</strong>
    <p class="quiet">We store and sync your project: your designs, your edit history, and who is
    editing. We never open, run, or render your work on our computers — designs
    are only ever drawn on your own device. You can download everything and
    leave at any time.</p>
  </div>`;

export function signupPage({ googleEnabled = false, error = null } = {}) {
  return page(
    'Create your account',
    `
    <h1>Create your account</h1>
    ${error ? `<p class="error">${error}</p>` : ''}
    ${googleEnabled ? `${googleButton({ wide: true })}<div class="or">or</div>` : ''}
    <form method="post" action="/auth/signup">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="new-password" minlength="12" required>
      <p class="quiet">At least 12 characters.</p>
      ${DISCLOSURE_HTML}
      <label style="font-weight:400"><input type="checkbox" name="disclosure" value="yes" required>
      I understand what Maude Cloud stores and what it never does.</label>
      <p class="quiet">Creating an account means you accept the
        <a href="https://maude.sh/terms">Terms</a> and the
        <a href="https://maude.sh/privacy">Privacy notice</a>.</p>
      <button type="submit">Create account</button>
    </form>
    <p class="quiet">Already have an account? <a href="/login">Sign in</a>.</p>`
  );
}

export function loginPage({ googleEnabled = false, error = null, next = null } = {}) {
  // `next` carries the page that sent them here (an invite, mostly), so
  // signing in lands them back where they were going — not on a dashboard
  // they then have to leave to re-find the email (Cloud Phase 23 A5).
  const action = next ? `/auth/login?next=${encodeURIComponent(next)}` : '/auth/login';
  return page(
    'Sign in',
    `
    <h1>Sign in</h1>
    ${error ? `<p class="error">${error}</p>` : ''}
    ${googleEnabled ? `${googleButton({ next, wide: true })}<div class="or">or</div>` : ''}
    <form method="post" action="${action}">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Sign in</button>
    </form>
    <p class="quiet">New here? <a href="/signup">Create an account</a>.</p>`
  );
}

export function homePage({ account = null, googleEnabled = false } = {}) {
  // Google both creates the account and signs in (accountForGoogle), so on
  // the landing page it earns a first-class button — one click instead of
  // signup page → buried link (owner feedback 2026-07-30).
  return page(
    'Maude Cloud',
    account
      ? `<h1>You're signed in</h1>
         <p>${account.email}</p>
         <p><a class="btn" href="/">Your projects</a></p>
         <form method="post" action="/auth/logout"><button type="submit">Sign out</button></form>`
      : `${lockup()}
         <h1>A home for your design projects</h1>
         <p class="quiet">Synced, versioned, and always yours to take with you.</p>
         <div class="cta">
           ${googleEnabled ? googleButton() : ''}
           <a class="btn" href="/signup">Create an account</a>
         </div>
         <p class="quiet">Already have an account? <a href="/login">Sign in</a>.</p>
         ${BILL_OF_MATERIALS_HTML}`
  );
}

export function messagePage(title, text) {
  return page(title, `<h1>${title}</h1><p>${text}</p><p><a href="/">Back</a></p>`);
}

/**
 * Every customer-facing string, for the vocabulary lint.
 *
 * The dashboard is included HERE rather than lint-tested only in its own file:
 * a surface that has to opt IN to the copy discipline is a surface that
 * eventually does not.
 */
export function allCustomerFacingHtml() {
  return [
    allDashboardHtml(),
    allHandoffHtml(),
    allInviteHtml(),
    allPeopleHtml(),
    signupPage({ googleEnabled: true }),
    loginPage({ googleEnabled: true, error: 'That email and password don’t match.' }),
    homePage(),
    homePage({ googleEnabled: true }),
    homePage({ account: { email: 'a@example.com' } }),
    messagePage('Sign-in is not ready', 'Google sign-in is not configured here yet.'),
  ].join('\n');
}
