// /_system-data — bias-free token rendering depends on per-DS scoping.
// Covers DDR-048: ?ds=<name> scopes payload to one designSystem entry;
// unknown ds → 404; omitted ds → legacy unscoped behavior for single-DS
// projects that don't declare `designSystems[]`.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Subprocess } from 'bun';
import { bootServer, killProc, nextPort } from './_helpers';

interface MultiDsSandbox {
  root: string;
  designRoot: string;
}

function makeMultiDsSandbox(): MultiDsSandbox {
  const root = mkdtempSync(join(tmpdir(), 'mdcc-multi-ds-'));
  const designRoot = join(root, '.design');
  mkdirSync(designRoot, { recursive: true });

  writeFileSync(
    join(designRoot, 'config.json'),
    JSON.stringify(
      {
        name: 'multi-ds',
        designRoot: '.design',
        canvasGroups: [
          { label: 'Design system', path: 'system' },
          { label: 'UI', path: 'ui' },
        ],
        designSystems: [
          { name: 'alpha', path: 'system/alpha', description: 'Alpha brand' },
          { name: 'beta', path: 'system/beta', description: 'Beta brand' },
        ],
        defaultDesignSystem: 'alpha',
      },
      null,
      2
    )
  );

  // Alpha — periwinkle accent, cream surfaces (mimics StudyFi case).
  mkdirSync(join(designRoot, 'system', 'alpha', 'preview'), { recursive: true });
  writeFileSync(
    join(designRoot, 'system', 'alpha', 'colors_and_type.css'),
    `:root {\n  --color-bg: #fbfaf7;\n  --accent: #9CACFF;\n  --color-text-primary: #000000;\n  --fs-base: 1rem;\n  --font-body: 'Inter', sans-serif;\n}\n`
  );
  writeFileSync(
    join(designRoot, 'system', 'alpha', 'preview', 'colors-accent.tsx'),
    `export default function ColorsAccent() { return <div>alpha accent</div>; }\n`
  );

  // Beta — different palette + names.
  mkdirSync(join(designRoot, 'system', 'beta', 'preview'), { recursive: true });
  writeFileSync(
    join(designRoot, 'system', 'beta', 'colors_and_type.css'),
    `:root {\n  --bg-0: oklch(13% 0.012 60);\n  --accent: oklch(72% 0.16 55);\n  --type-base: 14px;\n}\n`
  );
  writeFileSync(
    join(designRoot, 'system', 'beta', 'preview', 'colors-accent.tsx'),
    `export default function ColorsAccent() { return <div>beta accent</div>; }\n`
  );

  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  return { root, designRoot };
}

describe('/_system-data — per-DS scope (DDR-048)', () => {
  let proc: Subprocess | null = null;
  let sb: MultiDsSandbox;
  let port: number;

  beforeEach(async () => {
    sb = makeMultiDsSandbox();
    port = nextPort();
    proc = await bootServer(sb.root, port);
  });

  afterEach(async () => {
    if (proc) await killProc(proc);
    proc = null;
  });

  test('?ds=alpha → tokens parsed from alpha colors_and_type.css', async () => {
    const r = await fetch(`http://localhost:${port}/_system-data?ds=alpha`);
    expect(r.status).toBe(200);
    const data = (await r.json()) as {
      tokens: { name: string; value: string }[];
      ds: { name: string; description: string };
      tokensPath: string;
      previewGallery: { label: string }[];
    };
    expect(data.ds.name).toBe('alpha');
    expect(data.ds.description).toBe('Alpha brand');
    expect(data.tokensPath).toContain('system/alpha/colors_and_type.css');
    const accent = data.tokens.find((t) => t.name === '--accent');
    expect(accent?.value).toBe('#9CACFF');
    const colorBg = data.tokens.find((t) => t.name === '--color-bg');
    expect(colorBg?.value).toBe('#fbfaf7');
    // Alpha previews only — no beta leakage.
    expect(data.previewGallery.some((p) => p.label === 'colors-accent')).toBe(true);
    expect(data.previewGallery.every((p) => !p.label.includes('beta'))).toBe(true);
  });

  test('?ds=beta → distinct tokens, distinct previews', async () => {
    const r = await fetch(`http://localhost:${port}/_system-data?ds=beta`);
    expect(r.status).toBe(200);
    const data = (await r.json()) as {
      tokens: { name: string; value: string }[];
      ds: { name: string };
      tokensPath: string;
    };
    expect(data.ds.name).toBe('beta');
    expect(data.tokensPath).toContain('system/beta/colors_and_type.css');
    const accent = data.tokens.find((t) => t.name === '--accent');
    expect(accent?.value).toBe('oklch(72% 0.16 55)');
    const bg0 = data.tokens.find((t) => t.name === '--bg-0');
    expect(bg0?.value).toBe('oklch(13% 0.012 60)');
  });

  test('?ds=ghost → 404 + error payload (no silent shell fallback)', async () => {
    const r = await fetch(`http://localhost:${port}/_system-data?ds=ghost`);
    expect(r.status).toBe(404);
    const body = (await r.json()) as { error: string; ds: string };
    expect(body.error).toBe('unknown design system');
    expect(body.ds).toBe('ghost');
  });

  test('unscoped (no ?ds) → availableDesignSystems list + defaultDesignSystem', async () => {
    const r = await fetch(`http://localhost:${port}/_system-data`);
    expect(r.status).toBe(200);
    const data = (await r.json()) as {
      availableDesignSystems: { name: string; description: string | null }[];
      defaultDesignSystem: string;
      ds: unknown;
    };
    expect(data.availableDesignSystems).toHaveLength(2);
    expect(data.availableDesignSystems.map((d) => d.name)).toEqual(['alpha', 'beta']);
    expect(data.defaultDesignSystem).toBe('alpha');
    expect(data.ds).toBeNull();
  });
});
