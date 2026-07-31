// Running your own project — Cloud Phase 20 (+ the Phase 19 settings half).
//
// Four surfaces, one rule: a customer runs their whole relationship — the
// full copy, deletion, the record of who did what, and where the work mirrors
// to — with no email to support and no terminal.
//
//   /projects/<id>/download   the take-your-work-home copy (DDR-202). Offered
//                             in EVERY state; the delete flow depends on it.
//   /projects/<id>/delete     the only path to `purged`, and it goes THROUGH
//                             a completed export (DDR-193 §3) — a delete
//                             button with no copy behind it is a promise the
//                             product cannot keep.
//   /projects/<id>/audit      the customer-visible record (DDR-193 §4 — "you
//                             can see that we looked" is the control).
//   /projects/<id>/mirror     where the history pushes to on GitHub (Phase 19
//                             T3). Config lives HERE; the cell asks for it on
//                             every tick, so saving needs no restart.

import { appShell } from './brand.mjs';
import { mintProjectToken } from './cell-token.mjs';
import { STATE_COPY } from './dashboard.mjs';
import { audit } from './db.mjs';
import { validateTarget } from './mirror.mjs';
import { ACCESS_MESSAGES, can, decideAccess } from './project-access.mjs';
import { removeCellDomain } from './provision.mjs';

const CSS = `
  table { width: 100%; border-collapse: collapse; margin: var(--space-4) 0 var(--space-6); background: var(--bg-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
  table { border-spacing: 0; overflow: hidden; }
  th { text-align: left; font-family: var(--font-mono); font-size: var(--type-xs); text-transform: uppercase; letter-spacing: .06em; color: var(--fg-2); padding: var(--space-3) var(--space-5); border-bottom: 1px solid var(--border-subtle); }
  td { padding: var(--space-3) var(--space-5); border-top: 1px solid var(--border-subtle); vertical-align: baseline; font-size: var(--type-base); }
  tr:first-child td { border-top: 0; }
  td.right { text-align: right; white-space: nowrap; }
  .mono { font-family: var(--font-mono); font-size: var(--type-sm); }
  .card { margin-bottom: var(--space-5); }
  .danger { border-color: color-mix(in oklab, var(--status-error) 40%, transparent); }
  .danger h2 { color: var(--status-error); }
  time { color: var(--fg-2); font-size: var(--type-sm); }
`;

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/**
 * Wrap one project surface in the admin shell: project nav on the left, the
 * project's state pill next to the title — the person always knows where they
 * are and what state the thing they're managing is in.
 */
function page(title, body, { account, project, isOwner, active, lede = null } = {}) {
  const copy = project ? (STATE_COPY[project.state] ?? null) : null;
  return appShell({
    account,
    title,
    body,
    project,
    isOwner,
    active,
    lede,
    pill: copy ? { tone: copy.tone, label: copy.label } : null,
    extraCss: CSS,
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
      'referrer-policy': 'no-referrer',
    },
  });
}

function redirect(to) {
  return new Response(null, { status: 303, headers: { location: to } });
}

function when(ms) {
  return `${new Date(Number(ms)).toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

/** `tenants/<id>/exports/<stamp>/<name>` → { stamp, name }, or null. */
export function parseExportKey(key, projectId) {
  const m = String(key).match(
    new RegExp(`^tenants/${projectId}/exports/(\\d{8}T\\d{6}Z)/([A-Za-z0-9._-]+)$`)
  );
  return m ? { stamp: m[1], name: m[2] } : null;
}

// ------------------------------------------------------------------ download

export function downloadPage({
  account,
  project,
  generations,
  isOwner,
  error = null,
  notice = null,
}) {
  const rows = generations
    .map(
      (g) => `<tr>
        <td class="mono">${esc(g.stamp)}</td>
        <td>${g.files
          .map(
            (f) =>
              `<a href="/projects/${esc(project.id)}/download/file?g=${encodeURIComponent(g.stamp)}&amp;f=${encodeURIComponent(f.name)}">${esc(f.name)}</a>`
          )
          .join(' · ')}</td>
        <td class="right">${(g.bytes / 1_000_000).toFixed(1)} MB</td>
      </tr>`
    )
    .join('\n');
  return page(
    'Download everything',
    `${error ? `<p class="error">${esc(error)}</p>` : ''}
     ${notice ? `<p class="ok">${esc(notice)}</p>` : ''}
     ${
       isOwner
         ? `<form method="post" action="/projects/${esc(project.id)}/download">
              <button type="submit">Prepare a fresh copy</button>
              <span class="quiet" style="margin-left:var(--space-4)">takes a moment for large projects</span>
            </form>`
         : '<p class="quiet">Only the project’s owner can prepare and download the full copy.</p>'
}
     ${
       generations.length
         ? `<table><thead><tr><th>Taken</th><th>Files</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
         : '<p class="quiet" style="margin-top:var(--space-5)">No copy has been prepared yet.</p>'
}`,
    {
      account,
      project,
      isOwner,
      active: 'download',
      lede: `A complete copy of ${project.name}: the full history as a standard git bundle, plus a list of every media file. It opens without Maude, and taking it changes nothing here.`,
    }
  );
}

