// Fix 4 of the 2026-08-10 sync RCA — the one-shot quarantine of pre-fix-5
// flat fallback twins. The rules under test: a flat body moves ONLY when a
// grouped twin of the same slug exists; siblings ride along; annotations stay
// (they serve the surviving twin); a lone flat canvas is somebody's work and
// never moves; a second run is a no-op; nothing ever throws into boot.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { migrateFlatFallback } from '../sync/migrate-flat-fallback.ts';

let designRoot: string;

beforeEach(() => {
  designRoot = mkdtempSync(join(tmpdir(), 'migrate-flat-'));
});

afterEach(() => {
  rmSync(designRoot, { recursive: true, force: true });
});

const run = () => migrateFlatFallback({ designRoot, designRel: '.design', log: () => {} });

describe('migrateFlatFallback — quarantine the redundant flat copy, never work', () => {
  test('a collision pair: the flat copy (+ siblings) moves to _trash, the grouped twin stays', () => {
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    writeFileSync(join(designRoot, 'ui/welcome.tsx'), 'grouped\n');
    writeFileSync(join(designRoot, 'ui-welcome.tsx'), 'flat stub\n');
    writeFileSync(join(designRoot, 'ui-welcome.meta.json'), '{}\n');
    writeFileSync(join(designRoot, 'ui-welcome.css'), '.x{}\n');
    // Annotations are keyed by the flat slug and serve the SURVIVING twin.
    writeFileSync(join(designRoot, 'ui-welcome.annotations.svg'), '<svg/>\n');

    const moves = run();

    expect(moves).toHaveLength(1);
    expect(moves[0].slug).toBe('ui-welcome');
    expect(moves[0].from).toBe('ui-welcome.tsx');
    expect(moves[0].keptTwin).toBe('ui/welcome.tsx');

    expect(existsSync(join(designRoot, 'ui/welcome.tsx'))).toBe(true);
    expect(existsSync(join(designRoot, 'ui-welcome.tsx'))).toBe(false);
    expect(existsSync(join(designRoot, 'ui-welcome.meta.json'))).toBe(false);
    expect(existsSync(join(designRoot, 'ui-welcome.css'))).toBe(false);
    expect(existsSync(join(designRoot, 'ui-welcome.annotations.svg'))).toBe(true);

    const trashed = readdirSync(join(designRoot, moves[0].trashedTo)).sort();
    expect(trashed).toEqual(['ui-welcome.css', 'ui-welcome.meta.json', 'ui-welcome.tsx']);
  });

  test('a lone flat canvas has no twin — it is somebody’s work and stays put', () => {
    writeFileSync(join(designRoot, 'scratch-pad.tsx'), 'mine\n');
    expect(run()).toEqual([]);
    expect(existsSync(join(designRoot, 'scratch-pad.tsx'))).toBe(true);
  });

  test('a grouped file with no flat twin is untouched', () => {
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    writeFileSync(join(designRoot, 'ui/card.tsx'), 'x\n');
    expect(run()).toEqual([]);
    expect(existsSync(join(designRoot, 'ui/card.tsx'))).toBe(true);
  });

  test('the second run is a no-op — the quarantine dir is runtime state the scan skips', () => {
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    writeFileSync(join(designRoot, 'ui/welcome.tsx'), 'grouped\n');
    writeFileSync(join(designRoot, 'ui-welcome.tsx'), 'flat stub\n');

    expect(run()).toHaveLength(1);
    expect(run()).toEqual([]);
    // The quarantined copy is still there — moved, never deleted.
    const trash = readdirSync(join(designRoot, '_trash'));
    expect(trash).toHaveLength(1);
  });

  test('nested twins at any depth count', () => {
    mkdirSync(join(designRoot, 'ui/2026/social'), { recursive: true });
    writeFileSync(join(designRoot, 'ui/2026/social/summer-camp.tsx'), 'deep\n');
    writeFileSync(join(designRoot, 'ui-2026-social-summer-camp.tsx'), 'flat stub\n');

    const moves = run();
    expect(moves).toHaveLength(1);
    expect(moves[0].keptTwin).toBe('ui/2026/social/summer-camp.tsx');
    expect(existsSync(join(designRoot, 'ui/2026/social/summer-camp.tsx'))).toBe(true);
  });

  test('a missing design root is a quiet no-op, not a throw', () => {
    expect(
      migrateFlatFallback({
        designRoot: join(designRoot, 'does-not-exist'),
        designRel: '.design',
        log: () => {},
      })
    ).toEqual([]);
  });
});
