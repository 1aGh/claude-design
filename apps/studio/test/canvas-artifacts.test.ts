// canvas-artifacts.ts — the canonical artifact inventory. Pure, no server boot
// needed: cover inventory completeness, the divergent `_locator.json` slug
// shape, and relocatedName()'s path math for both a pure directory move and a
// combined move+rename.

import { describe, expect, test } from 'bun:test';
import path from 'node:path';

import { canvasArtifacts, locatorKeyFor, relocatedName } from '../canvas-artifacts.ts';
import type { Paths } from '../context.ts';

function fakePaths(repoRoot: string): Paths {
  const designRoot = path.join(repoRoot, '.design');
  return {
    repoRoot,
    designRel: '.design',
    designRoot,
    serverInfoFile: path.join(designRoot, '_server.json'),
    activeFile: path.join(designRoot, '_active.json'),
    commentsDir: path.join(designRoot, '_comments'),
    canvasStateDir: path.join(designRoot, '_canvas-state'),
    historyDir: path.join(designRoot, '_history'),
    tokensUrlRel: '.design/system/colors_and_type.css',
    systemDirRel: 'system',
  };
}

describe('canvasArtifacts', () => {
  const paths = fakePaths('/repo');

  test('lists the primary + siblings + every slug-keyed sidecar', () => {
    const artifacts = canvasArtifacts({ rel: 'ui/Foo.tsx', paths });
    const abs = artifacts.map((a) => a.abs);
    expect(abs).toContain(path.join(paths.designRoot, 'ui', 'Foo.tsx'));
    expect(abs).toContain(path.join(paths.designRoot, 'ui', 'Foo.meta.json'));
    expect(abs).toContain(path.join(paths.designRoot, 'ui', 'Foo.css'));
    expect(abs).toContain(path.join(paths.designRoot, 'ui', 'Foo.registry.json'));
    const slug = 'ui-foo';
    expect(abs).toContain(path.join(paths.historyDir, slug));
    expect(abs).toContain(path.join(paths.canvasStateDir, `${slug}.json`));
    expect(abs).toContain(path.join(paths.canvasStateDir, `${slug}.view.json`));
    expect(abs).toContain(path.join(paths.commentsDir, `${slug}.json`));
    expect(abs).toContain(path.join(paths.designRoot, '_state', `${slug}.ydoc.bin`));
    expect(abs).toContain(path.join(paths.designRoot, `${slug}.annotations.svg`));
    expect(abs).toContain(path.join(paths.designRoot, `${slug}.edl.json`));
  });

  test('does NOT include _photo/ or _draw/ (asset-keyed / mark-slug-keyed, not canvas-slug-keyed)', () => {
    const abs = canvasArtifacts({ rel: 'ui/Foo.tsx', paths }).map((a) => a.abs);
    expect(abs.some((p) => p.includes('_photo'))).toBe(false);
    expect(abs.some((p) => p.includes('_draw'))).toBe(false);
  });

  test('marks exactly one primary and the rest sibling/slug-keyed', () => {
    const artifacts = canvasArtifacts({ rel: 'ui/Foo.tsx', paths });
    const primaries = artifacts.filter((a) => a.kind === 'primary');
    expect(primaries.length).toBe(1);
    expect(primaries[0]?.abs).toBe(path.join(paths.designRoot, 'ui', 'Foo.tsx'));
  });

  test('handles a nested rel (subfolder)', () => {
    const artifacts = canvasArtifacts({ rel: 'ui/sub/Bar.tsx', paths });
    const primary = artifacts.find((a) => a.kind === 'primary');
    expect(primary?.abs).toBe(path.join(paths.designRoot, 'ui', 'sub', 'Bar.tsx'));
    const slug = 'ui-sub-bar';
    expect(artifacts.some((a) => a.abs === path.join(paths.historyDir, slug))).toBe(true);
  });
});

describe('locatorKeyFor — the DIVERGENT slug shape', () => {
  test('posix, extension-less, NOT lowercased or dash-flattened', () => {
    expect(locatorKeyFor('ui/Onboarding Brief.tsx')).toBe('ui/Onboarding Brief');
  });

  test('differs from canvasSlugFromRel for a mixed-case / spaced name', () => {
    // canvasSlugFromRel('ui/Onboarding Brief.tsx', ...) => 'ui-onboarding_brief'
    expect(locatorKeyFor('ui/Onboarding Brief.tsx')).not.toBe('ui-onboarding_brief');
  });
});

describe('relocatedName', () => {
  const paths = fakePaths('/repo');

  test('pure directory move (basename unchanged) — siblings track the new dir', () => {
    const artifacts = canvasArtifacts({ rel: 'ui/Foo.tsx', paths });
    const primary = artifacts.find((a) => a.kind === 'primary');
    if (!primary) throw new Error('no primary');
    expect(relocatedName(primary, 'ui/Foo.tsx', 'ui/sub/Foo.tsx', paths)).toBe(
      path.join(paths.designRoot, 'ui', 'sub', 'Foo.tsx')
    );
    const meta = artifacts.find((a) => a.abs.endsWith('Foo.meta.json'));
    if (!meta) throw new Error('no meta sibling');
    expect(relocatedName(meta, 'ui/Foo.tsx', 'ui/sub/Foo.tsx', paths)).toBe(
      path.join(paths.designRoot, 'ui', 'sub', 'Foo.meta.json')
    );
  });

  test('slug-keyed sidecars stay in their fixed dir but re-key the filename', () => {
    const artifacts = canvasArtifacts({ rel: 'ui/Foo.tsx', paths });
    const history = artifacts.find((a) => a.abs === path.join(paths.historyDir, 'ui-foo'));
    if (!history) throw new Error('no history artifact');
    expect(relocatedName(history, 'ui/Foo.tsx', 'ui/sub/Foo.tsx', paths)).toBe(
      path.join(paths.historyDir, 'ui-sub-foo')
    );
    const view = artifacts.find((a) => a.abs.endsWith('ui-foo.view.json'));
    if (!view) throw new Error('no view artifact');
    expect(relocatedName(view, 'ui/Foo.tsx', 'ui/sub/Foo.tsx', paths)).toBe(
      path.join(paths.canvasStateDir, 'ui-sub-foo.view.json')
    );
  });

  test('a rename (same dir, new basename) re-keys both the sibling and the slug-keyed sidecar', () => {
    const artifacts = canvasArtifacts({ rel: 'ui/Foo.tsx', paths });
    const primary = artifacts.find((a) => a.kind === 'primary');
    if (!primary) throw new Error('no primary');
    expect(relocatedName(primary, 'ui/Foo.tsx', 'ui/Bar.tsx', paths)).toBe(
      path.join(paths.designRoot, 'ui', 'Bar.tsx')
    );
    const comments = artifacts.find((a) => a.abs === path.join(paths.commentsDir, 'ui-foo.json'));
    if (!comments) throw new Error('no comments artifact');
    expect(relocatedName(comments, 'ui/Foo.tsx', 'ui/Bar.tsx', paths)).toBe(
      path.join(paths.commentsDir, 'ui-bar.json')
    );
  });
});
