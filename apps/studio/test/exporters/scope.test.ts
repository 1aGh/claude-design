// Phase 6.5 T1 — scope resolver unit tests.
//
// Pure-function coverage: each of the four scope branches against synthetic
// `_active.json` shapes. `project-raw` exercises the fs walk inside a
// throwaway temp dir; the other three branches don't touch disk.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type ActiveJsonShape, resolveScope } from '../../exporters/scope.ts';

function emptyActive(): ActiveJsonShape {
  return { active: null, selected: null };
}

function activeOn(file: string): ActiveJsonShape {
  return { active: file, selected: null };
}

function activeWithSelection(file: string, selector: string): ActiveJsonShape {
  return { active: file, selected: { file, selector } };
}

describe('resolveScope — selection', () => {
  test('returns 1 element target when a selection is captured', async () => {
    const targets = await resolveScope({
      scope: 'selection',
      activeJson: activeWithSelection('.design/ui/Home.tsx', '#hero > h1'),
      designRoot: '/abs/.design',
    });
    expect(targets).toHaveLength(1);
    const t = targets[0];
    expect(t.kind).toBe('element');
    if (t.kind === 'element') {
      expect(t.cssPath).toBe('#hero > h1');
      expect(t.canvasSlug).toBe('ui-home');
      expect(t.file).toBe('.design/ui/Home.tsx');
    }
  });

  test('falls back to artboard scope when no selection is captured', async () => {
    const targets = await resolveScope({
      scope: 'selection',
      activeJson: activeOn('.design/ui/Home.tsx'),
      designRoot: '/abs/.design',
    });
    expect(targets).toHaveLength(1);
    const t = targets[0];
    expect(t.kind).toBe('element');
    if (t.kind === 'element') {
      // Artboard fallback default selector.
      expect(t.cssPath).toBe('[data-dc-screen]:first-of-type');
      expect(t.multi).toBeUndefined();
    }
  });

  test('returns no targets when nothing is open', async () => {
    const targets = await resolveScope({
      scope: 'selection',
      activeJson: emptyActive(),
      designRoot: '/abs/.design',
    });
    expect(targets).toEqual([]);
  });

  // Items 3 — submit-time selection snapshot + no hard-widen.
  test('prefers the options.selection hint over the persisted _active.json', async () => {
    const targets = await resolveScope({
      scope: 'selection',
      // Persisted selection is stale/cleared; the live snapshot wins.
      activeJson: activeWithSelection('.design/ui/Home.tsx', '#stale'),
      designRoot: '/abs/.design',
      options: { selection: { selector: '#hero .live', file: '.design/ui/Home.tsx' } },
    });
    expect(targets).toHaveLength(1);
    const t = targets[0];
    if (t.kind === 'element') {
      expect(t.cssPath).toBe('#hero .live');
      // selection scope must NOT widen to the artboard (item 3 root cause #2).
      expect(t.widen).toBe(false);
    }
  });

  test('recovers the live selection when _active.json.selected was cleared', async () => {
    const targets = await resolveScope({
      scope: 'selection',
      activeJson: activeOn('.design/ui/Home.tsx'), // selected: null
      designRoot: '/abs/.design',
      options: { selection: { selector: '.card' } },
    });
    expect(targets).toHaveLength(1);
    const t = targets[0];
    if (t.kind === 'element') {
      expect(t.cssPath).toBe('.card');
      expect(t.widen).toBe(false);
    }
  });

  test('a captured selection sets widen=false (exact element, no artboard)', async () => {
    const targets = await resolveScope({
      scope: 'selection',
      activeJson: activeWithSelection('.design/ui/Home.tsx', '#hero > h1'),
      designRoot: '/abs/.design',
    });
    if (targets[0].kind === 'element') expect(targets[0].widen).toBe(false);
  });
});