// ------------------------------------------------------------------- connect

/**
 * The last door (Cloud Phase 23 A1). "Open" used to be a bare link to the
 * workspace hostname — which greets a customer with an operator console. This
 * page is honest about how to get in TODAY, and it is where the one-click
 * handoff will live once the workspace accepts dashboard sign-ins.
 */
export function connectPage({ account, project, isOwner }) {
  const address = `https://${esc(project.id)}.cloud.maude.sh`;
  return page(
    `Open ${project.name}`,
    `<div class="card">
       <h2>In the Maude app</h2>
       <p class="quiet">One click — the app opens this project signed in as you. Nothing to
         copy, nothing to paste.</p>
       <form method="post" action="/projects/${esc(project.id)}/handoff" style="margin:0">
         <button type="submit">Open in Maude</button>
       </form>
       <p class="quiet" style="margin:var(--space-3) 0 0">Don’t have the app yet?
         <a href="https://maude.sh">Download Maude</a>, then come back and press the button.</p>
     </div>
     <div class="card">
       <h2>In your browser</h2>
       <p class="quiet">Your project lives at its own address. Sign in there with your
         <strong>workspace email and password</strong> — for now this is separate from your
         Maude account; one sign-in for both is on the roadmap.</p>
       <p style="margin:0"><a class="btn" href="${address}">Open ${esc(project.id)}.cloud.maude.sh</a></p>
     </div>
     <p class="quiet">Running the machinery yourself? The operator console lives at the same
       address under <span class="mono">/admin</span>.</p>`,
    { account, project, isOwner, active: 'connect' }
  );
}

// -------------------------------------------------------------------- delete

export function deletePage({ account, project, hasExport, error = null }) {
  const body = hasExport
    ? `<div class="card danger">
         <h2>This is permanent</h2>
         <ul style="margin:var(--space-2) 0 0;padding-left:var(--space-6)">
           <li>The workspace and its address stop existing.</li>
           <li>Billing stops — nothing further is charged.</li>
           <li>The copy you downloaded stays yours, forever.</li>
         </ul>
       </div>
       <form method="post" action="/projects/${esc(project.id)}/delete">
         <label style="font-weight:400"><input type="checkbox" name="sure" value="yes" required>
           I have my copy, and I want ${esc(project.name)} deleted.</label>
         <p style="margin-top:var(--space-4)">
           <button type="submit">Delete this project</button>
           <a href="/" style="margin-left:var(--space-5)">Cancel</a>
         </p>
       </form>`
    : `<div class="card">
         <h2>Download your copy first</h2>
         <p class="quiet" style="margin:0">Deleting is permanent, so it is only offered once a
           complete copy of your work exists. It takes a minute and it is yours to keep.</p>
       </div>
       <p><a class="btn" href="/projects/${esc(project.id)}/download">Download everything</a></p>`;
  return page(
    `Delete ${project.name}?`,
    `${error ? `<p class="error">${esc(error)}</p>` : ''}
     ${body}`,
    { account, project, isOwner: true, active: 'delete' }
  );
}

// --------------------------------------------------------------------- audit

/** Our internal action names, said in the customer's language. */
export const AUDIT_COPY = {
  signup: 'Account created',
  'signup-google': 'Account created with Google',
  login: 'Signed in',
  'member.remove': 'Removed someone from the project',
  'member.role': 'Changed what someone can do',
  'invite.redeem': 'Accepted an invitation',
  'checkout.authorized': 'Payment details confirmed',
  'checkout.settled': 'Project came up — billing began',
  'checkout.voided': 'Setup failed — the card was released',
  'grant-minted': 'Opened the project from a new device',
  reconcile: 'Routine platform check',
  'reconcile-failed': 'A platform check hit a problem',
  'export.prepared': 'A full copy was prepared',
  'project.deleted': 'The project was deleted',
  'mirror.configured': 'GitHub copy connected',
  'mirror.disconnected': 'GitHub copy disconnected',
};

