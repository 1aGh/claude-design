// /_api/canvas — Phase 22 UI add-on. Create a blank brief board from the browser.
//
// Two layers:
//   (1) the pure name-validation boundary (the ONE security gate — path +
//       JSX + JSON injection), tested directly;
//   (2) the POST endpoint round-trip (boots a real server against a sandbox),
//       covering happy path, the rejection matrix, group allowlist, duplicate.

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { componentNameFrom, renderBriefBoard, validateCanvasName } from '../canvas-create.ts';
import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

describe('canvas-create / validateCanvasName (the security boundary)', () => {
  test('accepts ordinary names (incl. spaces + accents)', () => {
    for (const n of ['Onboarding Brief', 'checkout-flow', 'Krok_1', 'Přihlášení', 'A1']) {
      const v = validateCanvasName(n);
      expect(v.ok).toBe(true);
      expect(v.name).toBe(n);
    }
  });

  test('trims surrounding whitespace', () => {
    const v = validateCanvasName('  Onboarding  ');
    expect(v.ok).toBe(true);
    expect(v.name).toBe('Onboarding');
  });

  // The rejection matrix — path traversal, separators, and template/JSON
  // injection vectors must ALL be refused by the one allowlist regex.
  const REJECT: Array<[string, unknown]> = [
    ['empty', ''],
    ['whitespace only', '   '],
    ['non-string', 123],
    ['null', null],
    ['parent traversal', '../evil'],
    ['nested traversal', 'a/../../etc/passwd'],
    ['forward slash', 'ui/Sneaky'],
    ['back slash', 'ui\\Sneaky'],
    ['leading dot', '.hidden'],
    ['dot-dot', '..'],
    ['JSX break-out', 'X</div><script>alert(1)</script>'],
    ['brace injection', 'A{2+2}B'],
    ['angle bracket', 'a<b'],
    ['double quote (JSON break-out)', 'a"b'],
    ['backslash (JSON break-out)', 'a\\b'],
    ['leading hyphen', '-dash'],
    ['too long (61)', 'x'.repeat(61)],
    ['tab', 'a\tb'],
    ['newline', 'a\nb'],
    ['null byte', 'a\u0000b'],
  ];
  for (const [label, value] of REJECT) {
    test(`rejects ${label}`, () => {
      expect(validateCanvasName(value).ok).toBe(false);
    });
  }

  test('componentNameFrom yields a valid identifier', () => {
    expect(componentNameFrom('Onboarding Brief')).toBe('OnboardingBrief');
    expect(componentNameFrom('checkout-flow v2')).toBe('CheckoutFlowV2');
    expect(componentNameFrom('123')).toMatch(/^Board/); // digit-leading → prefixed
    // Unicode letters survive (review #1) — not ASCII-mangled to "PIhlEn".
    expect(componentNameFrom('Přihlášení')).toBe('Přihlášení');
    expect(componentNameFrom('123abc')).toBe('Board123abc'); // digit-leading → prefixed, body kept
  });

  test('collapses internal double-spaces so the slug methods agree (review #4)', () => {
    const v = validateCanvasName('Two  Spaces');
    expect(v.ok).toBe(true);
    expect(v.name).toBe('Two Spaces'); // " +" → " " ; a tab would still be rejected
  });

  test('renderBriefBoard substitutes every placeholder (no {{…}} left)', () => {
    const out = renderBriefBoard({
      name: 'Onboarding Brief',
      componentName: 'OnboardingBrief',
      dsName: 'project',
      platform: 'desktop',
      seedHint: 'seed',
      historyDir: '.design/_history/ui-onboarding_brief',
    });
    expect(out).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(out).toContain('export default function OnboardingBrief()');
    expect(out).toContain('@kind        brief-board');
    expect(out).toContain('Onboarding Brief');
  });
});

