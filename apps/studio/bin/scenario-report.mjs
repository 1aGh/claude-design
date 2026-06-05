#!/usr/bin/env node
// scenario-report.mjs — deterministic cross-platform scenario report generator.
//
// Phase C / DDR-061. Resolves the long-standing "report generator" TODO in
// plugins/flow/skills/scenario/SKILL.md. Walks a scenario run directory and
// emits the mechanical sections of report.md (TL;DR table, counter-delta table,
// per-step pivot, collapsed path-listing). The LLM authors ONLY the prose
// sections ("What surprised us", "Recommended follow-ups") — they're left as
// marked placeholders for it to fill in.
//
// Invoked from flow markdown via the on-PATH `maude` binary (DDR-062):
//   maude scenario-report <run-dir> [--out <path>]
// or directly:
//   node scenario-report.mjs <run-dir> [--out <path>]
//
// Input layout (produced by the scenario runners — see scenario SKILL.md):
//   <run-dir>/
//   ├── <platform>/result.txt          # "pass" | "fail: <reason>" | "skipped: <reason>"
//   ├── <platform>/step-<N>-<desc>.png  # per-step screenshots
//   └── <platform>/counters.json        # OPTIONAL { "mastered": "+3", "remaining": "-3" }
//
// Output: <run-dir>/report.md (or --out), zero external dependencies (node:fs only).

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const PLATFORM_ORDER = ['web-desktop', 'web-mobile', 'ios-phone', 'ios-tablet', 'android-phone'];

const toolingFor = (platform) => (platform.startsWith('web-') ? 'agent-browser' : 'agent-device');

// Parse "pass" / "fail: reason" / "skipped: reason" → { result, reason }.
function parseResult(text) {
  const t = (text || '').trim();
  if (!t) return { result: 'UNKNOWN', reason: 'no result.txt' };
  const lower = t.toLowerCase();
  if (lower.startsWith('pass')) return { result: 'PASS', reason: '' };
  if (lower.startsWith('fail')) return { result: 'FAIL', reason: t.replace(/^fail[:\s]*/i, '') };
  if (lower.startsWith('skip'))
    return { result: 'SKIPPED', reason: t.replace(/^skip(ped)?[:\s]*/i, '') };
  return { result: 'UNKNOWN', reason: t.slice(0, 80) };
}

const SYM = { PASS: '✅', FAIL: '❌', SKIPPED: '⏭️', UNKNOWN: '❓' };