export function auditPage({ account, project, isOwner, entries }) {
  const rows = entries
    .map(
      (e) => `<tr>
        <td>${esc(AUDIT_COPY[e.action] ?? e.action)}</td>
        <td class="quiet">${esc(String(e.actor).replace(/^customer:/, ''))}</td>
        <td class="right"><time>${when(e.at)}</time></td>
      </tr>`
    )
    .join('\n');
  return page(
    'Activity',
    entries.length
      ? `<table><thead><tr><th>What</th><th>Who</th><th>When</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="quiet">Nothing yet.</p>',
    {
      account,
      project,
      isOwner,
      active: 'audit',
      lede: 'Everything that happened to this project — by you, by people you invited, and by the platform itself. If we ever touch your project, it shows up here.',
    }
  );
}

// -------------------------------------------------------------------- mirror

export function mirrorPage({
  account,
  project,
  repository,
  branch,
  isOwner,
  error = null,
  notice = null,
}) {
  const form = isOwner
    ? `<form method="post" action="/projects/${esc(project.id)}/mirror">
         <label for="repository">GitHub repository</label>
         <input type="text" id="repository" name="repository" placeholder="owner/name"
                value="${esc(repository ?? '')}" pattern="[^/]+/[^/]+">
         <label for="branch">Branch</label>
         <input type="text" id="branch" name="branch" value="${esc(branch ?? 'main')}">
         <p style="margin-top:var(--space-4)">
           <button type="submit" name="do" value="save">Save</button>
           ${repository ? '<button type="submit" name="do" value="disconnect" class="ghost" style="margin-left:var(--space-4)">Disconnect</button>' : ''}
         </p>
       </form>
       <p class="quiet">Your project pushes itself to this repository about once an hour —
         additions only, never overwriting anything already there. First
         <a href="https://github.com/apps/maude-mirror">give the Maude Mirror app access</a>
         to the repository on GitHub — that page opens on GitHub; come back here and save
         when it's done.</p>`
    : '<p class="quiet">Only the project’s owner can change where it copies to.</p>';
  return page(
    'Copy to GitHub',
    `${error ? `<p class="error">${esc(error)}</p>` : ''}
     ${notice ? `<p class="ok">${esc(notice)}</p>` : ''}
     <div class="card">${form}</div>`,
    {
      account,
      project,
      isOwner,
      active: 'mirror',
      lede: repository
        ? `This project keeps a copy of its history at ${repository} on the “${branch ?? 'main'}” branch.`
        : 'Keep an automatic copy of this project’s history in a GitHub repository you own.',
    }
  );
}

// -------------------------------------------------------------------- routes

async function loadAccess(env, projectId, accountId) {
  const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?')
    .bind(projectId)
    .first();
  const rows = await env.DB.prepare(
    'SELECT account_id, role FROM project_members WHERE project_id = ?'
  )
    .bind(projectId)
    .all();
  const verdict = decideAccess({ accountId, project, members: rows?.results ?? [] });
  return { project, verdict };
}

/** Group a flat R2 listing into export generations, newest first. */
export function exportGenerations(keys, projectId) {
  const byStamp = new Map();
  for (const { key, size } of keys) {
    const parsed = parseExportKey(key, projectId);
    if (!parsed) continue;
    const g = byStamp.get(parsed.stamp) ?? { stamp: parsed.stamp, files: [], bytes: 0 };
    g.files.push({ name: parsed.name, key });
    g.bytes += size ?? 0;
    byStamp.set(parsed.stamp, g);
  }
  return [...byStamp.values()].sort((a, b) => b.stamp.localeCompare(a.stamp));
}

async function listExports(env, projectId) {
  if (!env.EXPORTS) return [];
  const listed = await env.EXPORTS.list({ prefix: `tenants/${projectId}/exports/`, limit: 500 });
  return exportGenerations(
    (listed?.objects ?? []).map((o) => ({ key: o.key, size: o.size })),
    projectId
  );
}

/**
 * Route the per-project admin surfaces. Returns a Response, or null.
 */
export async function handleProjectAdminRoutes(request, env, { account }) {
  const url = new URL(request.url);
  const m = url.pathname.match(
    /^\/projects\/([a-z0-9-]+)\/(connect|download|delete|audit|mirror)(\/file)?$/
  );
  if (!m) return null;
  const [, projectId, surface, isFile] = m;
  if (!account) return redirect('/login');

  const { project, verdict } = await loadAccess(env, projectId, account.id);
  if (!verdict.ok) {
    return html(
      `<p>${ACCESS_MESSAGES[verdict.reason]}</p>`,
      verdict.reason === 'not-signed-in' ? 401 : 404
    );
  }
  const isOwner = can(verdict.role, 'delete');

  // ----------------------------------------------------------------- connect
  if (surface === 'connect' && request.method === 'GET') {
    return html(connectPage({ account, project, isOwner }));
  }

  // ---------------------------------------------------------------- download
  if (surface === 'download' && isFile && request.method === 'GET') {
    if (!isOwner) return html(`<p>${ACCESS_MESSAGES['no-access']}</p>`, 404);
    // The page links by generation + filename; the storage key — which
    // carries OUR namespace vocabulary — is composed here and never leaves.
    const stamp = String(url.searchParams.get('g') ?? '');
    const name = String(url.searchParams.get('f') ?? '');
    const key = `tenants/${projectId}/exports/${stamp}/${name}`;
    if (!parseExportKey(key, projectId) || !env.EXPORTS) {
      return html(`<p>${ACCESS_MESSAGES['no-access']}</p>`, 404);
    }
    const object = await env.EXPORTS.get(key);
    if (!object) return html(`<p>${ACCESS_MESSAGES['no-access']}</p>`, 404);
    return new Response(object.body, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="${name}"`,
        'cache-control': 'no-store',
      },
    });
  }

  if (surface === 'download' && request.method === 'GET') {
    return html(
      downloadPage({ account, project, generations: await listExports(env, projectId), isOwner })
    );
  }

  if (surface === 'download' && request.method === 'POST') {
    if (!isOwner) return html(`<p>${ACCESS_MESSAGES['no-access']}</p>`, 404);
    // The platform asks the CELL on the owner's behalf, with a token the cell
    // verifies offline — same lane a future in-workspace button would use.
    const { token } = await mintProjectToken({
      master: env.CELL_SECRET_MASTER ?? '',
      project: projectId,
      email: account.email,
      role: 'owner',
      ttlMs: 10 * 60 * 1000,
    });
    let outcome = null;
    try {
      const res = await fetch(
        `https://${projectId}.${env.CELL_ZONE ?? 'cloud.maude.sh'}/api/export`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(120_000),
        }
      );
      outcome = { status: res.status, body: await res.json().catch(() => ({})) };
    } catch (err) {
      outcome = { status: 0, body: { error: err.message } };
    }
    const generations = await listExports(env, projectId);
    if (outcome.status !== 200) {
      console.error(`[export] ${projectId}: ${outcome.status} ${outcome.body?.error ?? ''}`);
      return html(
        downloadPage({
          account,
          project,
          generations,
          isOwner,
          error:
            'The copy could not be prepared right now' +
            (outcome.body?.error ? ` — ${outcome.body.error}` : '') +
            '. Try again in a minute.',
        }),
        502
      );
    }
    await env.DB.prepare('UPDATE projects SET export_sent_at = ? WHERE id = ?')
      .bind(Date.now(), projectId)
      .run();
    await audit(env.DB, {
      accountId: account.id,
      projectId,
      actor: `customer:${account.email}`,
      action: 'export.prepared',
      detail: outcome.body.prefix,
    });
    return html(
      downloadPage({
        account,
        project,
        generations: await listExports(env, projectId),
        isOwner,
        notice: 'Your copy is ready below.',
      })
    );
  }

  // ------------------------------------------------------------------ delete
  if (surface === 'delete') {
    if (!isOwner) return html(`<p>${ACCESS_MESSAGES['no-access']}</p>`, 404);
    const generations = await listExports(env, projectId);
    const hasExport = generations.length > 0;

    if (request.method === 'GET') return html(deletePage({ account, project, hasExport }));
    if (request.method !== 'POST') return html('<p>Not allowed.</p>', 405);

    if (!hasExport) return html(deletePage({ account, project, hasExport }), 409);
    const form = await request.formData();
    if (form.get('sure') !== 'yes') {
      return html(
        deletePage({ account, project, hasExport, error: 'Tick the box to confirm.' }),
        400
      );
    }

    // Billing stops FIRST — a deletion that keeps charging is the worst order.
    if (project.subscription_id && env.STRIPE_SECRET_KEY) {
      const res = await fetch(
        `https://api.stripe.com/v1/subscriptions/${project.subscription_id}`,
        {
          method: 'DELETE',
          headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
        }
      );
      if (!res.ok && res.status !== 404) {
        return html(
          deletePage({
            account,
            project,
            hasExport,
            error: 'Billing could not be stopped, so nothing was deleted. Try again in a minute.',
          }),
          502
        );
      }
    }
    await env.DB.prepare(
      `UPDATE projects SET state = 'purged', state_since = ?, cell_running = 0 WHERE id = ?`
    )
      .bind(Date.now(), projectId)
      .run();
    await audit(env.DB, {
      accountId: account.id,
      projectId,
      actor: `customer:${account.email}`,
      action: 'project.deleted',
    });
    // The address stops answering. Best-effort — a leftover route serves 404s
    // from the cell worker, not somebody's data.
    await removeCellDomain(env, projectId);
    return redirect('/');
  }

  // ------------------------------------------------------------------- audit
  if (surface === 'audit' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT at, actor, action FROM audit_log WHERE project_id = ? ORDER BY at DESC LIMIT 200'
    )
      .bind(projectId)
      .all();
    return html(auditPage({ account, project, isOwner, entries: rows?.results ?? [] }));
  }

  // ------------------------------------------------------------------ mirror
  if (surface === 'mirror') {
    const view = {
      account,
      project,
      repository: project.mirror_repo,
      branch: project.mirror_branch ?? 'main',
      isOwner: can(verdict.role, 'mirror'),
    };
    if (request.method === 'GET') return html(mirrorPage(view));
    if (request.method !== 'POST') return html('<p>Not allowed.</p>', 405);
    if (!view.isOwner) return html(`<p>${ACCESS_MESSAGES['no-access']}</p>`, 404);

    const form = await request.formData();
    if (form.get('do') === 'disconnect') {
      await env.DB.prepare(
        'UPDATE projects SET mirror_repo = NULL, mirror_branch = NULL WHERE id = ?'
      )
        .bind(projectId)
        .run();
      await audit(env.DB, {
        accountId: account.id,
        projectId,
        actor: `customer:${account.email}`,
        action: 'mirror.disconnected',
      });
      return html(
        mirrorPage({
          ...view,
          repository: null,
          branch: 'main',
          notice: 'Disconnected. Nothing already pushed was touched.',
        })
      );
    }

    const checked = validateTarget({
      repo: String(form.get('repository') ?? ''),
      branch: String(form.get('branch') ?? 'main'),
    });
    if (!checked.ok) {
      return html(mirrorPage({ ...view, error: checked.errors.join(' ') }), 400);
    }
    await env.DB.prepare('UPDATE projects SET mirror_repo = ?, mirror_branch = ? WHERE id = ?')
      .bind(checked.target.full, checked.target.branch, projectId)
      .run();
    await audit(env.DB, {
      accountId: account.id,
      projectId,
      actor: `customer:${account.email}`,
      action: 'mirror.configured',
      detail: `${checked.target.full}#${checked.target.branch}`,
    });
    return html(
      mirrorPage({
        ...view,
        repository: checked.target.full,
        branch: checked.target.branch,
        notice: 'Saved. The first push happens within the hour.',
      })
    );
  }

  return html('<p>Not allowed.</p>', 405);
}

