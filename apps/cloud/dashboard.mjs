// The one place — Cloud Phase 22 Task 4 (DDR-204).
//
// Before this, a customer with three projects signed in four times: once to
// the platform and once to each project's own admin, because a project is a
// hub and a hub was originally something one person self-hosted. This is the
// page that makes that history invisible.
//
// It is a CONTROL surface. It shows what you have, what it costs, and what
// state it is in — and hands you into a project rather than asking you to
// find it. Per-project detail is fetched from the project itself; the person
// never types a second address and never learns that a "cell" exists.
//
// Server-rendered, no script. The dashboard is where somebody goes when
// something is wrong, and a page that needs JavaScript to tell you your
// project is paused is a page that cannot tell you anything when it is broken.

import { PAGE_CSS, lockup } from './brand.mjs';

// Styling comes from the design system (brand.mjs). What is left here is only
// what this page adds on top of the shared chrome.
const CSS = PAGE_CSS + `
  .who { color: var(--fg-2); font-size: var(--type-base); margin: 0 0 var(--space-7); }
  .project {
    background: var(--bg-1);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-6);
    margin-bottom: var(--space-4);
    box-shadow: var(--shadow-sm);
    transition: border-color var(--dur-soft) var(--ease-out);
  }
  .project:hover { border-color: var(--border-default); }
  .project h2 { margin: 0 0 var(--space-1); }
  .row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-5); flex-wrap: wrap; }
  .state {
    font-size: var(--type-xs); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    padding: var(--space-1) var(--space-3); border-radius: var(--radius-pill);
    border: 1px solid transparent;
  }
  .state.ok   { color: var(--status-success); border-color: color-mix(in oklab, var(--status-success) 32%, transparent); }
  .state.warn { color: var(--status-warn);    border-color: color-mix(in oklab, var(--status-warn) 32%, transparent); }
  .state.stop { color: var(--status-error);   border-color: color-mix(in oklab, var(--status-error) 32%, transparent); }
  .note { color: var(--fg-2); font-size: var(--type-base); line-height: var(--lh-base); margin: var(--space-3) 0 0; }
  .actions { margin-top: var(--space-4); display: flex; gap: var(--space-5); flex-wrap: wrap; font-size: var(--type-base); }
  .empty {
    border: 1px dashed var(--border-default); border-radius: var(--radius-lg);
    padding: var(--space-8) var(--space-6); text-align: center; background: var(--bg-1);
  }
`;

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} — Maude</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

/**
 * What a project's state means to the person who owns it.
 *
 * Our state names are ours. `past_due` is an accounting word, `suspended`
 * sounds like a punishment, and `pending` tells somebody nothing about whether
 * to wait or to worry. Each one gets a sentence that says what is true and
 * what, if anything, they should do.
 */
export const STATE_COPY = {
  pending: {
    tone: 'warn',
    label: 'Setting up',
    note: 'This usually takes a minute or two. We will email you when it is ready.',
  },
  active: { tone: 'ok', label: 'Ready', note: null },
  past_due: {
    tone: 'warn',
    label: 'Payment did not go through',
    note: 'Your work is safe and the project keeps running. Update your card to avoid it pausing.',
  },
  suspended: {
    tone: 'stop',
    label: 'Paused',
    note: 'Nothing has been deleted. Restart it, or download everything and keep it.',
  },
  exported: {
    tone: 'warn',
    label: 'Downloaded, ready to delete',
    note: 'You have a full copy. Deleting is permanent from here.',
  },
  purged: {
    tone: 'stop',
    label: 'Deleted',
    note: 'This project was deleted. If you downloaded it, that copy is still yours.',
  },
};

/**
 * One project card.
 *
 * Actions are filtered by what this person may actually do — a menu that shows
 * everything and then refuses is worse than a shorter menu, because it teaches
 * people that the interface lies.
 */
function projectCard(project, { can }) {
  const copy = STATE_COPY[project.state] ?? { tone: 'warn', label: project.state, note: null };
  const actions = [];
  if (project.state !== 'purged') {
    actions.push(`<a href="https://${esc(project.id)}.cloud.maude.sh">Open</a>`);
  }
  if (can('share')) actions.push(`<a href="/projects/${esc(project.id)}/share">Sharing</a>`);
  if (can('invite')) actions.push(`<a href="/projects/${esc(project.id)}/people">People</a>`);
  if (can('billing')) actions.push(`<a href="/projects/${esc(project.id)}/billing">Billing</a>`);
  if (can('mirror')) actions.push(`<a href="/projects/${esc(project.id)}/mirror">GitHub copy</a>`);
  actions.push(`<a href="/projects/${esc(project.id)}/audit">Activity</a>`);
  // Always offered, in every state, including states where somebody is
  // deciding whether to leave. An export you can only reach while everything
  // is fine is not a guarantee.
  actions.push(`<a href="/projects/${esc(project.id)}/download">Download everything</a>`);
  if (can('delete') && project.state !== 'purged') {
    actions.push(`<a href="/projects/${esc(project.id)}/delete">Delete…</a>`);
  }

  return `<div class="project">
    <div class="row">
      <h2>${esc(project.name || project.id)}</h2>
      <span class="state ${copy.tone}">${esc(copy.label)}</span>
    </div>
    ${copy.note ? `<p class="note">${esc(copy.note)}</p>` : ''}
    <div class="actions">${actions.join('\n')}</div>
  </div>`;
}

/**
 * The dashboard.
 *
 * @param {object} args
 * @param {{email: string}} args.account
 * @param {object[]} args.projects  each with `role`, so actions can be filtered
 * @param {(role: string, capability: string) => boolean} args.can
 */
export function dashboardPage({ account, projects = [], can }) {
  const body =
    projects.length === 0
      ? `<div class="empty">
           <p><strong>No projects yet.</strong></p>
           <p class="note">A project is one design system and the work around it.
             You can invite people to it once it exists.</p>
           <form method="get" action="/projects/new"><button type="submit">Start a project</button></form>
         </div>`
      : projects
          .map((p) => projectCard(p, { can: (capability) => can(p.role, capability) }))
          .join('\n');

  return page(
    'Your projects',
    `${lockup()}
     <h1>Your projects</h1>
     <p class="who">${esc(account.email)} · <a href="/account">Account</a></p>
     ${body}
     <footer>
       Everything here is yours to take. Every project can be downloaded in full,
       at any time, including after you stop paying for it.
       <form method="post" action="/auth/logout" style="margin-top:1rem"><button type="submit">Sign out</button></form>
     </footer>`
  );
}

/** Every customer-facing string on this surface, for the vocabulary lint. */
export function allDashboardHtml() {
  const can = () => true;
  const projects = Object.keys(STATE_COPY).map((state, i) => ({
    id: `p${i}`,
    name: `Project ${i}`,
    state,
    role: 'owner',
  }));
  return [
    dashboardPage({ account: { email: 'a@example.com' }, projects: [], can }),
    dashboardPage({ account: { email: 'a@example.com' }, projects, can }),
  ].join('\n');
}
