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

import { removalEffect, ROLES } from './membership.mjs';

const CSS = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font: 16px/1.55 system-ui, sans-serif; max-width: 40rem; margin: 6vh auto; padding: 0 1.25rem 4rem; }
  h1 { font-size: 1.3rem; margin: 0 0 .15rem; }
  .crumb { font-size: .88rem; margin: 0 0 2rem; }
  .quiet { color: color-mix(in srgb, currentColor 62%, transparent); }
  table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
  th { text-align: left; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; padding-bottom: .4rem; }
  td { padding: .6rem 0; border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent); vertical-align: baseline; }
  td.right { text-align: right; }
  form.inline { display: inline; }
  select, input[type=email] { font: inherit; padding: .35rem .4rem; }
  button { font: inherit; padding: .4rem .85rem; cursor: pointer; }
  .card { border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 10px; padding: 1rem 1.1rem; margin-bottom: 1.5rem; }
  .card h2 { font-size: 1rem; margin: 0 0 .5rem; }
  .warn { border-color: color-mix(in srgb, #9a6700 45%, transparent); }
  ul { margin: .4rem 0 0; padding-left: 1.2rem; font-size: .9rem; }
  .error { color: #b00020; font-weight: 600; }
  .ok { color: #1a7f37; font-weight: 600; }
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
export function peoplePage({ project, people = [], isOwner, error = null, notice = null }) {
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
         </p>
       </div>`
    : '';

  return page(
    `People on ${project.name}`,
    `<h1>People on ${esc(project.name)}</h1>
     <p class="crumb"><a href="/">← Your projects</a></p>
     ${error ? `<p class="error">${esc(error)}</p>` : ''}
     ${notice ? `<p class="ok">${esc(notice)}</p>` : ''}
     ${invite}
     <table>
       <thead><tr><th>Person</th><th>What they can do</th><th></th></tr></thead>
       <tbody>${people.map((p) => personRow(p, { projectId: project.id, isOwner })).join('\n')}</tbody>
     </table>
     ${
       isOwner
         ? ''
         : '<p class="quiet">Only the project’s owner can add or remove people.</p>'
     }`
  );
}

/**
 * The confirmation before a removal.
 *
 * Its whole job is to be honest about timing. "Remove" reads as instantaneous;
 * it is not, and the person clicking needs to know that BEFORE they decide,
 * not afterwards from a support reply.
 */
export function removeConfirmPage({ project, person, tokenTtlMs, csrf }) {
  const effect = removalEffect({ tokenTtlMs });
  return page(
    'Remove someone',
    `<h1>Remove ${esc(person.email)}?</h1>
     <p class="crumb"><a href="/projects/${esc(project.id)}/people">← People on ${esc(project.name)}</a></p>
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
  return [
    peoplePage({ project, people, isOwner: true }),
    peoplePage({ project, people, isOwner: false }),
    peoplePage({ project, people, isOwner: true, error: 'That is not an email address.' }),
    peoplePage({ project, people, isOwner: true, notice: 'Invitation sent.' }),
    removeConfirmPage({ project, person: people[1], tokenTtlMs: 12 * 3_600_000 }),
  ].join('\n');
}
