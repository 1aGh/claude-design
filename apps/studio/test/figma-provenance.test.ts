// Provenance for an imported canvas (DDR-216 D7 / T9).
//
// The plan flags this exact prop-threading as having silently no-opped once
// before: a badge shipped prop-threaded-but-never-stored, so `.meta.json` said
// one thing and the tree showed nothing. So this asserts the SERVER half
// end-to-end against a live `/_index-data` — that `kind` actually survives
// `loadCanvasMeta` → `NOTABLE_KINDS` → the wire — rather than unit-testing a
// constant that a missing wire would leave green.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Subprocess } from 'bun';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

let proc: Subprocess;
let base: string;
let designRoot: string;

const CANVAS = `import { DCArtboard, DesignCanvas } from '@maude/canvas-lib';
export default function Canvas() {
  return (
    <DesignCanvas>
      <DCArtboard id="node-2-23" label="Imported" width={400} height={300} kind="digital" />
    </DesignCanvas>
  );
}
`;

beforeAll(async () => {
  const sandbox = makeSandbox();
  designRoot = sandbox.designRoot;
  mkdirSync(join(designRoot, 'ui'), { recursive: true });

  // An imported canvas: `kind` + a source block carrying IDENTIFIERS ONLY.
  writeFileSync(join(designRoot, 'ui', 'imported.tsx'), CANVAS);
  writeFileSync(
    join(designRoot, 'ui', 'imported.meta.json'),
    JSON.stringify({
      kind: 'imported-figma',
      source: {
        fileKey: 'dGNzRC2kmrmGnOxaBa0RI7',
        nodeId: '2:23',
        importedAt: '2026-08-09T00:00:00.000Z',
      },
      layout: { artboards: [{ id: 'node-2-23', x: 0, y: 0 }] },
    })
  );

  // A hand-authored canvas alongside it — the badge must NOT appear on this one.
  writeFileSync(join(designRoot, 'ui', 'handmade.tsx'), CANVAS);
  writeFileSync(join(designRoot, 'ui', 'handmade.meta.json'), JSON.stringify({ layout: {} }));

  const port = nextPort();
  base = `http://localhost:${port}`;
  proc = await bootServer(sandbox.root, port);
});

afterAll(async () => {
  await killProc(proc);
});

async function indexData(): Promise<Record<string, unknown>> {
  const res = await fetch(`${base}/_index-data`);
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
}

describe('the imported-figma kind reaches the tree', () => {
  test('canvasKinds carries it for the imported canvas', async () => {
    const data = await indexData();
    const kinds = data.canvasKinds as Record<string, string>;
    const entry = Object.entries(kinds).find(([p]) => p.endsWith('imported.tsx'));
    expect(entry).toBeDefined();
    expect(entry?.[1]).toBe('imported-figma');
  });

  test('a hand-authored canvas gets NO kind — the badge means something', async () => {
    const data = await indexData();
    const kinds = data.canvasKinds as Record<string, string>;
    expect(Object.keys(kinds).some((p) => p.endsWith('handmade.tsx'))).toBe(false);
  });
});

describe('provenance carries identifiers only (D7)', () => {
  test('no Figma NAME or node text is anywhere on the wire', async () => {
    // `.meta.json` and `config.json` are versioned, peer-synced (DDR-054) AND
    // read into multiple agents' context. DDR-172 Decision 8 traced exactly
    // this class and ELIMINATED the free-text sink rather than bounding it;
    // D7 applies the same elimination here.
    const raw = JSON.stringify(await indexData());
    expect(raw).not.toContain('Karta');
    expect(raw).not.toContain('žluť');
    expect(raw).not.toContain('<script');
  });

  test('the recorded source fields are charset-constrained shapes', async () => {
    const meta = JSON.parse(
      await Bun.file(join(designRoot, 'ui', 'imported.meta.json')).text()
    ) as { source: { fileKey: string; nodeId: string; importedAt: string } };
    expect(meta.source.fileKey).toMatch(/^[A-Za-z0-9]{10,64}$/);
    expect(meta.source.nodeId).toMatch(/^[0-9]+:[0-9]+$/);
    expect(Number.isNaN(Date.parse(meta.source.importedAt))).toBe(false);
    // Exactly three fields — no room for a name, a title or a description.
    expect(Object.keys(meta.source).sort()).toEqual(['fileKey', 'importedAt', 'nodeId']);
  });
});
