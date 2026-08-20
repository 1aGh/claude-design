#!/usr/bin/env node
// Compute the Maude roadmap consumed by site/app/(home)/roadmap/page.tsx.
// Reads:
//   .ai/plans/*.md                  (active / planned / icebox plans)
//   .ai/plans/archive/*.md          (done plans)
//   .ai/state/STATE.md              (History tables + active **Phase:** line)
//   .ai/plans/README.md             (Execution order table -> ship targets)
//
// Output: site/lib/roadmap.json (committed -- Vercel uploads only site/).
// Run as prebuild step -- see site/package.json `prebuild`.

import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const out = resolve(__dirname, '../lib/roadmap.json');

const plansDir = resolve(repoRoot, '.ai/plans');
const archiveDir = resolve(plansDir, 'archive');
const stateFile = resolve(repoRoot, '.ai/state/STATE.md');
const readmeFile = resolve(plansDir, 'README.md');

const IGNORE_PLAN_FILES = new Set(['README.md', 'feature-site-roadmap.md']);

// Plan id = filename without `.md` (e.g. `phase-6.5-export`, `phase-7-acp-chat-sidebar`).
function planIdFromFile(name) {
  return name.replace(/\.md$/i, '');
}

// Extract a short numeric phase key from a plan id (e.g. `phase-6.5-...` -> `6.5`, `phase-12-...` -> `12`).
// Returns null for non-phase plans (feature-*, rename-*, setup-ds-*, ...).
function phaseNumberFromId(id) {
  const m = id.match(/^phase-([\d.]+)(?:[-.]|$)/);
  return m ? m[1] : null;
}

// Parse YAML-ish frontmatter (very small, hand-rolled -- avoids a yaml dep).
function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const kv = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value === '[]') value = [];
    fm[kv[1]] = value;
  }
  return { fm, body: text.slice(m[0].length) };
}

// Pull the H1 title (first `# ` line in body).
function extractTitle(body) {
  for (const line of body.split('\n')) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m) return m[1];
  }
  return '';
}

// Pull a short one-line summary from the first non-empty, non-blockquote, non-list paragraph
// after the H1. Strips markdown links + backticks.
function extractSummary(body) {
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].match(/^#\s+/)) i++;
  i++;
  const para = [];
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (para.length) break;
      continue;
    }
    if (line.startsWith('>')) continue;
    if (line.startsWith('#')) continue;
    if (line.startsWith('|')) continue;
    if (line.startsWith('- ') || line.startsWith('* ')) continue;
    if (line.startsWith('```')) {
      while (i < lines.length && !(i > 0 && lines[i] !== lines[0] && lines[i].startsWith('```')))
        i++;
      continue;
    }
    para.push(line);
    if (para.join(' ').length > 240) break;
  }
  const raw = para.join(' ');
  const stripped = raw
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
  if (stripped.length <= 200) return stripped;
  return `${stripped.slice(0, 197).trimEnd()}...`;
}

// Detect icebox plans: either filename contains `icebox` OR body starts with an icebox marker.
function isIcebox(body) {
  const head = body.slice(0, 800).toLowerCase();
  return head.includes('icebox') || head.includes('❄') || head.includes('deferred');
}

async function loadPlans(dir, { archived }) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const plans = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    if (IGNORE_PLAN_FILES.has(entry.name)) continue;
    const filePath = resolve(dir, entry.name);
    const raw = await readFile(filePath, 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    // Superseded / rejected archived plans never shipped — excluding them keeps
    // the public roadmap honest (archive=done would falsely list them as shipped).
    if (archived && (fm.status === 'superseded' || fm.status === 'rejected')) continue;
    const id = planIdFromFile(entry.name);
    const title = extractTitle(body) || fm.name || id;
    const summary = extractSummary(body);
    const planPath = archived ? `.ai/plans/archive/${entry.name}` : `.ai/plans/${entry.name}`;
    let status;
    if (archived) {
      status = 'done';
    } else if (isIcebox(body)) {
      status = 'icebox';
    } else {
      status = fm.status === 'in-progress' ? 'in-progress' : 'planned';
    }
    plans.push({
      id,
      phaseKey: phaseNumberFromId(id),
      title,
      status,
      summary,
      planPath,
      created: fm.created || null,
    });
  }
  return plans;
}

