// Maude design-runtime .gitignore block — Phase 9 Task 9 (gitignore strategy).
//
// Single `full` strategy in v1.1 (DDR-056): canvases + their JSON snapshots
// stay in git (cold backup, PR-reviewable .html diffs, bootstrap-from-clone),
// while regenerable per-machine runtime state is ignored — even in linked mode.
//
// The rules live between `# maude:begin` / `# maude:end` markers so the writer
// is idempotent: re-running replaces the block in place (never duplicates), and
// anything the user authored outside the markers is untouched. `maude design
// unlink` deliberately leaves the block — the rules are harmless in solo mode
// (the ignored files just don't get created).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const BEGIN_MARKER = '# maude:begin';
export const END_MARKER = '# maude:end';

/**
 * The runtime paths Maude ignores under the design root, relative to repo root.
 * `designRel` defaults to `.design` (the only design root in v1.1 defaults).
 */
export function buildBlock(designRel = '.design') {
  const root = designRel.replace(/\/+$/, '');
  const lines = [
    BEGIN_MARKER,
    '# Maude design plugin runtime — gitignored even in linked mode (DDR-056).',
    `${root}/_state/`, // binary CRDT logs (regenerable from hub)
    `${root}/_server.json`,
    `${root}/_server.log`,
    `${root}/_active.json`,
    `${root}/_sync.json`, // linked-mode offline/sync status (Task 8)
    `${root}/_history/`,
    `${root}/_draw/`, // draw-agent proof canvases (regenerable — Phase 25)
    `${root}/_canvas-state/`, // per-machine canvas undo/redo + scratch state
    `${root}/_chat/`, // ACP transcripts (per-machine)
    END_MARKER,
  ];
  return `${lines.join('\n')}\n`;
}

/** True when the file already contains a maude-managed block. */
export function hasBlock(contents) {
  return contents.includes(BEGIN_MARKER) && contents.includes(END_MARKER);
}

/**
 * Replace the existing maude block in `contents`, or append a fresh one.
 * Pure — returns the new file text. Preserves everything outside the markers.
 */
export function applyBlock(contents, block) {
  if (!hasBlock(contents)) {
    // Append with a single blank-line separator (avoid leading newline on an
    // empty file; avoid double-blank when the file already ends in a newline).
    if (contents.length === 0) return block;
    const sep = contents.endsWith('\n') ? '\n' : '\n\n';
    return `${contents}${sep}${block}`;
  }
  const begin = contents.indexOf(BEGIN_MARKER);
  const endIdx = contents.indexOf(END_MARKER);
  const after = endIdx + END_MARKER.length;
  // Consume one trailing newline after END so we don't accumulate blank lines.
  const tail = contents.slice(after).replace(/^\n/, '');
  const head = contents.slice(0, begin);
  return `${head}${block}${tail ? `\n${tail}` : ''}`;
}

/**
 * Write (or refresh) the maude block in `<repoRoot>/.gitignore`.
 *
 * @param {string} repoRoot
 * @param {{ designRel?: string, dryRun?: boolean }} [opts]
 * @returns {{ action: 'created' | 'updated' | 'unchanged', path: string }}
 */
export function writeGitignoreBlock(repoRoot, { designRel = '.design', dryRun = false } = {}) {
  const path = resolve(repoRoot, '.gitignore');
  const existed = existsSync(path);
  const current = existed ? readFileSync(path, 'utf8') : '';
  const block = buildBlock(designRel);
  const next = applyBlock(current, block);

  let action;
  if (!existed) action = 'created';
  else if (next === current) action = 'unchanged';
  else action = 'updated';

  if (!dryRun && next !== current) {
    writeFileSync(path, next, 'utf8');
  }
  return { action, path };
}