describe('/_api/canvas — POST round-trip', () => {
  test('creates a brief board (.tsx + .meta.json), returns 201 + the tree path', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Onboarding Brief', kind: 'brief-board' }),
      });
      expect(r.status).toBe(201);
      const j = (await r.json()) as { ok: boolean; file: string; rel: string; slug: string };
      expect(j.ok).toBe(true);
      expect(j.file).toBe('.design/ui/Onboarding Brief.tsx');
      expect(j.rel).toBe('ui/Onboarding Brief.tsx');
      expect(j.slug).toBe('ui-onboarding_brief');

      const tsx = join(designRoot, 'ui', 'Onboarding Brief.tsx');
      const meta = join(designRoot, 'ui', 'Onboarding Brief.meta.json');
      expect(existsSync(tsx)).toBe(true);
      expect(existsSync(meta)).toBe(true);
      expect(readFileSync(tsx, 'utf8')).toContain('export default function OnboardingBrief()');
      expect(readFileSync(tsx, 'utf8')).toContain('Drop sticky notes');
      const m = JSON.parse(readFileSync(meta, 'utf8'));
      expect(m.kind).toBe('brief-board');
      expect(m.title).toBe('Onboarding Brief');
      expect(m.brief_sha).toBeUndefined(); // a board has no generation brief
    } finally {
      await killProc(proc);
    }
  });

  test('defaults kind to brief-board when omitted', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'No Kind' }),
      });
      expect(r.status).toBe(201);
    } finally {
      await killProc(proc);
    }
  });

  test('rejects a traversal name with 400 and writes nothing', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '../../escape' }),
      });
      expect(r.status).toBe(400);
      // No file landed anywhere near the design root's parent.
      expect(existsSync(join(designRoot, '..', 'escape.tsx'))).toBe(false);
    } finally {
      await killProc(proc);
    }
  });

  test('rejects an unknown group with 400', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Valid', group: 'etc' }),
      });
      expect(r.status).toBe(400);
    } finally {
      await killProc(proc);
    }
  });

  // Phase 22 security review F2 — a config whose newCanvasDir TRAVERSES out of
  // the design root must NOT let the write escape, even though the traversing
  // group is technically "allowlisted" (it came from config). The designRoot
  // containment assert is the backstop.
  test('a config with a traversing newCanvasDir cannot escape the design root', async () => {
    const { root, designRoot } = makeSandbox();
    // Poison the config: newCanvasDir points outside the design root.
    writeFileSync(
      join(designRoot, 'config.json'),
      JSON.stringify({
        name: 'test',
        designRoot: '.design',
        newCanvasDir: '../../../../tmp',
        canvasGroups: [
          { label: 'System', path: 'system' },
          { label: 'UI', path: 'ui' },
        ],
      })
    );
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Escape' }),
      });
      expect(r.status).toBe(400);
      // Nothing was written up at the traversal target.
      expect(existsSync(join(root, '..', '..', 'tmp', 'Escape.tsx'))).toBe(false);
    } finally {
      await killProc(proc);
    }
  });

  test('rejects a non-brief-board kind with 400', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Valid', kind: 'canvas' }),
      });
      expect(r.status).toBe(400);
    } finally {
      await killProc(proc);
    }
  });

  test('a duplicate name returns 409', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const body = JSON.stringify({ name: 'Dup Board' });
      const first = await fetch(`http://localhost:${port}/_api/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      expect(first.status).toBe(201);
      const second = await fetch(`http://localhost:${port}/_api/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      expect(second.status).toBe(409);
    } finally {
      await killProc(proc);
    }
  });

  test('unknown method (GET) returns 405', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_api/canvas`, { method: 'GET' });
      expect(r.status).toBe(405);
    } finally {
      await killProc(proc);
    }
  });
});

describe('/_api/canvas — DELETE (soft-delete)', () => {
  async function createBoard(port: number, name: string) {
    const r = await fetch(`http://localhost:${port}/_api/canvas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return (await r.json()) as { file: string; slug: string };
  }
  const del = (port: number, file: string) =>
    fetch(`http://localhost:${port}/_api/canvas?file=${encodeURIComponent(file)}`, {
      method: 'DELETE',
    });

  test('soft-deletes a canvas: moves .tsx + sidecars to _trash, gone from ui/', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const created = await createBoard(port, 'Trash Me');
      // Seed an annotation sidecar to prove the whole set travels.
      writeFileSync(
        join(designRoot, `${created.slug}.annotations.svg`),
        '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"></svg>'
      );
      const tsx = join(designRoot, 'ui', 'Trash Me.tsx');
      expect(existsSync(tsx)).toBe(true);

      const r = await del(port, created.file);
      expect(r.status).toBe(200);
      const j = (await r.json()) as { ok: boolean; trashed: string[] };
      expect(j.ok).toBe(true);
      expect(j.trashed.some((t) => t.endsWith('Trash Me.tsx'))).toBe(true);
      expect(j.trashed.some((t) => t.endsWith('.annotations.svg'))).toBe(true);

      // Gone from the group; present (recoverable) under _trash/ with a manifest.
      expect(existsSync(tsx)).toBe(false);
      expect(existsSync(join(designRoot, `${created.slug}.annotations.svg`))).toBe(false);
      const trashDirs = readdirSync(join(designRoot, '_trash'));
      expect(trashDirs.length).toBe(1);
      const td = join(designRoot, '_trash', trashDirs[0] as string);
      expect(existsSync(join(td, 'Trash Me.tsx'))).toBe(true);
      expect(existsSync(join(td, '_trash-manifest.json'))).toBe(true);
    } finally {
      await killProc(proc);
    }
  });

  test('refuses to delete a design-system file (400, untouched)', async () => {
    const { root, designRoot } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      mkdirSync(join(designRoot, 'system', 'project'), { recursive: true });
      const dsFile = join(designRoot, 'system', 'project', 'Spec.tsx');
      writeFileSync(dsFile, 'export default function S(){return null}');
      const r = await del(port, '.design/system/project/Spec.tsx');
      expect(r.status).toBe(400);
      expect(existsSync(dsFile)).toBe(true);
    } finally {
      await killProc(proc);
    }
  });

  test('refuses a non-.tsx root file like config.json (400)', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await del(port, '.design/config.json');
      expect(r.status).toBe(400);
    } finally {
      await killProc(proc);
    }
  });

  test('a missing canvas returns 404', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await del(port, 'ui/Nope.tsx');
      expect(r.status).toBe(404);
    } finally {
      await killProc(proc);
    }
  });

  test('a traversal file is rejected (400)', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await del(port, 'ui/../../escape.tsx');
      expect(r.status).toBe(400);
    } finally {
      await killProc(proc);
    }
  });
});
