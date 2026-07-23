// ddr-to-kgai — productionized importer (port of scripts/kgai-smoke/ddr2kgai.py,
// feature-kgai-ecosystem-integration Task 11). Turns this repo's
// `.ai/decisions/DDR-*.md` into a kgai `{decisions:[…]}` batch and ingests it via
// `kg ingest --file`, so an existing file-based decision store migrates into the
// graph in one pass.
//
// Reached via `maude kg import [--dry-run] [--force] [--root PATH]` (DDR-062).
// Model A (DDR-189 scope decision): every decision is tagged `repo:`/`dept:` from
// `config.knowledgeGraph.scope` so one shared store hosts many repos.
//
// Edge model (mirrors kgai's "few stable domain elements shaped by many decisions"):
//   - each DDR → a `decision:DDR-NNN` element + shapes an `area:<primary-tag>`
//   - remaining tags → `topic:` elements, `area —TOUCHES→ topic`
//   - typed cross-refs FIRST (**Supersedes:**/**Related:**/**Extends:**/**Amends:**),
//     then bare `DDR-\d+` body mentions as weak `references`, deduped — so the
//     graph doesn't drown in the thousands of loose name-drops (plan caution #2).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from './argv.mjs';

const REF_RANK = { references: 0, extends: 1, overrides: 2, supersedes: 3 };

