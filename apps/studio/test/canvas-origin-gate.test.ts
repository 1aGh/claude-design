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
      // Phase 12 (DDR-103) — the in-canvas direct-edit write routes are
      // MAIN-ORIGIN ONLY: absent from CANVAS_SAFE_API + startCanvasServer's
      // route map, so the untrusted canvas iframe origin must never reach a
      // source-write endpoint. A GET here 403s at the gate (not 405 from the
      // handler), proving the route is unreachable on this origin.
      for (const p of [
        '/_config',
        '/_sync-status',
        '/_api/export',
        // feature-background-export-notification-center — the background job
        // routes carry the same privileged data class as /_api/export (job
        // status, progress, and eventually the rendered bytes); absent from
        // CANVAS_SAFE_API + startCanvasServer's routes (dual-allowlist).
        '/_api/export-jobs',
        '/_api/export-jobs/download',
        '/_api/canvas',
        '/_api/edit-css',
        '/_api/edit-text',
        '/_api/edit-attr',
        // DDR-148 — raw canvas source for the Timeline parser is MAIN-ORIGIN
        // ONLY (the untrusted canvas iframe must never read project source).
        '/_api/canvas-source',
        // DDR-148 — Timeline drag-to-retime is a source-write, MAIN-ORIGIN ONLY.
        '/_api/retime-sequence',
        // DDR-150 P2 — the clip enumerator reads project source structure, so it
        // is MAIN-ORIGIN ONLY (same boundary as /_api/canvas-source): the
        // untrusted canvas iframe must never enumerate the comp it renders.
        '/_api/comp-clips',
        // DDR-150 P3 — clip removal is a source-write, MAIN-ORIGIN ONLY.
        '/_api/remove-sequence',
        // DDR-150 P4 — clip insert is a source-write, MAIN-ORIGIN ONLY.
        '/_api/insert-sequence',
        // DDR-150 P5 — z-order reorder is a source-write, MAIN-ORIGIN ONLY.
        '/_api/reorder-sequence',
        // DDR-150 dogfood — array-src replace is a source-write, MAIN-ORIGIN ONLY.
        '/_api/edit-array-src',
        // DDR-150 dogfood — clip hide/show is a source-write, MAIN-ORIGIN ONLY.
        '/_api/toggle-hide',
        // Phase 12.1 (DDR-138) — node-move reorder is a source-write, MAIN-ORIGIN
        // ONLY. The canvas iframe requests a reorder over the dgn:* bus; the shell
        // performs the write. A GET here 403s at the gate (route unreachable on
        // this origin), not 405 from the handler. Same boundary for the Cmd+Z
        // revert route (whole-file swap — strictly more powerful than a move).
        '/_api/reorder',
        '/_api/reorder-revert',
        // Stage I (feature-element-editing-robustness) — general element
        // structural edits (delete / insert / new-artboard) + free-hand artboard
        // resize (D4) are ALL source-writes, MAIN-ORIGIN ONLY. The untrusted
        // canvas iframe requests them over the dgn:* bus; the shell performs the
        // write. A GET from the canvas origin must 403 at the gate (route
        // unreachable on this origin), never 405 from a reached handler.
        '/_api/delete-element',
        '/_api/insert-element',
        '/_api/duplicate-element',
        '/_api/insert-artboard',
        '/_api/resize-artboard',
        '/_api/delete-artboard',
        // Stage F1 — the AssetPicker's asset-listing GET is a shell (main-origin)
        // concern; the untrusted canvas iframe must not enumerate project media.
        '/_api/assets',
        // Stage H — the edit-scope (local-vs-shared) verdict is a shell badge
        // concern; the untrusted canvas origin must not reach it (dual-allowlist).
        '/_api/edit-scope',
        // Phase 27 (E2) — every /_api/git/* route is MAIN-ORIGIN ONLY: absent from
        // CANVAS_SAFE_API + startCanvasServer's `routes` map. A GET from the
        // canvas origin must 403 at the gate (not 405 from a reached handler),
        // proving the route is unreachable on this origin. Guards the dual-
        // allowlist invariant for the token-bearing publish/get-latest endpoints.
        '/_api/git/status',
        '/_api/git/log',
        '/_api/git/diff',
        '/_api/git/commit',
        '/_api/git/discard',
        '/_api/git/push',
        '/_api/git/pull',
        '/_api/git/resolve',
        // Phase 29 (E4) — drafts: list + create + switch + fold are MAIN-ORIGIN ONLY.
        '/_api/git/branches',
        '/_api/git/branch',
        '/_api/git/checkout',
        '/_api/git/fold',
        // Remote drafts: token-bearing fetch — MAIN-ORIGIN ONLY.
        '/_api/git/fetch',
        // Phase 28 (E3) — every /_api/github/* route is MAIN-ORIGIN ONLY (absent
        // from CANVAS_SAFE_API + startCanvasServer's `routes` map) and token-bearing.
        // The untrusted canvas iframe origin must never reach identity/create-repo/
        // invite/repos — a request from this origin 403s at the gate. This is also
        // the guard that the GitHub token (server-held, keychain) can never be
        // exfiltrated to the canvas realm.
        '/_api/github/identity',
        '/_api/github/repos',
        '/_api/github/create-repo',
        '/_api/github/invite',
        '/_api/github/clone',
        '/_api/github/create-project',
        // Local-only project create (mkdir + git init + scaffold) — writes to disk,
        // no token; MAIN-ORIGIN ONLY, so the canvas origin must 403 at the gate.
        '/_api/project/create-local',
        '/_api/design/init',
        // Phase 29 (E4) Door C — the hub-link credential write is MAIN-ORIGIN ONLY;
        // the untrusted canvas origin must never reach it (it writes the global
        // ~/.config/maude/hubs.json token store).
        '/_api/hub/link',
        // ACP chat attachments (POST upload + GET thumbnail serve) are MAIN-ORIGIN
        // ONLY — absent from CANVAS_SAFE_API + startCanvasServer's routes. The
        // untrusted canvas origin must never read (or write) the user's pasted
        // chat images; a GET here 403s at the gate, not 404 from the handler.
        '/_api/acp/attachment',
        // Phase 4 (feature-whiteboard-annotation-improvements) — the sticker
        // catalogue + bundled sticker PNGs are MAIN-ORIGIN ONLY, same posture
        // as /_api/assets above: the StickerPicker is shell UI, absent from
        // CANVAS_SAFE_API + startCanvasServer's routes. A GET here 403s at
        // the gate on both — the catalogue route and the static PNG serve.
        '/_api/stickers',
        '/_stickers/some-pack/some-sticker.png',
        // feature-footage-analysis-director — the footage-analysis + EDL sidecar
        // route is MAIN-ORIGIN ONLY (written by the analyst/director agents over
        // loopback; absent from CANVAS_SAFE_API + startCanvasServer's routes). The
        // untrusted canvas origin must never read/write the director's analysis —
        // a GET here 403s at the gate, not 405 from a reached handler.
        '/_api/footage',
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
      // DDR-148 — media-src must be present so a video-comp's <Video>/<Audio>
      // isn't blocked by default-src 'none' (black video / silent audio).
      expect(csp).toContain("media-src 'self'");
      expect(csp).toContain("webrtc 'block'");
      expect(csp).toContain('frame-ancestors');
      expect(csp).toContain(`http://localhost:${port}`);

      // (5) DDR-148 attacker F1 — the EXPORT/CAPTURE render (?hide-chrome=1) on
      // the MAIN origin (where the normal shell CSP is off) MUST carry the
      // network-locked capture CSP, else a canvas <Video src="http://internal">
      // or comp fetch() turns ⌘E into read-SSRF + exfil-via-artifact.
      const capMain = await fetch(`http://localhost:${port}/_canvas-shell.html?hide-chrome=1`);
      const capCsp = capMain.headers.get('content-security-policy') ?? '';
      expect(capCsp).toContain("media-src 'self'"); // <Video src=external> blocked
      expect(capCsp).toContain("connect-src 'self'"); // comp fetch(external) blocked
      expect(capCsp).toContain("img-src 'self'");
      expect(capCsp).toContain("object-src 'none'");
      // A normal main-origin shell (no capture flag) stays CSP-off (back-compat).
      const plainMain = await fetch(`http://localhost:${port}/_canvas-shell.html`);
      expect(plainMain.headers.get('content-security-policy')).toBeNull();
    } finally {
      await killProc(proc);
    }
  });
});
