// Acting on a deletion the project stated — see sync/tombstone-apply.ts.
//
// The rule under test is the one that makes it acceptable for a hub signal to
// remove local files at all: QUARANTINE, NEVER DELETE.

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { quarantineCanvas } from '../sync/tombstone-apply.ts';

function project(lanes: string[]): string {
  const root = mkdtempSync(path.join(tmpdir(), 'maude-tombstone-'));
  mkdirSync(path.join(root, 'ui'), { recursive: true });
  for (const lane of lanes) {
    const abs = path.join(root, lane);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, `contents of ${lane}`);
  }
  return root;
}

function lanesFor(root: string) {
  return {
    html: path.join(root, 'ui/card.tsx'),
    meta: path.join(root, 'ui/card.meta.json'),
    css: path.join(root, 'ui/card.css'),
    annotations: path.join(root, 'ui-card.annotations.svg'),
  };
}

describe('quarantineCanvas', () => {
  test('moves the canvas out of the tree and into _trash, never deleting it', () => {
    const root = project([
      'ui/card.tsx',
      'ui/card.meta.json',
      'ui/card.css',
      'ui-card.annotations.svg',
    ]);
    const move = quarantineCanvas({
      designRoot: root,
      slug: 'ui-card',
      lanes: lanesFor(root),
      now: 1234,
      log: () => {},
    });

    expect(move?.trashedTo).toBe('_trash/ui-card-deleted-1234');
    // Gone from the tree...
    expect(existsSync(path.join(root, 'ui/card.tsx'))).toBe(false);
    // ...and recoverable, which is the whole point.
    const trashed = readdirSync(path.join(root, '_trash/ui-card-deleted-1234')).sort();
    expect(trashed).toEqual(['card.css', 'card.meta.json', 'card.tsx', 'ui-card.annotations.svg']);
  });

  test('the annotations sidecar travels with the body', () => {
    // A body stripped of its annotations is not a restorable canvas — the
    // sidecar lives at the design root under the flat slug, so it is the one
    // lane a naive "move the folder" would leave behind.
    const root = project(['ui/card.tsx', 'ui-card.annotations.svg']);
    quarantineCanvas({
      designRoot: root,
      slug: 'ui-card',
      lanes: lanesFor(root),
      now: 1,
      log: () => {},
    });
    expect(existsSync(path.join(root, 'ui-card.annotations.svg'))).toBe(false);
    expect(existsSync(path.join(root, '_trash/ui-card-deleted-1/ui-card.annotations.svg'))).toBe(
      true
    );
  });

  test('a canvas already gone is a no-op, not an error', () => {
    // The steady state once both peers have converged: every later poll repeats
    // the same tombstone and must find nothing to do.
    const root = project([]);
    expect(
      quarantineCanvas({ designRoot: root, slug: 'ui-card', lanes: lanesFor(root), log: () => {} })
    ).toBeNull();
    expect(existsSync(path.join(root, '_trash'))).toBe(false);
  });

  test('moves what it can when a lane is missing', () => {
    const root = project(['ui/card.tsx']);
    const move = quarantineCanvas({
      designRoot: root,
      slug: 'ui-card',
      lanes: lanesFor(root),
      now: 7,
      log: () => {},
    });
    expect(move?.moved).toEqual(['ui/card.tsx']);
  });

  test('leaves per-machine runtime state alone', () => {
    // `_history/`, `_comments/` and `_canvas-state/` are per-machine runtime
    // state (DDR-115). Sweeping them would make a recoverable delete lossy.
    const root = project(['ui/card.tsx', '_history/ui-card/1.tsx', '_comments/ui-card.json']);
    quarantineCanvas({
      designRoot: root,
      slug: 'ui-card',
      lanes: lanesFor(root),
      now: 2,
      log: () => {},
    });
    expect(existsSync(path.join(root, '_history/ui-card/1.tsx'))).toBe(true);
    expect(existsSync(path.join(root, '_comments/ui-card.json'))).toBe(true);
  });
});