// Parse all `## History` markdown tables in STATE.md. Two schemas exist:
//   newer: | Date | Phase | Status | Note |
//   older: | When | Phase | Note |
// Returns flat list of `{ date, phase, status, note }` (status is "" for older
// rows). Most-recent entries come first in newer table, oldest first in older.
function parseHistoryRows(stateText) {
  const rows = [];
  const lines = stateText.split('\n');
  let inHistory = false;
  let inTable = false;
  let hasStatusCol = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+History\b/i.test(line)) {
      inHistory = true;
      inTable = false;
      continue;
    }
    if (inHistory && /^##\s+/.test(line) && !/^##\s+History\b/i.test(line)) {
      inHistory = false;
      inTable = false;
      continue;
    }
    if (!inHistory) continue;
    // Header rows: `| Date | Phase | ... |` or `| When | Phase | Note |`.
    const headerMatch = line.match(/^\|\s*(Date|When)\s*\|\s*Phase\s*\|\s*([^|]+?)\s*\|/i);
    if (headerMatch) {
      inTable = true;
      hasStatusCol = /^Status\b/i.test(headerMatch[2].trim());
      continue;
    }
    if (inTable && /^\|\s*-+/.test(line)) continue;
    if (inTable && /^\|/.test(line)) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      if (hasStatusCol && cells.length >= 3) {
        const [date, phase, status, ...noteCells] = cells;
        rows.push({ date, phase, status, note: noteCells.join(' | ') });
      } else if (!hasStatusCol && cells.length >= 3) {
        const [date, phase, ...noteCells] = cells;
        rows.push({ date, phase, status: '', note: noteCells.join(' | ') });
      }
    } else if (inTable && !/^\|/.test(line) && line.trim() !== '') {
      inTable = false;
    }
  }
  return rows;
}

// For a given plan id (e.g. `phase-6` or `phase-4.2`), find the most-relevant
// history row's date. Strategy:
//   1. Newer table (has Status col): match `Phase X.Y` exactly + status=done.
//   2. Older table: match `Phase X.Y` exactly; take the latest date.
//   3. Fall back to anywhere in note column referencing the phase + done marker.
function matchHistoryRow(_planId, phaseKey, rows) {
  if (!phaseKey) return null;
  const escaped = phaseKey.replace(/\./g, '\\.');
  // Phase cell must match exactly: "Phase X.Y" optionally followed by space/dash/end.
  // Use a negative lookahead on `.` so `4.2` doesn't catch `4.2.1`.
  const phaseRe = new RegExp(`^Phase\\s+${escaped}(?!\\.|\\d)(?:\\b|\\s|$)`);

  // Pass 1: newer-table closeout row (status=done).
  const newer = rows.filter((r) => phaseRe.test(r.phase) && r.status);
  const done = newer.find((r) => r.status.toLowerCase() === 'done');
  if (done) return done;

  // Pass 2: older-table -- find latest row whose Phase cell matches.
  const older = rows.filter((r) => phaseRe.test(r.phase) && !r.status);
  if (older.length) {
    return older.reduce((latest, r) => (r.date > (latest?.date || '') ? r : latest), null);
  }

  // Pass 3: Phase=done row whose note references the phase number close to a
  // `/flow:done` marker (older table convention).
  const noteRe = new RegExp(`/flow:done.*Phase\\s+${escaped}(?!\\.|\\d)\\b`);
  const closeout = rows.filter((r) => /^done$/i.test(r.phase) && noteRe.test(r.note));
  if (closeout.length) {
    return closeout.reduce((latest, r) => (r.date > (latest?.date || '') ? r : latest), null);
  }

  // Last resort: any newer-table row matching the phase (newest).
  return newer[0] || null;
}

