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

import { lockup, PAGE_CSS } from './brand.mjs';
import { allDashboardHtml } from './dashboard.mjs';
import { allHandoffHtml } from './handoff.mjs';
import { allPeopleHtml } from './people-page.mjs';

// Styling comes from the design system (brand.mjs), not from ad-hoc CSS.
// These pages are the first thing anyone sees of Maude and were the one
// surface not wearing it.
const BASE_CSS =
  PAGE_CSS +
  `
  body { display: grid; place-items: center; min-height: 100vh; padding: var(--space-8) var(--space-5); }
  main { width: 100%; max-width: 26rem; }
  main > :last-child { margin-bottom: 0; }
  .btn-google {
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    background: var(--bg-2); color: var(--fg-0); border: 1px solid var(--border-subtle);
  }
  .btn-google:hover { background: var(--bg-3); color: var(--fg-0); }
  .btn-google:active { background: var(--bg-3); }
  .btn-google svg { flex: none; }
  .btn-google.wide { display: flex; width: 100%; }
  .or {
    display: flex; align-items: center; gap: var(--space-4);
    color: var(--fg-3); font-size: var(--type-sm);
    text-transform: uppercase; letter-spacing: 0.08em;
    margin: var(--space-5) 0;
  }
  .or::before, .or::after { content: ""; flex: 1; border-top: 1px solid var(--border-subtle); }
  .cta { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
`;

function page(title, body) {
  // The home page's title IS the product name — suffixing it again would read
  // "Maude Cloud — Maude Cloud" in the tab (Cloud Phase 23 A4).
  const tab = title === 'Maude Cloud' ? title : `${title} — Maude Cloud`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${tab}</title><style>${BASE_CSS}</style></head><body><main>${body}</main></body></html>`;
}

// The official multicolor "G" — inline so the page stays a single request and
// works under the strict CSP. Google's brand rules allow the standard G on a
// neutral button; the button chrome itself wears our tokens.
const GOOGLE_G = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C40.7 35.7 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>`;

export function googleButton({ next = null, wide = false } = {}) {
  const href = next ? `/auth/google?next=${encodeURIComponent(next)}` : '/auth/google';
  return `<a class="btn btn-google${wide ? ' wide' : ''}" href="${href}">${GOOGLE_G} Continue with Google</a>`;
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
         <p class="quiet">Already have an account? <a href="/login">Sign in</a>.</p>`
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
    allPeopleHtml(),
    signupPage({ googleEnabled: true }),
    loginPage({ googleEnabled: true, error: 'That email and password don’t match.' }),
    homePage(),
    homePage({ googleEnabled: true }),
    homePage({ account: { email: 'a@example.com' } }),
    messagePage('Sign-in is not ready', 'Google sign-in is not configured here yet.'),
  ].join('\n');
}
