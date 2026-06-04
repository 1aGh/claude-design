// Canvas-origin route gate — A1/A2 (DDR-060 F1 re-audit). Boots a real server
// with MAUDE_CANVAS_ORIGIN_SPLIT=1 and probes the segregated canvas origin to
// prove: (1) the %2f-encoded path-traversal that previously leaked repo files
// outside designRoot is now 403'd; (2) privileged routes stay 403; (3) legit
// designRoot assets + the shell still serve; (4) the shell carries the hardened
// CSP. See .ai/logs/security-reviews/phase-9.1-t2-f1-cross-origin-reaudit.md.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

async function readCanvasOrigin(designRoot: string): Promise<string> {
  // server.ts writes _server.json under the designRoot once both listeners bind.
  for (let i = 0; i < 40; i++) {
    try {
      const info = JSON.parse(readFileSync(join(designRoot, '_server.json'), 'utf8'));
      if (info.canvasOrigin) return info.canvasOrigin as string;
    } catch {
      /* not written yet */
    }
    await Bun.sleep(50);
  }
  throw new Error('canvasOrigin never appeared in _server.json');
}

describe('canvas-origin gate — A1/A2 traversal + privilege containment', () => {
  test('%2f traversal out of designRoot is 403; privileged 403; legit 200; CSP hardened', async () => {
    const { root, designRoot } = makeSandbox();
    // A real asset OUTSIDE .design/ but INSIDE repoRoot — the traversal target.
    writeFileSync(join(root, 'secret-outside.css'), '.leak{content:"SECRET"}');
    // A legit canvas asset under designRoot (the allowed case).
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    writeFileSync(
      join(designRoot, 'ui', 'Gate.tsx'),
      'export default function G(){return <main/>}\n'
    );

    const port = nextPort();
    const proc = await bootServer(root, port, { MAUDE_CANVAS_ORIGIN_SPLIT: '1' });
    try {
      const canvas = await readCanvasOrigin(designRoot);
      const code = async (p: string) =>
        (await fetch(canvas + p, { signal: AbortSignal.timeout(2000) })).status;

      // (1) The confirmed bypass — must now be 403, not 200.
      expect(await code('/.design/..%2fsecret-outside.css')).toBe(403);
      expect(await code('/.design/ui/..%2f..%2fsecret-outside.css')).toBe(403);
      // Double-encoded + mixed-case variants stay closed.
      expect(await code('/.design/%2e%2e%2fsecret-outside.css')).toBe(403);

      // (2) Privileged / out-of-scope routes stay 403 on the canvas origin.
      // /_api/canvas (Phase 22 file-write) is deliberately NOT in the canvas
      // origin's route allowlist — an untrusted canvas iframe must never create
      // arbitrary .tsx files. It is reachable ONLY from the main origin.
      for (const p of [
        '/_config',
        '/_sync-status',
        '/_api/export',
        '/_api/canvas',
        '/package.json',
      ]) {
        expect(await code(p)).toBe(403);
      }

      // (3) Legit surfaces still serve.
      expect(await code('/_health')).toBe(200);
      expect(await code('/_canvas-shell.html')).toBe(200);
      // A real .tsx canvas under designRoot transpiles + serves (200).
      expect(await code('/.design/ui/Gate.tsx')).toBe(200);
      // Phase 23 — the capped image-upload route IS reachable from the canvas
      // origin (it must be — drag-drop/paste/picker run inside the iframe). A GET
      // returns 405 (method-not-allowed) which proves the route is REACHED via
      // the canvas server's explicit `routes` allowlist — NOT 403 (gate-blocked)
      // or 404 (fell through to file-serve). Guards the dual-allowlist invariant:
      // CANVAS_SAFE_API + the startCanvasServer `routes` map must stay in sync.
      expect(await code('/_api/asset')).toBe(405);

      // (4) The shell carries the hardened CSP (A6).
      const shell = await fetch(`${canvas}/_canvas-shell.html`);
      const csp = shell.headers.get('content-security-policy') ?? '';
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("webrtc 'block'");
      expect(csp).toContain('frame-ancestors');
      expect(csp).toContain(`http://localhost:${port}`);
    } finally {
      await killProc(proc);
    }
  });
});