/** Every customer-facing string here, for the vocabulary lint. */
export function allProjectAdminHtml() {
  const project = { id: 'alligators', name: 'Brno Alligators' };
  const generations = [
    {
      stamp: '20260730T120000Z',
      bytes: 12_345_678,
      files: [
        { name: 'repo.bundle', key: 'tenants/alligators/exports/20260730T120000Z/repo.bundle' },
        { name: 'MANIFEST.md', key: 'tenants/alligators/exports/20260730T120000Z/MANIFEST.md' },
      ],
    },
  ];
  const account = { email: 'a@example.com' };
  return [
    connectPage({ account, project, isOwner: true }),
    downloadPage({ account, project, generations, isOwner: true }),
    downloadPage({ account, project, generations: [], isOwner: false }),
    downloadPage({
      account,
      project,
      generations,
      isOwner: true,
      error: 'The copy could not be prepared right now. Try again in a minute.',
    }),
    downloadPage({
      account,
      project,
      generations,
      isOwner: true,
      notice: 'Your copy is ready below.',
    }),
    deletePage({ account, project, hasExport: true }),
    deletePage({ account, project, hasExport: false }),
    deletePage({ account, project, hasExport: true, error: 'Tick the box to confirm.' }),
    auditPage({
      account,
      project,
      isOwner: true,
      entries: [
        { at: 1753872000000, actor: 'customer:a@b.c', action: 'checkout.settled' },
        { at: 1753872000000, actor: 'system', action: 'reconcile' },
      ],
    }),
    auditPage({ account, project, isOwner: true, entries: [] }),
    mirrorPage({ account, project, repository: '1aGh/alligators', branch: 'main', isOwner: true }),
    mirrorPage({ account, project, repository: null, branch: 'main', isOwner: false }),
    mirrorPage({
      account,
      project,
      repository: null,
      branch: 'main',
      isOwner: true,
      error: 'repository must be "owner/name" (not a URL)',
    }),
  ].join('\n');
}
