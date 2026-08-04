// The operator surface's pages — Cloud Phase 26 Stage 1.
//
// Server-rendered, no script, same as every other signed-in surface. The rule
// is load-bearing here in a way it is not on the dashboard: this is the board
// somebody opens DURING an outage, and a fleet health page that needs
// JavaScript to tell you the fleet is unhealthy cannot tell you anything at
// the one moment it matters.
//
// Read-mostly by design. There is exactly ONE write on this whole surface — a
// reconcile nudge — because the reconciler is already the only honest way the
// plane changes state (DDR-196). Suspend, comp and refund stay in Stripe,
// which schema.sql designates the subscription authority; the hourly sweep
// picks them up within the hour.
//
// THE PHRASE "operator console" MUST NOT APPEAR ON A CUSTOMER SURFACE.
// `project-admin.test.mjs:498` asserts it, because a tenant hostname once
// greeted a customer with one. These pages live under the apex `/operator/*`
// only and wear the same `appShell`; the trap test stays green because the
// shell's fleet section renders only for an allowlisted operator.

import { appShell } from './brand.mjs';

// The table + card vocabulary the admin surfaces already use (project-admin,
// people-page), plus the one new block: a row of KPI tiles. No new design
// vocabulary — an internal board is the last place to invent any.
const CSS = `
  .main-inner { max-width: 78rem; }
  table { width: 100%; border-collapse: collapse; border-spacing: 0; margin: var(--space-4) 0 var(--space-6); background: var(--bg-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
  th { text-align: left; font-family: var(--font-mono); font-size: var(--type-xs); text-transform: uppercase; letter-spacing: .06em; color: var(--fg-2); padding: var(--space-3) var(--space-5); border-bottom: 1px solid var(--border-subtle); }
  td { padding: var(--space-3) var(--space-5); border-top: 1px solid var(--border-subtle); vertical-align: baseline; font-size: var(--type-base); }
  tr:first-child td { border-top: 0; }
  td.right, th.right { text-align: right; white-space: nowrap; }
  .mono { font-family: var(--font-mono); font-size: var(--type-sm); }
  .quiet { color: var(--fg-2); }
  .card { margin-bottom: var(--space-5); }
  .card h2 { margin: 0 0 var(--space-3); font-size: var(--type-md); }
  time { color: var(--fg-2); font-size: var(--type-sm); }

  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
  .tile { background: var(--bg-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); padding: var(--space-4) var(--space-5); margin: 0; }
  .tile dt { font-family: var(--font-mono); font-size: var(--type-xs); text-transform: uppercase; letter-spacing: .06em; color: var(--fg-2); margin: 0 0 var(--space-2); }
  .tile dd { margin: 0; font-family: var(--font-mono); font-size: var(--type-lg); line-height: var(--lh-md); color: var(--fg-0); }
  .tile .sub { display: block; margin-top: var(--space-2); font-family: var(--font-sans); font-size: var(--type-sm); line-height: var(--lh-sm); color: var(--fg-2); }
  .tile.alarm { border-color: color-mix(in oklab, var(--status-error) 40%, transparent); }

  .problems { list-style: none; margin: 0; padding: 0; }
  .problems li { display: flex; gap: var(--space-4); align-items: baseline; padding: var(--space-3) 0; border-top: 1px solid var(--border-subtle); }
  .problems li:first-child { border-top: 0; }
  .problems .n { font-family: var(--font-mono); font-size: var(--type-md); color: var(--fg-0); min-width: 2.5rem; }
  .problems .k { font-family: var(--font-mono); font-size: var(--type-sm); color: var(--fg-1); min-width: 11rem; }

  .nudge textarea { width: 100%; min-height: 5rem; font: inherit; }
  .nudge label { display: block; margin-bottom: var(--space-2); font-size: var(--type-sm); color: var(--fg-1); }
  .err { color: var(--status-error); font-size: var(--type-sm); }
  .ok { color: var(--status-success); font-size: var(--type-sm); }
`;

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/**
 * Unknown renders as an em-dash, and only unknown does.
 *
 * The whole point of the three-valued rule: a `0` that means "no cell has ever
 * reported this" is indistinguishable on screen from a `0` that means "it
 * reported, and the answer was none". One of those is a metric; the other is a
 * missing pipe.
 */
