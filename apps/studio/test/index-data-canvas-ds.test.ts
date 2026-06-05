// DDR-093 — `/_index-data` attaches a per-canvas design-system map so the
// client's canvasUrl() can inject each UI canvas's OWN tokens instead of always
// designSystems[0]. This is the server half of the
// "non-default-DS canvas renders unstyled" fix.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bootServer, killProc, nextPort } from './_helpers.ts';

// A two-DS sandbox: `project` is the default (ds0, rootClass mdcc), `maude` is
// the non-default one (rootClass maude) the bug broke.
function makeMultiDsSandbox(): { root: string; designRoot: string } {
  const root = mkdtempSync(join(tmpdir(), 'mdcc-multids-'));
  const designRoot = join(root, '.design');
  mkdirSync(designRoot, { recursive: true });
  writeFileSync(
    join(designRoot, 'config.json'),
    JSON.stringify(
      {
        name: 'multi-ds-test',
        designRoot: '.design',
        canvasGroups: [
          { label: 'Design system', path: 'system' },
          { label: 'UI kit', path: 'ui' },
        ],
        designSystems: [
          { name: 'project', path: 'system/project', rootClass: 'mdcc' },
          { name: 'maude', path: 'system/maude', rootClass: 'maude' },
        ],
        defaultDesignSystem: 'project',
      },
      null,
      2
    )
  );

  const tsx = 'export default function C(){return <main/>}\n';

  // UI canvas authored under the NON-default DS — declares it in its sidecar.
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  writeFileSync(join(designRoot, 'ui', 'Studio.tsx'), tsx);
  writeFileSync(
    join(designRoot, 'ui', 'Studio.meta.json'),
    JSON.stringify({ designSystem: 'maude' })
  );

  // UI canvas with a sidecar that omits designSystem → resolves to the default.
  writeFileSync(join(designRoot, 'ui', 'Plain.tsx'), tsx);
  writeFileSync(join(designRoot, 'ui', 'Plain.meta.json'), JSON.stringify({ title: 'Plain' }));

  // UI canvas with NO sidecar at all → also defaults.
  writeFileSync(join(designRoot, 'ui', 'Bare.tsx'), tsx);

  // Specimens — DS resolved path-authoritatively (no sidecar needed).
  mkdirSync(join(designRoot, 'system', 'maude', 'preview'), { recursive: true });
  writeFileSync(join(designRoot, 'system', 'maude', 'preview', 'Buttons.tsx'), tsx);
  mkdirSync(join(designRoot, 'system', 'project', 'preview'), { recursive: true });
  writeFileSync(join(designRoot, 'system', 'project', 'preview', 'Cards.tsx'), tsx);

  return { root, designRoot };
}

interface IndexData {
  canvasDesignSystems?: Record<string, string>;
  groups?: { paths?: string[] }[];
}

describe('/_index-data — per-canvas design-system map', () => {
  test('attaches the right DS for UI canvases (sidecar) and specimens (path)', async () => {
    const { root } = makeMultiDsSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const r = await fetch(`http://localhost:${port}/_index-data`);
      expect(r.status).toBe(200);
      const data = (await r.json()) as IndexData;
      const map = data.canvasDesignSystems ?? {};

      // The bug: this used to be implicitly designSystems[0] ('project'). The
      // sidecar declares 'maude', so the server must surface 'maude'.
      expect(map['.design/ui/Studio.tsx']).toBe('maude');

      // Sidecar without designSystem, and no sidecar at all → project default.
      expect(map['.design/ui/Plain.tsx']).toBe('project');
      expect(map['.design/ui/Bare.tsx']).toBe('project');

      // Specimens resolve from their `system/<ds>/` folder.
      expect(map['.design/system/maude/preview/Buttons.tsx']).toBe('maude');
      expect(map['.design/system/project/preview/Cards.tsx']).toBe('project');
    } finally {
      await killProc(proc);
    }
  });
});
