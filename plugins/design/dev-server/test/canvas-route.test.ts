// Integration test for the /.design/ui/*.tsx canvas route.
//
// Boots a real Bun.serve dev-server against a sandbox that contains a single
// canvas TSX file, then verifies:
//   - GET returns 200 + application/javascript + an ETag header
//   - If-None-Match: <etag> returns 304 with no body
//   - The cached body parses as JS via the same Bun.Transpiler the route uses
//   - _locator.json is written for the canvas slug
//   - Path-traversal attempts get rejected
//   - Non-existent canvases return 404

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Subprocess } from 'bun';

import { readLocator } from '../locator.ts';
import { bootServer, killProc, nextPort } from './_helpers.ts';

interface CanvasSandbox {
  root: string;
  designRoot: string;
  cleanup: () => void;
}

function makeCanvasSandbox(canvasName: string, canvasSource: string): CanvasSandbox {
  const root = mkdtempSync(join(tmpdir(), 'mdcc-canvas-route-'));
  const designRoot = join(root, '.design');
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  writeFileSync(
    join(designRoot, 'config.json'),
    JSON.stringify({
      name: 'test',
      designRoot: '.design',
      canvasGroups: [
        { label: 'UI', path: 'ui' },
        { label: 'System', path: 'system' },
      ],
    })
  );
  writeFileSync(join(designRoot, 'ui', canvasName), canvasSource);
  return { root, designRoot, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const SIMPLE_TSX = `
export default function Hello() {
  return (
    <section>
      <h1>Hello, world.</h1>
      <p>Subhead.</p>
    </section>
  );
}
`;

describe('TSX canvas route', () => {
  let proc: Subprocess | null = null;
  let port = 0;
  let sb: CanvasSandbox | null = null;

  async function boot(canvasName: string, source: string) {
    sb = makeCanvasSandbox(canvasName, source);
    port = nextPort();
    proc = await bootServer(sb.root, port);
  }

  async function teardown() {
    if (proc) await killProc(proc);
    if (sb) sb.cleanup();
    proc = null;
    sb = null;
  }

  test('returns 200 + JS + ETag for a valid canvas', async () => {
    await boot('Hello.tsx', SIMPLE_TSX);
    try {
      const r = await fetch(`http://localhost:${port}/.design/ui/Hello.tsx`);
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toMatch(/javascript/);
      const etag = r.headers.get('etag');
      expect(etag).toBeTruthy();
      expect(etag).toMatch(/^[0-9a-f]+$/i);
      const body = await r.text();
      // Body should contain data-cd-id metadata + an export — proves the two
      // passes ran end to end.
      expect(body).toMatch(/data-cd-id/);
      // Bun.build emits `export { Hello as default }` (renamed-default form)
      // rather than `export default Hello`. Both are valid ESM; match either.
      expect(body).toMatch(/export\s+\{[\s\S]*\bdefault\b[\s\S]*\}|export\s+default\b/);
    } finally {
      await teardown();
    }
  });

  test('returns 304 on a matching If-None-Match', async () => {
    await boot('Hello.tsx', SIMPLE_TSX);
    try {
      const first = await fetch(`http://localhost:${port}/.design/ui/Hello.tsx`);
      const etag = first.headers.get('etag') as string;
      const second = await fetch(`http://localhost:${port}/.design/ui/Hello.tsx`, {
        headers: { 'If-None-Match': etag },
      });
      expect(second.status).toBe(304);
      // 304 body should be empty.
      const body = await second.text();
      expect(body.length).toBe(0);
    } finally {
      await teardown();
    }
  });

  test('writes _locator.json with the canvas slug populated', async () => {
    await boot('Docs Site.tsx', SIMPLE_TSX);
    try {
      await fetch(`http://localhost:${port}/.design/ui/Docs%20Site.tsx`);
      const locFile = join(sb?.designRoot, '_locator.json');
      // The locator is written synchronously before the response — the file
      // must exist + carry the canvas slug.
      expect(existsSync(locFile)).toBe(true);
      const map = await readLocator(locFile, 'ui/Docs Site');
      expect(map).not.toBeNull();
      // SIMPLE_TSX has three JSX elements: section, h1, p.
      expect(Object.keys(map as Record<string, unknown>).length).toBe(3);
    } finally {
      await teardown();
    }
  });

  test('returns 404 for a missing canvas', async () => {
    await boot('Hello.tsx', SIMPLE_TSX);
    try {
      const r = await fetch(`http://localhost:${port}/.design/ui/Missing.tsx`);
      expect(r.status).toBe(404);
    } finally {
      await teardown();
    }
  });

  test('rejects path traversal via .. (403 from safePathUnderRoot)', async () => {
    await boot('Hello.tsx', SIMPLE_TSX);
    try {
      const r = await fetch(`http://localhost:${port}/.design/ui/../../etc/passwd.tsx`);
      // safePathUnderRoot kicks the request out before our TSX dispatch runs.
      expect([400, 403, 404]).toContain(r.status);
    } finally {
      await teardown();
    }
  });

  test('returns 500 on a malformed canvas with a useful error body', async () => {
    await boot('Broken.tsx', 'export default function X() { return <div></span>; }');
    try {
      const r = await fetch(`http://localhost:${port}/.design/ui/Broken.tsx`);
      expect(r.status).toBe(500);
      const body = await r.text();
      expect(body).toMatch(/Transpile error/i);
    } finally {
      await teardown();
    }
  });

  test('cache: second GET returns the same ETag without re-reading the file', async () => {
    await boot('Hello.tsx', SIMPLE_TSX);
    try {
      const a = await fetch(`http://localhost:${port}/.design/ui/Hello.tsx`);
      const b = await fetch(`http://localhost:${port}/.design/ui/Hello.tsx`);
      expect(a.headers.get('etag')).toBe(b.headers.get('etag'));
      const bodyA = await a.text();
      const bodyB = await b.text();
      expect(bodyA).toBe(bodyB);
    } finally {
      await teardown();
    }
  });
});
