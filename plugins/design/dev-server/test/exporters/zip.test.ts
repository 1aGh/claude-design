// Phase 6.5 T7 — project-raw ZIP adapter tests.
//
// Real walk + bundle against a sandboxed designRoot, then unzip the result
// and diff against expected contents.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import JSZip from 'jszip';

import { resolveScope } from '../../exporters/scope.ts';
import { run } from '../../exporters/zip.ts';

function setupTree(): { root: string; designRoot: string } {
  const root = mkdtempSync(join(tmpdir(), 'zip-adapter-'));
  const designRoot = join(root, '.design');
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  mkdirSync(join(designRoot, 'system', 'project'), { recursive: true });
  mkdirSync(join(designRoot, '_history', 'old'), { recursive: true });
  writeFileSync(join(designRoot, 'config.json'), '{"name":"x"}');
  writeFileSync(join(designRoot, 'README.md'), '# proj');
  writeFileSync(join(designRoot, 'ui', 'Home.tsx'), 'export default ()=>null');
  writeFileSync(join(designRoot, 'system', 'project', 'README.md'), '# ds');
  writeFileSync(join(designRoot, '_history', 'old', 'snap.tsx'), '// snap');
  writeFileSync(join(designRoot, '.DS_Store'), ' ');
  return { root, designRoot };
}

describe('zip adapter — project-raw', () => {
  test('bundles designRoot and excludes runtime artefacts by default', async () => {
    const { root, designRoot } = setupTree();
    const targets = await resolveScope({
      scope: 'project-raw',
      activeJson: { active: null, selected: null },
      designRoot,
      repoRoot: root,
    });
    const r = await run(targets, {}, { designRoot, repoRoot: root, serverOrigin: '' });
    expect(r.contentType).toBe('application/zip');
    expect(r.body.byteLength).toBeGreaterThan(0);

    const unzipped = await JSZip.loadAsync(r.body);
    const names = Object.keys(unzipped.files).sort();
    expect(names).toContain('config.json');
    expect(names).toContain('README.md');
    expect(names).toContain('ui/Home.tsx');
    expect(names).toContain('system/project/README.md');
    expect(names).not.toContain('.DS_Store');
    expect(names.every((n) => !n.startsWith('_history/'))).toBe(true);
  });

  test('options.exclude prunes additional paths', async () => {
    const { root, designRoot } = setupTree();
    const targets = await resolveScope({
      scope: 'project-raw',
      activeJson: { active: null, selected: null },
      designRoot,
      repoRoot: root,
    });
    const r = await run(
      targets,
      { exclude: ['ui/**'] },
      { designRoot, repoRoot: root, serverOrigin: '' }
    );
    const unzipped = await JSZip.loadAsync(r.body);
    const names = Object.keys(unzipped.files);
    expect(names.every((n) => !n.startsWith('ui/'))).toBe(true);
    expect(names).toContain('system/project/README.md');
  });

  test('options.include narrows to a single subtree', async () => {
    const { root, designRoot } = setupTree();
    const targets = await resolveScope({
      scope: 'project-raw',
      activeJson: { active: null, selected: null },
      designRoot,
      repoRoot: root,
    });
    const r = await run(
      targets,
      { include: ['system'] },
      { designRoot, repoRoot: root, serverOrigin: '' }
    );
    const unzipped = await JSZip.loadAsync(r.body);
    const names = Object.keys(unzipped.files);
    expect(names.every((n) => n.startsWith('system/'))).toBe(true);
  });

  test('empty targets → zero-byte ZIP placeholder', async () => {
    const r = await run([], {}, { designRoot: '/tmp/.design', repoRoot: '/tmp', serverOrigin: '' });
    expect(r.body.byteLength).toBe(0);
  });

  test('element targets → throws', async () => {
    await expect(
      run(
        [{ kind: 'element', cssPath: '.x', canvasSlug: 'x', file: 'ui/x.tsx' }],
        {},
        { designRoot: '/tmp/.design', repoRoot: '/tmp', serverOrigin: '' }
      )
    ).rejects.toThrow(/file-tree targets/i);
  });
});
