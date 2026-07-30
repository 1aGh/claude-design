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

import { PAGE_CSS, lockup } from './brand.mjs';
import { allDashboardHtml } from './dashboard.mjs';
import { allPeopleHtml } from './people-page.mjs';

// Styling comes from the design system (brand.mjs), not from ad-hoc CSS.
// These pages are the first thing anyone sees of Maude and were the one
// surface not wearing it.
const BASE_CSS = PAGE_CSS + `
  body { display: grid; place-items: center; min-height: 100vh; padding: var(--space-8) var(--space-5); }
  main { width: 100%; max-width: 26rem; }
  main > :last-child { margin-bottom: 0; }
`;

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Maude Cloud</title><style>${BASE_CSS}</style></head><body><main>${body}</main></body></html>`;
}

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
    <form method="post" action="/auth/signup">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="new-password" minlength="12" required>
      <p class="quiet">At least 12 characters.</p>
      ${DISCLOSURE_HTML}
      <label style="font-weight:400"><input type="checkbox" name="disclosure" value="yes" required>
      I understand what Maude Cloud stores and what it never does.</label>
      <button type="submit">Create account</button>
    </form>
    ${googleEnabled ? `<p><a href="/auth/google">Continue with Google</a></p>` : ''}
    <p class="quiet">Already have an account? <a href="/login">Sign in</a>.</p>`
  );
}

export function loginPage({ googleEnabled = false, error = null } = {}) {
  return page(
    'Sign in',
    `
    <h1>Sign in</h1>
    ${error ? `<p class="error">${error}</p>` : ''}
    <form method="post" action="/auth/login">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Sign in</button>
    </form>
    ${googleEnabled ? `<p><a href="/auth/google">Continue with Google</a></p>` : ''}
    <p class="quiet">New here? <a href="/signup">Create an account</a>.</p>`
  );
}

export function homePage({ account = null } = {}) {
  return page(
    'Maude Cloud',
    account
      ? `<h1>You're signed in</h1>
         <p>${account.email}</p>
         <p class="quiet">Projects arrive in the next update — your account is ready for them.</p>
         <form method="post" action="/auth/logout"><button type="submit">Sign out</button></form>`
      : `${lockup()}
         <h1>A home for your design projects</h1>
         <p class="quiet">Synced, versioned, and always yours to take with you.</p>
         <p><a class="btn" href="/signup">Create an account</a>
            <a href="/login" style="margin-left:var(--space-5)">Sign in</a></p>`
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
    allPeopleHtml(),
    signupPage({ googleEnabled: true }),
    loginPage({ googleEnabled: true, error: 'That email and password don’t match.' }),
    homePage(),
    homePage({ account: { email: 'a@example.com' } }),
    messagePage('Sign-in is not ready', 'Google sign-in is not configured here yet.'),
  ].join('\n');
}
