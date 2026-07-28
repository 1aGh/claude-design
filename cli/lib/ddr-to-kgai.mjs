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

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
  const reversed = [];
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
  // Then bare mentions. NOT blindly `references`: a supersede is often declared
  // in prose rather than a typed marker — e.g. DDR-006's `**Status:** Superseded
  // by [DDR-191](…)`, or DDR-191's `**Related:** [DDR-006] (superseded by this
  // DDR)`. Marker-only classification silently downgrades both to `references`
  // and the supersede chain — the single most useful edge in the graph — is lost.
  // So sniff a ±80-char window around each bare mention for intent keywords
  // (restores the behavior of the scripts/kgai-smoke prototype).
  for (const d of text.matchAll(/DDR-(\d+)/g)) {
    const tgt = d[1].padStart(3, '0');
    // A typed marker is an EXPLICIT statement of intent — never let a keyword
    // that merely happens to sit within the window override it. (Caught by test:
    // "We replace the earlier approach. See … DDR-003" hijacked DDR-003's
    // `**Related:**` REFERENCES into OVERRIDES.)
    // Also skip a target already captured as a REVERSED edge — otherwise a
    // later, non-passive mention in the same file adds the opposite direction
    // too and we are back to an unusable bidirectional pair.
    if (tgt in out || reversed.some(([t]) => t === tgt)) continue;
    const before = text.slice(Math.max(0, d.index - 80), d.index).toLowerCase();
    const ctx = text.slice(Math.max(0, d.index - 80), d.index + d[0].length + 80).toLowerCase();
    // DIRECTION matters, and prose states it both ways: DDR-006 says "Superseded
    // by DDR-191" (the MENTION is the superseder) while DDR-191 says it
    // supersedes DDR-006 (SELF is). Without this the graph gets a bidirectional
    // SUPERSEDES pair and "what replaced X" becomes unanswerable. Passive voice
    // right before the mention ⇒ emit the edge reversed.
    const passive = /(superseded|replaced|overridden|retired|deprecated)\s+(by|in)\s*\[?$/.test(
      before
    );
    let kind = 'references';
    if (/supersed/.test(ctx)) kind = 'supersedes';
    else if (/\b(override|reverse[sd]?|replaces?|retire[sd]?|deprecat)/.test(ctx))
      kind = 'overrides';
    else if (/\bextend|amend/.test(ctx)) kind = 'extends';
    // Self-guard applies to BOTH branches: `put()` has one, and the reversed
    // path needs it too — DDR-025's own body says "partially superseded by
    // DDR-025", which produced a `DDR-025 ⇒ DDR-025` self-loop and made "what
    // superseded DDR-025" answer itself.
    if (tgt === selfNum) continue;
    if (passive && kind !== 'references') reversed.push([tgt, kind]);
    else put(tgt, kind);
  }
  return { out, reversed };
}