export function num(v) {
  return v === null || v === undefined || Number.isNaN(v) ? '—' : String(v);
}

export function money(minor, currency = 'eur') {
  if (minor === null || minor === undefined) return '—';
  const symbol = currency === 'eur' ? '€' : `${String(currency).toUpperCase()} `;
  return `${symbol}${(minor / 100).toFixed(2)}`;
}

/**
 * A timestamp, or an em-dash — and never a thrown RangeError.
 *
 * `new Date(x).toISOString()` throws on an out-of-range epoch, and some of the
 * values reaching here originate in a CELL-REPORTED `/health` body
 * (`windowStartedAt`). A number the board cannot render is still "no answer";
 * it is not a reason for the page an operator opens during an outage to 500.
 */
function when(ms) {
  if (ms === null || ms === undefined) return '—';
  try {
    const iso = new Date(Number(ms)).toISOString();
    return `${iso.replace('T', ' ').slice(0, 16)} UTC`;
  } catch {
    return '—';
  }
}

function bytes(n) {
  if (n === null || n === undefined) return '—';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let v = Number(n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function ms(v) {
  return v === null || v === undefined ? '—' : `${Math.round(Number(v))} ms`;
}

/**
 * The cache hit rate, divided HERE — at read time, from the two counts.
 *
 * Never in the cell and never in the sweep. A ratio computed over a window
 * that reset is a confident lie; two counts and a window start can be judged
 * (the render-telemetry contract). `—` when nothing was ever looked up: a 0%
 * cache is a catastrophe and "no builds yet" is a Tuesday.
 */
function cachePct(r, suffix = '') {
  if (!r) return '—';
  const looked = r.cacheHits + r.cacheMisses;
  return looked === 0 ? '—' : `${Math.round((r.cacheHits / looked) * 100)}%${suffix}`;
}

/** Timeouts and memory kills are one operator-facing fact: it hit the wall. */
function ceilingHits(r) {
  return r === null || r === undefined ? null : r.timeouts + r.memoryKills;
}

function tile(label, value, sub = null, { alarm = false } = {}) {
  return `<dl class="tile${alarm ? ' alarm' : ''}">
    <dt>${esc(label)}</dt>
    <dd>${value}${sub ? `<span class="sub">${sub}</span>` : ''}</dd>
  </dl>`;
}

function shell({ account, title, body, active, lede = null }) {
  return appShell({
    account,
    title,
    body,
    isOperator: true,
    active,
    lede,
    extraCss: CSS,
  });
}

// ---------------------------------------------------------------- overview

/**
 * The board.
 *
 * Four things an operator cannot get anywhere else without a terminal: how
 * many projects exist and in what state, what the plane believes it earns,
 * what the model says it costs, and what is wrong right now.
 *
 * @param {object} args
 * @param {object} args.board     assembleBoard() output
 * @param {object} args.mrr       deriveMrr() output
 * @param {number|null} args.accounts
 * @param {object|null} [args.metrics]  analytics tiles, null when not connected
 * @param {object|null} [args.totals]   summed tenant content stats, null when unknown
 */
export function operatorOverviewPage({
  account,
  board,
  mrr,
  accounts = null,
  metrics = null,
  totals = null,
  stripeUrl = 'https://dashboard.stripe.com/subscriptions',
}) {
  const states = Object.entries(board.byState ?? {}).sort((a, b) => b[1] - a[1]);
  const totalProjects = states.reduce((sum, [, n]) => sum + n, 0);

  // The cost tile is a RATIO against a model, never an invoice. `costAlarms`
  // divides observed spend by cell count; `modelPerCellEur: 3` is a Phase-0
  // estimate that has never been given real figures, and presenting an
  // estimate as an invoice is how an estimate stops being questioned.
  const perCell = board.observedSpend === null ? null : board.alarms.perCell;
  const ratio = perCell === null ? null : perCell / board.modelPerCellEur;

  const tiles = [
    tile('Accounts', `<span>${num(accounts)}</span>`),
    tile(
      'Projects',
      `<span>${totalProjects}</span>`,
      states.map(([s, n]) => `${esc(s)} ${n}`).join(' · ') || 'none yet'
    ),
    tile(
      'MRR (believed)',
      `<span>${money(mrr.believedMonthlyMinor, mrr.currency)}</span>`,
      // The label is the honesty. schema.sql: this table is the memory between
      // runs, not the authority — so the number drifts on a missed webhook and
      // the real one is one click away.
      `derived from plan × state · <a href="${esc(stripeUrl)}">Stripe is the authority</a>`
    ),
    tile(
      'Cost vs model',
      `<span>${ratio === null ? '—' : `${ratio.toFixed(1)}×`}</span>`,
      board.observedSpend === null
        ? `no spend figure has ever been collected · model €${board.modelPerCellEur}/cell covers sync AND builds`
        : `€${perCell.toFixed(2)}/cell against a €${board.modelPerCellEur} model` +
            (board.build
              ? ` · build side: ${num(board.build.builds)} builds, ${num(board.build.ceilingHits)} ceiling hits`
              : ' · build side: no cell has reported'),
      { alarm: !board.alarms.ok }
    ),
  ];

  // Stage 4 — WHICH HALF. The €3 model covers a cell's sync lane and its canvas
  // builds together, and until the build sandbox shipped there was no way to
  // say which one moved. This tile is the build half's own figures; whatever
  // the model spends that they do not explain is the sync half.
  if (board.build) {
    const b = board.build;
    tiles.push(
      tile(
        'Canvas builds',
        `<span>${num(b.builds)}</span>`,
        // The ratio is divided HERE, from the two counts, never stored as one:
        // a ratio computed over a window that reset is a confident lie.
        `${b.cacheHitRatio === null ? '—' : `${Math.round(b.cacheHitRatio * 100)}% cached`} · ${num(b.ceilingHits)} ceiling hits · ${b.projects} cells reporting`,
        { alarm: b.ceilingHits > 0 }
      )
    );
  }

  if (metrics) {
    tiles.push(
      tile(
        'Active accounts',
        `<span>${num(metrics.dau)}</span>`,
        `${num(metrics.wau)} this week · ${num(metrics.mau)} this month`
      )
    );
  }
  if (totals) {
    tiles.push(
      tile(
        'Tenant content',
        `<span>${num(totals.canvases)}</span>`,
        `canvases · ${num(totals.designSystems)} design systems · ${bytes(totals.assetsBytes)}`
      )
    );
  }
  if (metrics?.coldStartP95Ms !== undefined) {
    tiles.push(
      tile(
        'Cold start p95',
        `<span>${ms(metrics.coldStartP95Ms)}</span>`,
        'time from waking a sleeping cell to a healthy answer'
      )
    );
  }

  const problems = board.problems.length
    ? `<ul class="problems">${board.problems
        .map(
          (p) => `<li>
            <span class="n">${p.count}</span>
            <span class="k">${esc(p.kind)}</span>
            <span class="quiet">${esc(p.detail ?? '')}${
              p.ids.length
                ? ` — ${esc(p.ids.join(', '))}${p.count > p.ids.length ? ', …' : ''}`
                : ''
            }</span>
          </li>`
        )
        .join('\n')}</ul>`
    : '<p class="quiet">Nothing to interpret. Every serving cell is drilled, checkpointed and on one version.</p>';

  const alarms = board.alarms.alarms.length
    ? `<ul class="problems">${board.alarms.alarms
        .map(
          (a) =>
            `<li><span class="k">${esc(a.kind)}</span><span class="quiet">${esc(a.detail)}</span></li>`
        )
        .join('\n')}</ul>`
    : '';

  const unpriced = mrr.unpriced.length
    ? `<div class="card"><h2>Projects on a plan with no price</h2>
         <p class="quiet">Counted as nothing, which is why they are listed rather than summed.</p>
         <p class="mono">${mrr.unpriced.map((u) => esc(`${u.id} (${u.plan})`)).join(', ')}</p>
       </div>`
    : '';

  return shell({
    account,
    title: 'Fleet overview',
    active: 'operator',
    lede: 'Every project and account on the platform, what the plane believes it earns, and what is wrong right now. Read-mostly — the one action here asks the reconciler to run, which is the only honest way state changes.',
    body: `<div class="tiles">${tiles.join('\n')}</div>
      ${alarms ? `<div class="card"><h2>Cost alarms</h2>${alarms}</div>` : ''}
      <div class="card"><h2>Fleet problems</h2>${problems}</div>
      ${unpriced}`,
  });
}

// ---------------------------------------------------------------- projects

/**
 * Every project, one row each.
 *
 * @param {Map<string, object>|null} [args.stats]  latest reported content stats
 *   per project id. A project absent from the map has never reported, which is
 *   a different fact from reporting zero — hence `—`.
 */
export function operatorProjectsPage({ account, projects = [], stats = null, render = null }) {
  const withStats = stats !== null;
  const withRender = render !== null;
  const rows = projects
    .map((p) => {
      const s = stats?.get(p.id) ?? null;
      const r = render?.get(p.id) ?? null;
      return `<tr>
        <td class="mono"><a href="/operator/projects/${esc(p.id)}">${esc(p.id)}</a></td>
        <td>${esc(p.name ?? '')}</td>
        <td>${esc(p.state)}</td>
        <td>${esc(p.plan ?? '')}</td>
        <td class="quiet">${esc(p.owner_email ?? '—')}</td>
        <td class="mono">${esc(p.version ?? '—')}</td>
        <td class="right"><time>${when(p.last_checkpoint)}</time></td>
        <td class="right">${p.cell_running ? 'yes' : 'no'}</td>
        ${
          withStats
            ? `<td class="right mono">${num(s?.canvases ?? null)}</td>
               <td class="right mono">${num(s?.artboards ?? null)}</td>
               <td class="right mono">${bytes(s?.assetsBytes ?? null)}</td>`
            : ''
        }
        ${
          withRender
            ? `<td class="right mono">${num(r?.builds ?? null)}</td>
               <td class="right mono">${cachePct(r)}</td>
               <td class="right mono">${ms(r?.durationMsP95)}</td>
               <td class="right mono">${num(ceilingHits(r))}</td>`
            : ''
        }
      </tr>`;
    })
    .join('\n');

  return shell({
    account,
    title: 'All projects',
    active: 'operator-projects',
    lede: 'Every project on the platform, whatever state it is in. An em-dash means the plane has no answer — never that the answer is zero.',
    body: projects.length
      ? `<table>
          <thead><tr>
            <th>Project</th><th>Name</th><th>State</th><th>Plan</th><th>Owner</th><th>Version</th>
            <th class="right">Last checkpoint</th><th class="right">Cell up</th>
            ${withStats ? '<th class="right">Canvases</th><th class="right">Artboards</th><th class="right">Assets</th>' : ''}
            ${withRender ? '<th class="right">Builds</th><th class="right">Cache hit</th><th class="right">Build p95</th><th class="right">Ceiling hits</th>' : ''}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : '<p class="quiet">No projects yet.</p>',
  });
}

// ---------------------------------------------------------------- accounts

export function operatorAccountsPage({ account, accounts = [] }) {
  const rows = accounts
    .map(
      (a) => `<tr>
        <td class="mono">${esc(a.id)}</td>
        <td>${esc(a.email)}</td>
        <td class="right mono">${num(a.projects ?? null)}</td>
        <td class="right">${a.stripe_customer_id ? 'yes' : 'no'}</td>
        <td class="right"><time>${when(a.created_at)}</time></td>
      </tr>`
    )
    .join('\n');

  return shell({
    account,
    title: 'All accounts',
    active: 'operator-accounts',
    lede: 'Who exists on the platform. Reading this list is itself recorded — a fleet-wide view of who our customers are is the break-glass, whatever it is called.',
    body: accounts.length
      ? `<table>
          <thead><tr><th>Account</th><th>Email</th><th class="right">Projects</th><th class="right">Stripe</th><th class="right">Created</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : '<p class="quiet">No accounts yet.</p>',
  });
}

// ------------------------------------------------------------ project detail

/**
 * One project, everything the plane knows plus the one action.
 *
 * The audit tail renders the REASON column, which the customer-facing page did
 * not until this phase. An operator access with no stated reason is the one
 * worth noticing (schema.sql), and a column that is never displayed is a
 * column nobody fills in honestly.
 */
export function operatorProjectPage({
  account,
  project,
  jobs = [],
  entries = [],
  csrf,
  stats = null,
  render = null,
  error = null,
  notice = null,
}) {
  const facts = [
    ['id', `<span class="mono">${esc(project.id)}</span>`],
    ['name', esc(project.name ?? '')],
    ['owner', esc(project.owner_email ?? '—')],
    [
      'state',
      `${esc(project.state)} <span class="quiet">since ${when(project.state_since)}</span>`,
    ],
    ['plan', esc(project.plan ?? '')],
    [
      'subscription',
      project.subscription_id
        ? `<a class="mono" href="https://dashboard.stripe.com/subscriptions/${esc(project.subscription_id)}">${esc(project.subscription_id)}</a>`
        : '—',
    ],
    ['version', `<span class="mono">${esc(project.version ?? '—')}</span>`],
    ['previous version', `<span class="mono">${esc(project.previous_version ?? '—')}</span>`],
    ['canary', project.canary ? 'yes' : 'no'],
    ['cell running', project.cell_running ? 'yes' : 'no'],
    ['last checkpoint', when(project.last_checkpoint)],
    ['last restore drill', when(project.last_restore_drill)],
    ['export sent', when(project.export_sent_at)],
    ['created', when(project.created_at)],
  ];

  if (stats) {
    facts.push([
      'content',
      `${num(stats.canvases)} canvases · ${num(stats.artboards)} artboards · ${num(stats.designSystems)} design systems · ${bytes(stats.assetsBytes)}`,
    ]);
  }
  if (render) {
    facts.push([
      'canvas builds',
      `${num(render.builds)} builds · ${cachePct(render, ' cached')} · p95 ${ms(render.durationMsP95)} · ${num(ceilingHits(render))} ceiling hits` +
        // Without the window start, a row of zeroes is ambiguous between "a
        // quiet hour" and "this cell rebooted a minute ago".
        ` <span class="quiet">(window from ${when(render.windowStartedAt ?? null)})</span>`,
    ]);
  }

  const jobRows = jobs
    .map(
      (j) => `<tr>
        <td class="mono">${esc(j.reason)}</td>
        <td>${esc(j.outcome ?? 'pending')}</td>
        <td class="quiet">${esc(String(j.detail ?? '').slice(0, 160))}</td>
        <td class="right"><time>${when(j.created_at)}</time></td>
      </tr>`
    )
    .join('\n');

  const auditRows = entries
    .map(
      (e) => `<tr>
        <td>${esc(e.action)}</td>
        <td class="quiet">${esc(e.actor)}</td>
        <td>${esc(e.reason ?? '—')}</td>
        <td class="right"><time>${when(e.at)}</time></td>
      </tr>`
    )
    .join('\n');

  return shell({
    account,
    title: project.name || project.id,
    active: 'operator-projects',
    lede: 'Everything the control plane knows about this project. What it holds, what it earns and what state it is in — the designs themselves are in the cell and are not reachable from here.',
    body: `
      ${error ? `<p class="err">${esc(error)}</p>` : ''}
      ${notice ? `<p class="ok">${esc(notice)}</p>` : ''}
      <div class="card"><h2>Row</h2>
        <table><tbody>${facts
          .map(([k, v]) => `<tr><td class="quiet">${esc(k)}</td><td>${v}</td></tr>`)
          .join('\n')}</tbody></table>
      </div>

      <div class="card"><h2>Recent jobs</h2>
        ${
          jobs.length
            ? `<table><thead><tr><th>Reason</th><th>Outcome</th><th>Detail</th><th class="right">Created</th></tr></thead><tbody>${jobRows}</tbody></table>`
            : '<p class="quiet">No jobs recorded.</p>'
        }
      </div>

      <div class="card"><h2>Activity</h2>
        ${
          entries.length
            ? `<table><thead><tr><th>Action</th><th>Actor</th><th>Reason</th><th class="right">When</th></tr></thead><tbody>${auditRows}</tbody></table>`
            : '<p class="quiet">Nothing recorded.</p>'
        }
      </div>

      <div class="card nudge"><h2>Ask the reconciler to run</h2>
        <p class="quiet">The only write on this surface. It enqueues a job; the reconciler
          re-derives everything from Stripe and the cell, exactly as the hourly sweep does.
          Suspending, comping and refunding stay in Stripe — the sweep picks those up on its own.</p>
        <form method="post" action="/operator/projects/${esc(project.id)}/reconcile">
          <input type="hidden" name="csrf" value="${esc(csrf)}">
          <label for="reason">Why, in your own words. Recorded permanently, and the customer can read it.</label>
          <textarea id="reason" name="reason" required maxlength="500"
            placeholder="e.g. customer reported the project stuck in setup"></textarea>
          <button type="submit">Enqueue a reconcile</button>
        </form>
      </div>`,
  });
}

// ------------------------------------------------------------------- events

/**
 * Product analytics, read back out of Workers Analytics Engine.
 *
 * `metrics === null` means the read token is not configured. That renders as a
 * quiet "not connected" panel rather than an error page: an unset optional
 * secret is a deployment state, not a fault, and a board that 500s because one
 * tile has no data is a board that cannot report the outage it exists for.
 */
export function operatorEventsPage({ account, metrics = null, sampled = false }) {
  if (!metrics) {
    return shell({
      account,
      title: 'Usage',
      active: 'operator-events',
      lede: 'Server-side product analytics, emitted by the edge and read back over the Analytics Engine SQL API.',
      body: `<div class="card"><h2>Analytics is not connected</h2>
        <p class="quiet">Events are being written — the binding is part of the Worker. Reading them
          back needs a separate token with <span class="mono">Account Analytics Read</span> and
          nothing else:</p>
        <p class="mono">wrangler secret put CF_ANALYTICS_TOKEN</p>
      </div>`,
    });
  }

  const approx = (n) => (n === null || n === undefined ? '—' : `${sampled ? '~' : ''}${n}`);

  const byName = (metrics.byName ?? [])
    .map(
      (r) =>
        `<tr><td class="mono">${esc(r.name)}</td><td class="right mono">${approx(r.count)}</td></tr>`
    )
    .join('\n');

  return shell({
    account,
    title: 'Usage',
    active: 'operator-events',
    lede: sampled
      ? 'Analytics Engine sampled this window, so the counts are approximations — shown with a leading ~.'
      : 'Server-side product analytics. Account ids and action names only: no email, no content, no third party.',
    body: `<div class="tiles">
        ${tile('Active today', `<span>${approx(metrics.dau)}</span>`, 'distinct accounts, last 24 h')}
        ${tile('Active this week', `<span>${approx(metrics.wau)}</span>`, 'distinct accounts, last 7 d')}
        ${tile('Active this month', `<span>${approx(metrics.mau)}</span>`, 'distinct accounts, last 30 d')}
        ${tile('Signups', `<span>${approx(metrics.signups)}</span>`, 'last 30 d')}
        ${tile('Checkouts completed', `<span>${approx(metrics.checkouts)}</span>`, 'last 30 d')}
      </div>
      <div class="card"><h2>Events, last 7 days</h2>
        ${
          byName
            ? `<table><thead><tr><th>Event</th><th class="right">Count</th></tr></thead><tbody>${byName}</tbody></table>`
            : '<p class="quiet">No events in the window.</p>'
        }
      </div>`,
  });
}

/** Every operator-surface string, for the vocabulary lint + the leak trap. */
export function allOperatorHtml() {
  const account = { email: 'op@example.com', id: 'acct_op' };
  const project = {
    id: 'alligators',
    name: 'Brno Alligators',
    state: 'active',
    state_since: 0,
    plan: 'project',
    owner_email: 'a@example.com',
    subscription_id: 'sub_1',
    version: 'v1',
    previous_version: null,
    canary: 0,
    cell_running: 1,
    last_checkpoint: null,
    last_restore_drill: null,
    export_sent_at: null,
    created_at: 0,
  };
  return [
    operatorOverviewPage({
      account,
      board: {
        byState: { active: 1 },
        problems: [{ kind: 'never-drilled', count: 1, ids: ['alligators'], detail: 'x' }],
        alarms: { alarms: [], ok: true, perCell: 0, total: 0 },
        observedSpend: null,
        modelPerCellEur: 3,
      },
      mrr: { believedMonthlyMinor: 1900, currency: 'eur', byPlan: [], unpriced: [] },
      accounts: 1,
    }),
    operatorProjectsPage({ account, projects: [project] }),
    operatorAccountsPage({ account, accounts: [{ ...project, id: 'acct_1', email: 'a@e.com' }] }),
    operatorProjectPage({ account, project, csrf: 'x'.repeat(32) }),
    operatorEventsPage({ account, metrics: null }),
  ].join('\n');
}
