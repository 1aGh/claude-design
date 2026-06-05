import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// `maude scenario-report <run-dir> [--out <path>]` — deterministic cross-platform
// scenario report generator (Phase C / DDR-061). Thin wrapper that resolves the
// bundled generator from maude's OWN package root (NOT $CLAUDE_PLUGIN_ROOT — the
// flow plugin can't reach the studio app's bin dir; only the on-PATH
// `maude` binary resolves it reliably across install shapes — see DDR-062), runs
// it, and writes report.md. Output stdout = the written path (capture idiom).

export async function run({ args, pkgRoot }) {
  const runDir = args.find((a) => !a.startsWith('--'));
  if (!runDir || runDir === 'help') {
    process.stdout.write(
      'maude scenario-report <run-dir> [--out <path>]\n\n' +
        '  Walk a scenario run directory and emit the mechanical sections of report.md\n' +
        '  (TL;DR, counter-delta, per-step pivot, path listing). Leaves the prose sections\n' +
        '  ("What surprised us", "Recommended follow-ups") as placeholders for the LLM.\n' +
        '  Default output: <run-dir>/report.md.\n'
    );
    return;
  }

  const generatorPath = resolve(pkgRoot, 'apps', 'studio', 'bin', 'scenario-report.mjs');
  const { generateReport } = await import(pathToFileURL(generatorPath).href);

  const absRunDir = resolve(process.cwd(), runDir);
  const outIdx = args.indexOf('--out');
  const outPath =
    outIdx >= 0 && args[outIdx + 1]
      ? resolve(process.cwd(), args[outIdx + 1])
      : join(absRunDir, 'report.md');

  const md = generateReport(absRunDir);
  writeFileSync(outPath, md, 'utf8');
  process.stdout.write(`${outPath}\n`);
}