/** Build the kgai batch from a decisions dir. Pure. */
export function buildDdrBatch(decisionsDir, scope = {}, only = null) {
  const files = readdirSync(decisionsDir)
    .filter((f) => /^DDR-\d+.*\.md$/.test(f))
    // `only` = incremental mode: ingest just these (substring match on the
    // filename, so `DDR-191` or a full path both work). Re-ingesting an existing
    // DDR is SAFE and is how you refresh one whose file changed — deterministic
    // `hash(kind:name)` converges the element and props merge on re-upsert; it
    // only appends one more decision event, which is the honest record of "this
    // was re-recorded". Bulk re-import is what you must not do casually.
    .filter(
      (f) => !only || only.some((o) => f.includes(o.replace(/^.*\//, '').replace(/\.md$/, '')))
    )
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
    const { out: refs, reversed: revRefs } = crossRefs(t, num);
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
      {
        op: 'upsert_element',
        kind: 'decision',
        name: self,
        // `path` makes the graph an INDEX INTO the archive rather than a lossy
        // copy of it: the migration keeps only title + the first Decision/Context
        // paragraph (~3% of the file), so a hit has to be able to say WHICH file
        // holds the alternatives/consequences. `.ai/decisions/*.md` IS committed,
        // so the pointer always resolves.
        props: {
          title: title.slice(0, 120),
          path: `.ai/decisions/${f}`,
          ...(date ? { date } : {}),
          ...(tags.length ? { tags: tags.join(',') } : {}),
        },
      },
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
    // Passive-voice mentions ("Superseded by DDR-191") — the MENTION supersedes
    // SELF, so the edge points the other way.
    for (const [tgt, kind] of revRefs) {
      muts.push({ op: 'upsert_element', kind: 'decision', name: `DDR-${tgt}` });
      muts.push({
        op: 'add_link',
        from: `decision:DDR-${tgt}`,
        to: `decision:${self}`,
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

/**
 * `.ai/logs/**` → dated verdict/finding decisions.
 *
 * These are a DIFFERENT case from DDRs and the extraction reflects it: `.ai/logs/`
 * is **gitignored** (the repo files it under "AI workflow runtime" beside
 * device/browser/cache), so unlike `.ai/decisions/*.md` these 123 files exist only
 * on the machine that produced them — while 164 committed references point AT them.
 * Once ingested, the graph (whose log IS committed) becomes the only inheritable
 * copy, so we keep a much larger excerpt than the DDR path does (which can afford
 * to be a thin index because its prose is versioned).
 */
export function buildLogBatch(logsDir, scope = {}) {
  const KINDS = {
    rca: 'rca',
    'system-reviews': 'system-review',
    'code-reviews': 'code-review',
    'security-reviews': 'security-review',
    'execution-reports': 'execution-report',
  };
  const decisions = [];
  const stats = { files: 0, withDate: 0, cited: 0, byKind: {} };
  const scopeMuts = (name, kind) => {
    const m = [];
    if (scope.repo) {
      m.push({ op: 'upsert_element', kind: 'repo', name: scope.repo });
      m.push({
        op: 'add_link',
        from: `${kind}:${name}`,
        to: `repo:${scope.repo}`,
        link: 'IN_REPO',
      });
    }
    if (scope.dept) {
      m.push({ op: 'upsert_element', kind: 'dept', name: scope.dept });
      m.push({
        op: 'add_link',
        from: `${kind}:${name}`,
        to: `dept:${scope.dept}`,
        link: 'IN_DEPT',
      });
    }
    return m;
  };

  for (const [dir, kind] of Object.entries(KINDS)) {
    const abs = join(logsDir, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)
      .filter((x) => x.endsWith('.md'))
      .sort()) {
      const path = join(abs, f);
      const t = readFileSync(path, 'utf8');
      stats.files++;
      stats.byKind[kind] = (stats.byKind[kind] ?? 0) + 1;
      const slug = f.replace(/\.md$/, '');
      const title = (t.match(/^#\s*(.+)$/m) || [null, slug])[1].trim();
      // Only 34/123 carry a `**Date:**`; the rest are untracked so git has no
      // creation date either — fall back to the file's own mtime.
      const date = normDate(field(t, 'Date')) || statSync(path).mtime.toISOString().slice(0, 10);
      if (normDate(field(t, 'Date'))) stats.withDate++;
      // Prefer an explicit Summary/Verdict section; else the lead paragraph.
      const body =
        firstPara(t, 'Summary') ||
        firstPara(t, 'Verdict') ||
        firstPara(t, 'Root cause') ||
        t
          .split('\n')
          .filter((l) => l.trim() && !l.startsWith('#'))
          .slice(0, 3)
          .join(' ');
      const rationale = body.replace(/\s+/g, ' ').slice(0, 1200);

      const muts = [
        {
          op: 'upsert_element',
          kind,
          name: slug,
          props: { title: title.slice(0, 160), path: `.ai/logs/${dir}/${f}`, date },
        },
        { op: 'upsert_element', kind: 'area', name: kind },
        { op: 'add_link', from: `${kind}:${slug}`, to: `area:${kind}`, link: 'ABOUT' },
        ...scopeMuts(slug, kind),
      ];
      // Evidence edges — a review/RCA that cites a DDR is evidence ABOUT it.
      const cited = new Set([...t.matchAll(/DDR-(\d+)/g)].map((m) => m[1].padStart(3, '0')));
      for (const num of cited) {
        muts.push({ op: 'upsert_element', kind: 'decision', name: `DDR-${num}` });
        muts.push({
          op: 'add_link',
          from: `${kind}:${slug}`,
          to: `decision:DDR-${num}`,
          link: 'EVIDENCE_FOR',
        });
        stats.cited++;
      }
      decisions.push({ title, date, rationale, mutations: muts });
    }
  }
  return { batch: { decisions }, stats };
}

/** Entry — `maude kg import`. Dispatched from cli/commands/kg.mjs verbImport. */
export async function run({ args, state, projectRoot, runKg }) {
  // `args` here is already the verb's args (kg.mjs stripped the `import` token).
  const { flags } = parseArgs(args, { booleans: ['dry-run', 'design', 'force', 'no-logs'] });
  const only = flags.only
    ? String(flags.only)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : null;
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
  if (existsSync(marker) && !flags.force && !flags['dry-run'] && !only) {
    process.stderr.write(
      `maude kg import: already migrated (${marker} exists). Re-run with --force to ingest again (adds duplicate decision events).\n`
    );
    return 1;
  }

  const { batch, stats } = buildDdrBatch(decisionsDir, state.scope, only);

  // `.ai/logs/**` rides the same import unless --no-logs. Deliberately NOT a
  // separate opt-in verb: these files are gitignored, so leaving them out is how
  // the RCA/security-review knowledge stays machine-local and dies on a clone.
  const logsDir = join(projectRoot, '.ai', 'logs');
  let logStats = null;
  if (!only && !flags['no-logs'] && existsSync(logsDir)) {
    const logs = buildLogBatch(logsDir, state.scope);
    logStats = logs.stats;
    batch.decisions.push(...logs.batch.decisions);
  }

  const totalMuts = batch.decisions.reduce((n, d) => n + d.mutations.length, 0);

  process.stdout.write(
    `maude kg import${flags['dry-run'] ? ' (dry-run)' : ''}\n` +
      `  source:     ${decisionsDir}\n` +
      `  scope:      ${JSON.stringify(state.scope)}\n` +
      `  decisions:  ${batch.decisions.length}\n` +
      `  mutations:  ${totalMuts}\n` +
      `  with date:  ${stats.withDate}   with tags: ${stats.withTags}   cross-refs: ${stats.crossrefs}   distinct tags: ${stats.tags}\n` +
      (logStats
        ? `  logs:       ${logStats.files} (${Object.entries(logStats.byKind)
            .map(([k, n]) => `${k}:${n}`)
            .join(' ')}), ${logStats.cited} evidence edges\n`
        : '  logs:       skipped (--no-logs)\n')
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
