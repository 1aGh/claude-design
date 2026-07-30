// Who is on a project — Cloud Phase 22 Task 5 (DDR-204).
//
// The panel where somebody adds a teammate and, more consequentially, removes
// one. Removal is the reason this page needs care: it looks instantaneous and
// is not, because a project token is verified offline so that a control-plane
// outage cannot lock anyone out of their own work (DDR-204). An admin who
// believes "removed" means "out right now" makes a decision they would not
// otherwise make, so the page says how long it actually takes, in hours.
//
// Server-rendered, no script — same reason as the dashboard. This is a page
// people open when something is wrong, including "the wrong person has
// access".

import { appShell } from './brand.mjs';
import { STATE_COPY } from './dashboard.mjs';
import { ROLES, removalEffect } from './membership.mjs';

// Styling comes from the design system shell (brand.mjs); only what this page
// adds lives here. The table wears the same one-material card the admin
// surfaces use.
const CSS = `
  table { width: 100%; border-collapse: collapse; margin-bottom: var(--space-6); background: var(--bg-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
  th { text-align: left; font-family: var(--font-mono); font-size: var(--type-xs); text-transform: uppercase; letter-spacing: .06em; color: var(--fg-2); padding: var(--space-3) var(--space-5); border-bottom: 1px solid var(--border-subtle); }
  td { padding: var(--space-4) var(--space-5); border-top: 1px solid var(--border-subtle); vertical-align: baseline; font-size: var(--type-base); }
  tr:first-child td { border-top: 0; }
  td.right { text-align: right; white-space: nowrap; }
  form.inline { display: inline; }
  select, input[type=email] { width: auto; }
  td .inline button {
    background: var(--bg-2); color: var(--fg-1); border-color: var(--border-default);
  }
  td .inline button:hover { background: var(--bg-3); color: var(--fg-0); }
  .card h2 { margin: 0 0 var(--space-3); }
  .card { margin-bottom: var(--space-6); }
  .warn { border-color: color-mix(in oklab, var(--status-warn) 45%, transparent); }
  ul { margin: var(--space-2) 0 0; padding-left: var(--space-6); font-size: var(--type-base); line-height: var(--lh-base); }
`;

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function page(title, body, { account, project, isOwner, lede = null } = {}) {
  const copy = project ? (STATE_COPY[project.state] ?? null) : null;
  return appShell({
    account,
    title,
    body,
    project,
    isOwner,
    active: 'people',
    lede,
    pill: copy ? { tone: copy.tone, label: copy.label } : null,
    extraCss: CSS,
  });
}

/** Roles a person can be given here. `owner` is a transfer, not a role change. */
const ASSIGNABLE = ROLES.filter((r) => r !== 'owner');

const ROLE_MEANING = {
  viewer: 'Can look and comment. Cannot change anything.',
  member: 'Can design, edit and comment.',
  owner: 'Everything, plus billing, people and deleting the project.',
};

function roleSelect(name, current) {
  return `<select name="${name}">${ASSIGNABLE.map(
    (r) => `<option value="${r}"${r === current ? ' selected' : ''}>${r}</option>`
  ).join('')}</select>`;
}

function personRow(person, { projectId, isOwner }) {
  const label = `${esc(person.email)}${person.role === 'owner' ? ' <span class="quiet">(owner)</span>' : ''}`;
  if (person.role === 'owner') {
    // No controls at all, rather than disabled ones. A disabled button invites
    // somebody to hunt for the way to enable it.
    return `<tr><td>${label}</td><td class="quiet">${esc(ROLE_MEANING.owner)}</td><td></td></tr>`;
  }
  const controls = isOwner
    ? `<form class="inline" method="post" action="/projects/${esc(projectId)}/people">
         <input type="hidden" name="account" value="${esc(person.account_id)}">
         ${roleSelect('role', person.role)}
         <button type="submit" name="do" value="role">Save</button>
       </form>
       <form class="inline" method="get" action="/projects/${esc(projectId)}/people/remove">
         <input type="hidden" name="account" value="${esc(person.account_id)}">
         <button type="submit">Remove…</button>
       </form>`
    : '';
  return `<tr><td>${label}</td><td class="quiet">${esc(ROLE_MEANING[person.role] ?? person.role)}</td><td class="right">${controls}</td></tr>`;
}