describe('resolveScope — artboard', () => {
  test('passes the selection selector through to the adapter for ancestor widening', async () => {
    const targets = await resolveScope({
      scope: 'artboard',
      activeJson: activeWithSelection('.design/ui/Home.tsx', '.cta-button'),
      designRoot: '/abs/.design',
    });
    expect(targets).toHaveLength(1);
    const t = targets[0];
    expect(t.kind).toBe('element');
    if (t.kind === 'element') {
      expect(t.cssPath).toBe('.cta-button');
      expect(t.canvasSlug).toBe('ui-home');
    }
  });

  test('defaults to the first artboard when no selection', async () => {
    const targets = await resolveScope({
      scope: 'artboard',
      activeJson: activeOn('.design/ui/Home.tsx'),
      designRoot: '/abs/.design',
    });
    expect(targets).toHaveLength(1);
    if (targets[0].kind === 'element') {
      expect(targets[0].cssPath).toBe('[data-dc-screen]:first-of-type');
    }
  });

  // Item 5 — target the active/selected artboard by id, not `:first-of-type`.
  test('targets the active artboard by id when options.artboardId is set', async () => {
    const targets = await resolveScope({
      scope: 'artboard',
      activeJson: activeOn('.design/ui/Home.tsx'),
      designRoot: '/abs/.design',
      options: { artboardId: 'screen-2' },
    });
    expect(targets).toHaveLength(1);
    const t = targets[0];
    if (t.kind === 'element') {
      expect(t.cssPath).toBe('[data-dc-screen="screen-2"]');
      // The element IS the artboard — no widening needed (PDF shim never widens).
      expect(t.widen).toBe(false);
    }
  });

  test('artboardId wins over a captured selection selector', async () => {
    const targets = await resolveScope({
      scope: 'artboard',
      activeJson: activeWithSelection('.design/ui/Home.tsx', '.cta-button'),
      designRoot: '/abs/.design',
      options: { artboardId: 'screen-3', selection: { selector: '.cta-button' } },
    });
    if (targets[0].kind === 'element') {
      expect(targets[0].cssPath).toBe('[data-dc-screen="screen-3"]');
    }
  });

  test('falls back to widening a descendant selector when no artboardId', async () => {
    const targets = await resolveScope({
      scope: 'artboard',
      activeJson: activeOn('.design/ui/Home.tsx'),
      designRoot: '/abs/.design',
      options: { selection: { selector: '.cta-button' } },
    });
    const t = targets[0];
    if (t.kind === 'element') {
      expect(t.cssPath).toBe('.cta-button');
      // No id → the adapter must widen to the closest [data-dc-screen].
      expect(t.widen).toBe(true);
    }
  });

  test('escapes a quote in the artboard id so the selector stays valid', async () => {
    const targets = await resolveScope({
      scope: 'artboard',
      activeJson: activeOn('.design/ui/Home.tsx'),
      designRoot: '/abs/.design',
      options: { artboardId: 'a"b' },
    });
    if (targets[0].kind === 'element') {
      expect(targets[0].cssPath).toBe('[data-dc-screen="a\\"b"]');
    }
  });
});

describe('resolveScope — canvas-as-separate', () => {
  test('emits one multi-target spanning every artboard on the active canvas', async () => {
    const targets = await resolveScope({
      scope: 'canvas-as-separate',
      activeJson: activeOn('.design/ui/Home.tsx'),
      designRoot: '/abs/.design',
    });
    expect(targets).toHaveLength(1);
    const t = targets[0];
    expect(t.kind).toBe('element');
    if (t.kind === 'element') {
      expect(t.cssPath).toBe('[data-dc-screen]');
      expect(t.multi).toBe(true);
      expect(t.canvasSlug).toBe('ui-home');
    }
  });
});

describe('resolveScope — project-raw', () => {
  test('walks designRoot and excludes runtime files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'scope-raw-'));
    const designRoot = join(root, '.design');
    mkdirSync(designRoot, { recursive: true });
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    mkdirSync(join(designRoot, '_history', 'old'), { recursive: true });
    writeFileSync(join(designRoot, 'config.json'), '{}');
    writeFileSync(join(designRoot, 'ui', 'Home.tsx'), 'export default ()=>null');
    writeFileSync(join(designRoot, '_active.json'), '{"active":null}');
    writeFileSync(join(designRoot, '_history', 'old', 'snap.tsx'), '// snapshot');
    writeFileSync(join(designRoot, '.DS_Store'), ' ');

    const targets = await resolveScope({
      scope: 'project-raw',
      activeJson: emptyActive(),
      designRoot,
      repoRoot: root,
    });
    expect(targets).toHaveLength(1);
    if (targets[0].kind === 'file-tree') {
      const paths = targets[0].paths.sort();
      expect(paths).toContain('config.json');
      expect(paths).toContain('ui/Home.tsx');
      // Excludes apply.
      expect(paths).not.toContain('_active.json');
      expect(paths).not.toContain('.DS_Store');
      expect(paths.some((p) => p.startsWith('_history/'))).toBe(false);
    }
  });

  test('emits no targets when designRoot is empty after excludes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'scope-raw-empty-'));
    const designRoot = join(root, '.design');
    mkdirSync(designRoot, { recursive: true });
    writeFileSync(join(designRoot, '_active.json'), '{}');

    const targets = await resolveScope({
      scope: 'project-raw',
      activeJson: emptyActive(),
      designRoot,
      repoRoot: root,
    });
    expect(targets).toEqual([]);
  });
});