// Parse the `## Execution order` table in plans/README.md. Returns map keyed
// by the source filename ("phase-6.5-export.md" -> { shipTarget, canParallelize }).
function parseExecutionOrder(readmeText) {
  const map = {};
  const lines = readmeText.split('\n');
  let inSection = false;
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+Execution order\b/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) {
      inSection = false;
      inTable = false;
      continue;
    }
    if (!inSection) continue;
    if (/^\|\s*Step\s*\|/i.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable && /^\|\s*-+/.test(line)) continue;
    if (inTable && /^\|/.test(line)) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.length >= 5) {
        const [step, phase, file, canParallelize, ship] = cells;
        // file cell looks like `` `phase-6.5-export.md` ``
        const fname = (file.match(/`([^`]+)`/) || [])[1];
        if (fname) {
          map[fname] = {
            step,
            phaseTitle: phase,
            canParallelize,
            shipTarget: ship,
          };
        }
      }
    } else if (inTable && !/^\|/.test(line) && line.trim() !== '') {
      inTable = false;
    }
  }
  return map;
}

// Parse the active **Phase:** / **Status:** / **Branch:** / **Active task:** /
// **Active plan:** lines at the top of STATE.md. Returns the active plan
// filename (preferred) plus a free-text status + branch.
function parseActiveBlock(stateText) {
  const out = { activePlan: null, status: null, branch: null, phaseLine: null };
  const head = stateText.split('## History')[0];
  for (const raw of head.split('\n')) {
    const m = raw.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    const value = m[2].trim();
    if (key === 'active plan') out.activePlan = value;
    else if (key === 'status') out.status = value;
    else if (key === 'branch') out.branch = value;
    else if (key === 'phase') out.phaseLine = value;
  }
  return out;
}

// MAIN ---------------------------------------------------------------------

const [activePlans, archivedPlans] = await Promise.all([
  loadPlans(plansDir, { archived: false }),
  loadPlans(archiveDir, { archived: true }),
]);
const stateText = existsSync(stateFile) ? await readFile(stateFile, 'utf8') : '';
const readmeText = existsSync(readmeFile) ? await readFile(readmeFile, 'utf8') : '';

const historyRows = parseHistoryRows(stateText);
const execOrder = parseExecutionOrder(readmeText);
const active = parseActiveBlock(stateText);

// Mark the in-progress plan: active.activePlan (e.g. `phase-6.5-export.md`).
const activePlanFile = active.activePlan;
const activePlanId = activePlanFile ? planIdFromFile(activePlanFile) : null;

function decorate(plan, { archived }) {
  const filename = archived ? plan.planPath.split('/').pop() : `${plan.id}.md`;
  const exec = execOrder[filename] || null;
  const shipTarget = exec?.shipTarget || (plan.status === 'icebox' ? 'ICEBOX' : null);
  const hist = matchHistoryRow(plan.id, plan.phaseKey, historyRows);

  // Mark in-progress override.
  let status = plan.status;
  if (!archived && plan.id === activePlanId) status = 'in-progress';

  return {
    id: plan.id,
    title: plan.title,
    status,
    shipTarget: shipTarget || null,
    date: archived && hist ? hist.date : null,
    summary: plan.summary,
    planPath: plan.planPath,
    archived,
    phaseKey: plan.phaseKey,
  };
}

const phases = [
  ...archivedPlans.map((p) => decorate(p, { archived: true })),
  ...activePlans.map((p) => decorate(p, { archived: false })),
];

// Sort: done by date asc (oldest first), then in-progress, then planned by
// phase number asc, then icebox.
const statusRank = { done: 0, 'in-progress': 1, planned: 2, icebox: 3 };
function phaseKeyForSort(k) {
  if (!k) return Number.POSITIVE_INFINITY;
  // Split on `.` so `4.0.5` < `4.1` correctly.
  return k.split('.').reduce((acc, part, idx) => acc + Number(part) / 10 ** (idx * 3), 0);
}
phases.sort((a, b) => {
  const sa = statusRank[a.status] ?? 9;
  const sb = statusRank[b.status] ?? 9;
  if (sa !== sb) return sa - sb;
  if (a.status === 'done') {
    // Newest first inside the done bucket so the rendered timeline reads
    // present -> past once we render-bottom up; but the page renders top-down,
    // so done at top should be oldest -> newest. Keep oldest-first.
    return (a.date || '').localeCompare(b.date || '');
  }
  return phaseKeyForSort(a.phaseKey) - phaseKeyForSort(b.phaseKey);
});

const currentPhase = (() => {
  const found = phases.find((p) => p.status === 'in-progress');
  if (!found) return null;
  return {
    id: found.id,
    title: found.title,
    branch: active.branch || null,
    status: active.status || null,
  };
})();

// Deterministic `generated` (a function of the inputs, never the clock) so the
// site-content drift gate can regenerate this file in CI and diff it — a build
// timestamp made every regen dirty. "Newest date the inputs mention" == the
// last time the roadmap actually moved, which is what the changelog header
// wants to say anyway. Scanned from the raw STATE.md text (not per-phase
// dates: those come from the `## History` TABLE parser, and the kgai-era
// STATE.md records history as `_YYYY-MM-DD:_` prose the table parser never
// matches — every phase date is null today). Same fix as build-whats-new.mjs.
const newestInputDate = [
  ...new Set(
    [stateText, ...phases.map((p) => p.date || '')].join('\n').match(/\b20\d{2}-\d{2}-\d{2}\b/g) ??
      []
  ),
]
  .sort()
  .at(-1);
const roadmap = {
  // Regenerated every build -- do NOT edit by hand. See site/scripts/build-roadmap.mjs.
  generated: newestInputDate ? `${newestInputDate}T00:00:00.000Z` : null,
  currentPhase,
  phases,
};

await writeFile(out, `${JSON.stringify(roadmap, null, 2)}\n`);

const counts = phases.reduce((acc, p) => {
  acc[p.status] = (acc[p.status] || 0) + 1;
  return acc;
}, {});
const summary = Object.entries(counts)
  .map(([k, v]) => `${k}=${v}`)
  .join(' · ');
const currentLine = currentPhase
  ? `\n          current: ${currentPhase.id} (${currentPhase.branch || 'no branch'})`
  : '';
console.log(
  `[roadmap] wrote ${out}\n          phases: ${phases.length} total · ${summary}${currentLine}`
);