/**
 * The people panel.
 *
 * @param {object} args
 * @param {{id: string, name: string}} args.project
 * @param {{account_id: string, email: string, role: string}[]} args.people
 * @param {boolean} args.isOwner
 */
export function peoplePage({
  account,
  project,
  people = [],
  isOwner,
  error = null,
  notice = null,
}) {
  const invite = isOwner
    ? `<div class="card">
         <h2>Add someone</h2>
         <form method="post" action="/projects/${esc(project.id)}/people">
           <input type="email" name="email" placeholder="their email" required>
           ${roleSelect('role', 'member')}
           <button type="submit" name="do" value="invite">Send invitation</button>
         </form>
         <p class="quiet" style="font-size:.87rem;margin:.6rem 0 0">
           They get an email with a link. If they do not have a Maude account yet,
           the link makes one — they never have to find this project themselves.
           Getting into the workspace itself still uses the workspace's own
           sign-in for now; this invitation covers everything on this dashboard.
         </p>
       </div>`
    : '';

  return page(
    'People',
    `${error ? `<p class="error">${esc(error)}</p>` : ''}
     ${notice ? `<p class="ok">${esc(notice)}</p>` : ''}
     ${invite}
     <table>
       <thead><tr><th>Person</th><th>What they can do</th><th></th></tr></thead>
       <tbody>${people.map((p) => personRow(p, { projectId: project.id, isOwner })).join('\n')}</tbody>
     </table>
     ${isOwner ? '' : '<p class="quiet">Only the project’s owner can add or remove people.</p>'}`,
    {
      account,
      project,
      isOwner,
      lede: `Who is on ${project.name}, and what each person can do.`,
    }
  );
}

/**
 * The confirmation before a removal.
 *
 * Its whole job is to be honest about timing. "Remove" reads as instantaneous;
 * it is not, and the person clicking needs to know that BEFORE they decide,
 * not afterwards from a support reply.
 */
export function removeConfirmPage({ account, project, person, tokenTtlMs, csrf }) {
  const effect = removalEffect({ tokenTtlMs });
  return page(
    `Remove ${person.email}?`,
    `<p class="quiet" style="margin:0 0 var(--space-5)"><a href="/projects/${esc(project.id)}/people">← Back to People</a></p>
     <div class="card warn">
       <ul>
         <li>${esc(effect.immediate[0])}</li>
         <li>${esc(effect.delayed)}</li>
       </ul>
       <p class="quiet" style="font-size:.9rem;margin:.8rem 0 0">${esc(effect.ifUrgent)}</p>
     </div>
     <form method="post" action="/projects/${esc(project.id)}/people">
       <input type="hidden" name="account" value="${esc(person.account_id)}">
       ${csrf ? `<input type="hidden" name="csrf" value="${esc(csrf)}">` : ''}
       <button type="submit" name="do" value="remove">Remove them</button>
       <a href="/projects/${esc(project.id)}/people" style="margin-left:1rem">Cancel</a>
     </form>`
  );
}

/** Every customer-facing string here, for the vocabulary lint. */
export function allPeopleHtml() {
  const project = { id: 'alligators', name: 'Brno Alligators' };
  const people = [
    { account_id: 'a1', email: 'owner@example.com', role: 'owner' },
    { account_id: 'a2', email: 'member@example.com', role: 'member' },
    { account_id: 'a3', email: 'viewer@example.com', role: 'viewer' },
  ];
  const account = { email: 'owner@example.com' };
  return [
    peoplePage({ account, project, people, isOwner: true }),
    peoplePage({ account, project, people, isOwner: false }),
    peoplePage({ account, project, people, isOwner: true, error: 'That is not an email address.' }),
    peoplePage({ account, project, people, isOwner: true, notice: 'Invitation sent.' }),
    removeConfirmPage({ account, project, person: people[1], tokenTtlMs: 12 * 3_600_000 }),
  ].join('\n');
}
