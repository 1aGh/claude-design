// annotate-write — FigJam v3 AI write verb (`maude design annotate`).
// Drives bin/annotate.mjs as a subprocess against a temp design root and
// asserts the output through the CANONICAL parser: everything the verb writes
// must be sanitize-stable, byte-identical under parse → re-serialize, and
// readable back as a graph by read-annotations --graph.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

import {
  type ArrowStroke,
  type StickyStroke,
  type Stroke,
  sanitizeAnnotationSvg,
  strokesToSvg,
  svgToStrokes,
} from '../annotations-model.ts';

const BIN = new URL('../bin/annotate.mjs', import.meta.url).pathname;
const READER = new URL('../bin/read-annotations.mjs', import.meta.url).pathname;

let root: string;

beforeAll(() => {
  GlobalRegistrator.register();
  root = mkdtempSync(join(tmpdir(), 'annotate-test-'));
  // A design root with no config — resolveDesignRoot defaults to .design.
  writeFileSync(
    join(root, 'flow.json'),
    JSON.stringify({
      nodes: [
        { id: 'a', label: 'Start' },
        { id: 'b', label: 'Middle' },
        { id: 'c', label: 'End', shape: 'ellipse' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c', label: 'ships' },
      ],
    })
  );
  Bun.spawnSync(['mkdir', '-p', join(root, '.design')]);
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
  rmSync(root, { recursive: true, force: true });
});

function runAnnotate(args: string[], stdin?: string): { code: number; out: string; err: string } {
  const proc = Bun.spawnSync(['bun', BIN, ...args], {
    stdin: stdin ? new TextEncoder().encode(stdin) : undefined,
  });
  return {
    code: proc.exitCode,
    out: new TextDecoder().decode(proc.stdout),
    err: new TextDecoder().decode(proc.stderr),
  };
}

function readSvg(): string {
  return readFileSync(join(root, '.design', 'ui-flow.annotations.svg'), 'utf8');
}

describe('annotate --flow', () => {
  test('writes an auto-laid-out diagram of bound connectors', () => {
    const res = runAnnotate(['ui/Flow.tsx', '--flow', join(root, 'flow.json'), '--root', root]);
    expect(res.code).toBe(0);
    const result = JSON.parse(res.out) as { ok: boolean; refs: Record<string, string> };
    expect(result.ok).toBe(true);
    expect(Object.keys(result.refs)).toEqual(['@a', '@b', '@c']);

    const svg = readSvg();
    // Canonical-parser compatible, sanitize-stable, byte-identical round-trip.
    expect(sanitizeAnnotationSvg(svg)).toBe(svg);
    const strokes = svgToStrokes(svg);
    expect(strokesToSvg(strokes)).toBe(svg);
    // 3 shapes + 3 labels (2 anchored + 1 ellipse-anchored) + 2 arrows + 1 edge label.
    const arrows = strokes.filter((s): s is ArrowStroke => s.tool === 'arrow');
    expect(arrows).toHaveLength(2);
    for (const a of arrows) {
      expect(a.startBind?.hostId).toBeDefined();
      expect(a.endBind?.hostId).toBeDefined();
      expect(a.author).toBe('ai');
    }
    // Layered layout: 'b' sits one column right of 'a'.
    const aShape = strokes.find((s) => s.id === result.refs['@a']) as Stroke & { x: number };
    const bShape = strokes.find((s) => s.id === result.refs['@b']) as Stroke & { x: number };
    expect(bShape.x).toBeGreaterThan(aShape.x);
  });

  test('read-annotations --graph reads the diagram back as the same graph', () => {
    const proc = Bun.spawnSync(['node', READER, 'ui/Flow.tsx', '--root', root, '--graph']);
    const parsed = JSON.parse(new TextDecoder().decode(proc.stdout)) as {
      graph: { nodes: Array<{ label: string | null }>; edges: unknown[] };
    };
    expect(parsed.graph.edges).toHaveLength(2);
    expect(parsed.graph.nodes.map((n) => n.label).sort()).toEqual(['End', 'Middle', 'Start']);
  });
});

describe('annotate --ops', () => {
  test('create sticky + group + connect-to-existing + delete, via stdin', () => {
    // Connect to a node minted by the previous --flow run.
    const flowSvg = readSvg();
    const existingId = (svgToStrokes(flowSvg).find((s) => s.tool === 'rect') as Stroke).id;
    const ops = {
      ops: [
        { op: 'create', type: 'sticky', ref: '@n1', text: 'pain point', x: 100, y: 600 },
        { op: 'create', type: 'sticky', ref: '@n2', text: 'idea', x: 340, y: 600 },
        { op: 'group', ids: ['@n1', '@n2'] },
        { op: 'connect', from: '@n1', to: existingId },
      ],
    };
    const res = runAnnotate(['ui/Flow.tsx', '--root', root], JSON.stringify(ops));
    expect(res.code).toBe(0);
    const svg = readSvg();
    expect(sanitizeAnnotationSvg(svg)).toBe(svg);
    const strokes = svgToStrokes(svg);
    expect(strokesToSvg(svg && strokes ? strokes : [])).toBe(svg);
    const stickies = strokes.filter((s): s is StickyStroke => s.tool === 'sticky');
    expect(stickies).toHaveLength(2);
    expect(stickies[0]?.groupIds).toEqual(stickies[1]?.groupIds);
    expect(stickies[0]?.groupIds?.length).toBe(1);
    const bound = strokes.filter(
      (s): s is ArrowStroke => s.tool === 'arrow' && s.endBind?.hostId === existingId
    );
    expect(bound).toHaveLength(1);

    // Delete one sticky — the element disappears and the file stays canonical.
    const del = runAnnotate(
      ['ui/Flow.tsx', '--root', root],
      JSON.stringify({ ops: [{ op: 'delete', id: stickies[1]?.id }] })
    );
    expect(del.code).toBe(0);
    const after = svgToStrokes(readSvg());
    expect(after.filter((s) => s.tool === 'sticky')).toHaveLength(1);
    expect(strokesToSvg(after)).toBe(readSvg());
  });

  test('unknown connect target fails loud, writes nothing', () => {
    const before = readSvg();
    const res = runAnnotate(
      ['ui/Flow.tsx', '--root', root],
      JSON.stringify({ ops: [{ op: 'connect', from: '@ghost', to: 'nope' }] })
    );
    expect(res.code).toBe(2);
    expect(readSvg()).toBe(before);
  });

  test('--dry-run prints the merged SVG without writing', () => {
    const before = readSvg();
    const res = runAnnotate(
      ['ui/Flow.tsx', '--root', root, '--dry-run'],
      JSON.stringify({ ops: [{ op: 'create', type: 'text', text: 'ghost', x: 0, y: 0 }] })
    );
    expect(res.code).toBe(0);
    expect(res.out).toContain('ghost');
    expect(readSvg()).toBe(before);
  });

  test('non-loopback _server.json.url is refused — writes to file, never PUTs off-box (F2)', () => {
    // A poisoned/foreign _server.json points the egress at an external host.
    // The verb must NOT PUT there (SSRF/exfil); it falls back to the file write.
    const serverJson = join(root, '.design', '_server.json');
    writeFileSync(serverJson, JSON.stringify({ url: 'http://attacker.example.com:4399' }));
    try {
      const res = runAnnotate(
        ['ui/F2.tsx', '--root', root],
        JSON.stringify({ ops: [{ op: 'create', type: 'text', text: 'secret', x: 0, y: 0 }] })
      );
      expect(res.code).toBe(0);
      // via:"file" proves the off-box PUT was skipped (a successful PUT → "server").
      expect(JSON.parse(res.out).via).toBe('file');
      const svg = readFileSync(join(root, '.design', 'ui-f2.annotations.svg'), 'utf8');
      expect(svg).toContain('secret');
    } finally {
      rmSync(serverJson, { force: true });
    }
  });
});