// Extract the numeric step index from "step-7-card-1-back.png" → 7.
function stepIndex(file) {
  const m = /^step-(\d+)/.exec(file);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

function readPlatform(runDir, platform) {
  const dir = join(runDir, platform);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return null;
  const resultPath = join(dir, 'result.txt');
  const { result, reason } = parseResult(
    existsSync(resultPath) ? readFileSync(resultPath, 'utf8') : ''
  );
  const steps = readdirSync(dir)
    .filter((f) => /^step-\d+.*\.png$/.test(f))
    .sort((a, b) => stepIndex(a) - stepIndex(b) || a.localeCompare(b));
  let counters = null;
  const countersPath = join(dir, 'counters.json');
  if (existsSync(countersPath)) {
    try {
      counters = JSON.parse(readFileSync(countersPath, 'utf8'));
    } catch {
      /* malformed counters — treated as absent */
    }
  }
  return { platform, result, reason, steps, counters };
}

export function generateReport(runDir) {
  if (!existsSync(runDir) || !statSync(runDir).isDirectory()) {
    throw new Error(`scenario-report: run dir not found: ${runDir}`);
  }
  // Discover platforms: known order first, then any extra subdirs present.
  const present = readdirSync(runDir).filter((n) => {
    const p = join(runDir, n);
    return statSync(p).isDirectory() && existsSync(join(p, 'result.txt'));
  });
  const ordered = [
    ...PLATFORM_ORDER.filter((p) => present.includes(p)),
    ...present.filter((p) => !PLATFORM_ORDER.includes(p)),
  ];
  const platforms = ordered.map((p) => readPlatform(runDir, p)).filter(Boolean);

  const scenarioName =
    basename(join(runDir, '..', '..')) === '.' ? 'scenario' : basename(join(runDir, '..'));
  const out = [];
  out.push(`# Scenario report — ${scenarioName}`);
  out.push('');
  out.push(`_generated ${new Date().toISOString()} · run: \`${runDir}\`_`);
  out.push('');

  // ── TL;DR ──────────────────────────────────────────────────────────────
  out.push('## TL;DR');
  out.push('');
  out.push('| Platform | Result | Steps reached | Tooling |');
  out.push('| --- | --- | --- | --- |');
  for (const p of platforms) {
    const detail = p.reason ? ` — ${p.reason}` : '';
    out.push(
      `| ${p.platform} | ${SYM[p.result]} ${p.result}${detail} | ${p.steps.length} | ${toolingFor(p.platform)} |`
    );
  }
  out.push('');

  // ── Counter-delta ──────────────────────────────────────────────────────
  const counterKeys = [
    ...new Set(platforms.flatMap((p) => (p.counters ? Object.keys(p.counters) : []))),
  ];
  out.push('## Counter delta (cross-platform parity)');
  out.push('');
  if (counterKeys.length === 0) {
    out.push(
      '_No `counters.json` recorded for any platform. Add `<platform>/counters.json` ' +
        '(e.g. `{"mastered":"+3","remaining":"-3"}`) in the runners to enable the parity check._'
    );
  } else {
    out.push(`| Platform | ${counterKeys.map((k) => `\`${k}\` Δ`).join(' | ')} |`);
    out.push(`| --- | ${counterKeys.map(() => '---').join(' | ')} |`);
    for (const p of platforms) {
      const cells = counterKeys.map((k) =>
        p.counters && p.counters[k] != null ? p.counters[k] : '—'
      );
      out.push(`| ${p.platform} | ${cells.join(' | ')} |`);
    }
    out.push('');
    // Parity verdict: identical non-skipped rows = verified.
    const nonSkipped = platforms.filter((p) => p.result !== 'SKIPPED' && p.counters);
    const sigs = new Set(nonSkipped.map((p) => counterKeys.map((k) => p.counters[k]).join('|')));
    out.push(
      sigs.size <= 1
        ? '**Parity: ✅ identical counter deltas across all non-skipped platforms.**'
        : '**Parity: ❌ counter deltas diverge across platforms — investigate (a divergence needs a DDR or a fix).**'
    );
  }
  out.push('');

  // ── Per-step pivot ─────────────────────────────────────────────────────
  const allStepIdx = [
    ...new Set(platforms.flatMap((p) => p.steps.map(stepIndex)).filter(Number.isFinite)),
  ].sort((a, b) => a - b);
  out.push('## Per-step screenshots (pivot)');
  out.push('');
  if (allStepIdx.length === 0) {
    out.push('_No `step-*.png` screenshots found in any platform directory._');
  } else {
    out.push(`| Platform | ${allStepIdx.map((n) => `Step ${n}`).join(' | ')} |`);
    out.push(`| --- | ${allStepIdx.map(() => '---').join(' | ')} |`);
    for (const p of platforms) {
      const cells = allStepIdx.map((n) => {
        const file = p.steps.find((f) => stepIndex(f) === n);
        return file ? `![](${p.platform}/${file})` : '';
      });
      out.push(`| ${p.platform} | ${cells.join(' | ')} |`);
    }
  }
  out.push('');

  // ── LLM prose placeholders ─────────────────────────────────────────────
  out.push('## What surprised us');
  out.push('');
  out.push(
    '<!-- LLM-AUTHORED: replace this line with non-obvious findings — UX divergence, broken expectations, unexpected counter math, mid-run state changes. Delete this comment. -->'
  );
  out.push('');
  out.push('## Recommended follow-ups');
  out.push('');
  out.push(
    '<!-- LLM-AUTHORED: replace this line with a prioritized list of codebase changes that would make this scenario more reliable (missing testIDs, fragile selectors, parity gaps). Delete this comment. -->'
  );
  out.push('');

  // ── Collapsed path listing ─────────────────────────────────────────────
  out.push('<details>');
  out.push('<summary>All screenshot paths (per platform)</summary>');
  out.push('');
  for (const p of platforms) {
    out.push(`**${p.platform}** (${p.result})`);
    for (const f of p.steps) out.push(`- \`${p.platform}/${f}\``);
    out.push('');
  }
  out.push('</details>');
  out.push('');

  return out.join('\n');
}

// ── CLI entrypoint ───────────────────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const runDir = args.find((a) => !a.startsWith('--'));
  if (!runDir) {
    process.stderr.write('usage: scenario-report <run-dir> [--out <path>]\n');
    process.exit(2);
  }
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 ? args[outIdx + 1] : join(runDir, 'report.md');
  const md = generateReport(runDir);
  writeFileSync(outPath, md, 'utf8');
  process.stdout.write(`${outPath}\n`);
}

// Run as a script (not when imported). `import.meta.main` is Bun; the argv[1]
// check covers Node.
const invokedDirectly = import.meta.main || process.argv[1]?.endsWith('scenario-report.mjs');
if (invokedDirectly) main(process.argv);