/** Pull a `**Label:** value` (or list-form `- **Label:** value`) field. */
function field(text, label) {
  const m = text.match(new RegExp(`^\\s*(?:[-*]\\s*)?\\*\\*${label}:\\*\\*\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : '';
}

/** First paragraph under a `## Header`, whitespace-collapsed, capped. */
function firstPara(text, header) {
  const m = text.match(new RegExp(`^##+\\s*${header}\\s*$([\\s\\S]+?)(^##\\s|$(?![\\s\\S]))`, 'm'));
  if (!m) return '';
  const para = m[1]
    .trim()
    .split(/\n\s*\n/)[0]
    .trim();
  return para.replace(/\s+/g, ' ').slice(0, 400);
}

function normDate(d) {
  const m = (d || '').match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function parseTags(raw) {
  return raw
    .split(/[,/]/)
    .map((x) =>
      x
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\- ]/g, '')
        .trim()
        .replace(/ +/g, '-')
    )
    .filter((x) => x && x !== '—' && x !== '-')
    .slice(0, 6);
}

/**
 * Classify cross-refs. Typed markers win over bare mentions; strongest kind per
 * target is kept. Returns { 'NNN': 'supersedes'|'overrides'|'extends'|'references' }.
 */
function crossRefs(text, selfNum) {
  const out = {};
  const put = (tgt, kind) => {
    if (tgt === selfNum) return;
    if (!(tgt in out) || REF_RANK[kind] > REF_RANK[out[tgt]]) out[tgt] = kind;
  };
  // Typed markers first (Appendix A.3).
  const marker = (label, kind) => {
    const re = new RegExp(`^\\s*(?:[-*]\\s*)?\\*\\*${label}:\\*\\*(.+)$`, 'gim');
    let m;
    while ((m = re.exec(text)))
      for (const d of m[1].matchAll(/DDR-(\d+)/g)) put(d[1].padStart(3, '0'), kind);
  };
  marker('Supersedes', 'supersedes');
  marker('Related', 'references');
  marker('Relates', 'references');
  marker('Extends', 'extends');
  marker('Amends', 'extends');
  // Then bare mentions → weak references (skip anything already typed).
  for (const d of text.matchAll(/DDR-(\d+)/g)) {
    const tgt = d[1].padStart(3, '0');
    if (!(tgt in out)) put(tgt, 'references');
  }
  return out;
}

/** Build the kgai batch from a decisions dir. Pure. */
export function buildDdrBatch(decisionsDir, scope = {}) {
  const files = readdirSync(decisionsDir)
    .filter((f) => /^DDR-\d+.*\.md$/.test(f))
    .sort();
  const decisions = [];
  const stats = { files: 0, withDate: 0, withTags: 0, crossrefs: 0, tags: new Set() };
  const scopeMuts = (name) => {
    const m = [];
    if (scope.repo) {
      m.push({ op: 'upsert_element', kind: 'repo', name: scope.repo });
      m.push({
        op: 'add_link',
        from: `decision:${name}`,
        to: `repo:${scope.repo}`,
        link: 'IN_REPO',
      });
    }
    if (scope.dept) {
      m.push({ op: 'upsert_element', kind: 'dept', name: scope.dept });
      m.push({
        op: 'add_link',
        from: `decision:${name}`,
        to: `dept:${scope.dept}`,
        link: 'IN_DEPT',
      });
    }
    return m;
  };

  for (const f of files) {
    const t = readFileSync(join(decisionsDir, f), 'utf8');
    stats.files++;
    const num = (f.match(/DDR-(\d+)/) || [null, '000'])[1];
    const title = (t.match(/^#\s*DDR-\d+:\s*(.+)$/m) || [null, f])[1].trim();
    const date = normDate(field(t, 'Date')) || normDate(field(t, 'Status'));
    const tags = parseTags(field(t, 'Tags'));
    const rationale = firstPara(t, 'Decision') || firstPara(t, 'Context');
    const refs = crossRefs(t, num);
    if (date) stats.withDate++;
    if (tags.length) {
      stats.withTags++;
      for (const tg of tags) stats.tags.add(tg);
    }
    stats.crossrefs += Object.keys(refs).length;

    const primary = tags[0] || 'general';
    const self = `DDR-${num}`;
    const muts = [
      { op: 'upsert_element', kind: 'area', name: primary, props: { last_ddr: self } },
      { op: 'upsert_element', kind: 'decision', name: self, props: { title: title.slice(0, 120) } },
      { op: 'add_link', from: `decision:${self}`, to: `area:${primary}`, link: 'ABOUT' },
      ...scopeMuts(self),
    ];
    for (const tg of tags.slice(1)) {
      muts.push({ op: 'upsert_element', kind: 'topic', name: tg });
      muts.push({ op: 'add_link', from: `area:${primary}`, to: `topic:${tg}`, link: 'TOUCHES' });
    }
    for (const [tgt, kind] of Object.entries(refs)) {
      muts.push({ op: 'upsert_element', kind: 'decision', name: `DDR-${tgt}` });
      muts.push({
        op: 'add_link',
        from: `decision:${self}`,
        to: `decision:DDR-${tgt}`,
        link: kind.toUpperCase(),
      });
    }
    const d = { title, mutations: muts };
    if (date) d.date = date;
    if (rationale) d.rationale = rationale;
    decisions.push(d);
  }
  stats.tags = stats.tags.size;
  return { batch: { decisions }, stats };
}

/** Entry — `maude kg import`. Dispatched from cli/commands/kg.mjs verbImport. */
export async function run({ args, state, projectRoot, runKg }) {
  // `args` here is already the verb's args (kg.mjs stripped the `import` token).
  const { flags } = parseArgs(args, { booleans: ['dry-run', 'design', 'force'] });
  const decisionsDir = join(projectRoot, '.ai', 'decisions');
  if (!existsSync(decisionsDir)) {
    process.stderr.write(
      `maude kg import: no .ai/decisions/ under ${projectRoot}. Nothing to migrate.\n`
    );
    return 1;
  }
  if (flags.design) {
    process.stderr.write(
      'maude kg import --design: the .design/ importer (canvas:/ds:/footage:/reel:) is a follow-up — not yet implemented.\n'
    );
    return 1;
  }

  const marker = join(projectRoot, '.ai', '.kgai-migrated');
  if (existsSync(marker) && !flags.force && !flags['dry-run']) {
    process.stderr.write(
      `maude kg import: already migrated (${marker} exists). Re-run with --force to ingest again (adds duplicate decision events).\n`
    );
    return 1;
  }

  const { batch, stats } = buildDdrBatch(decisionsDir, state.scope);
  const totalMuts = batch.decisions.reduce((n, d) => n + d.mutations.length, 0);

  process.stdout.write(
    `maude kg import${flags['dry-run'] ? ' (dry-run)' : ''}\n` +
      `  source:     ${decisionsDir}\n` +
      `  scope:      ${JSON.stringify(state.scope)}\n` +
      `  decisions:  ${batch.decisions.length}\n` +
      `  mutations:  ${totalMuts}\n` +
      `  with date:  ${stats.withDate}   with tags: ${stats.withTags}   cross-refs: ${stats.crossrefs}   distinct tags: ${stats.tags}\n`
  );

  if (flags['dry-run']) {
    const sample = batch.decisions[0];
    if (sample) {
      process.stdout.write(
        `  sample:     ${sample.title}\n              ${JSON.stringify(sample.mutations.slice(0, 4))}\n`
      );
    }
    process.stdout.write(
      '  (dry-run — nothing written. `.ai/decisions/` is preserved as archive.)\n'
    );
    return 0;
  }

  if (!state.active) {
    process.stderr.write(
      'maude kg import: kgai is inactive here (mode/off or no kg/store). Run `maude kg doctor`.\n'
    );
    return 1;
  }

  // Write the batch to a temp file and ingest via `kg ingest --file` (avoids stdin plumbing).
  const tmp = join(
    tmpdir(),
    `kg-import-${state.scope.repo || 'repo'}-${batch.decisions.length}.json`
  );
  writeFileSync(tmp, JSON.stringify(batch));
  const status = runKg(['ingest', '--file', tmp]);
  if (status === 0) {
    writeFileSync(
      marker,
      `migrated ${batch.decisions.length} decisions on ${new Date().toISOString()}\n`
    );
    process.stdout.write(
      `  ✓ ingested. Marker: ${marker} (re-import needs --force). Archive kept: ${decisionsDir}\n`
    );
  }
  return status;
}
