// DNS-rebinding guard on the main-origin source-write/read family.
//
// The dev-server binds 127.0.0.1, but `sameOriginWrite` is a *reflective* Origin
// check — after a DNS-rebind (`evil.example → 127.0.0.1`) the browser sends
// `Origin: http://evil.example:<port>` AND `Host: evil.example:<port>`, so both
// sides of the origin comparison are attacker-controlled and equal → CSRF passes.
// Every source-write/read route now also requires a loopback `Host` (the same
// `isLoopbackHost` guard the /_api/git/* routes already carry). A real browser
// always sends `Host: localhost|127.0.0.1:<port>` → passes; a rebound foreign
// hostname → 403. Regression guard for the /flow:done DDR-150 attacker finding.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

describe('DNS-rebinding guard — source-write/read family requires a loopback Host', () => {
  test('rebound Host 403s writes + reads; a loopback Host passes the guard', async () => {
    const { root, designRoot } = makeSandbox();
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    writeFileSync(join(designRoot, 'ui', 'C.tsx'), 'export default function C(){return <main/>}\n');

    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      const base = `http://localhost:${port}`;
      // A rebound page: its Host header is the attacker's rebound hostname.
      const evilHost = `evil.example:${port}`;

      // WRITE route (POST) — the loopback guard fires (before the op runs).
      const wEvil = await fetch(`${base}/_api/toggle-hide`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', host: evilHost },
        body: JSON.stringify({ canvas: 'ui/C.tsx', stableId: 'x' }),
      });
      expect(wEvil.status).toBe(403);

      // A second write route, to prove it's the whole family, not one endpoint.
      const wEvil2 = await fetch(`${base}/_api/edit-text`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', host: evilHost },
        body: JSON.stringify({ canvas: 'ui/C.tsx', id: 'x', text: 'y' }),
      });
      expect(wEvil2.status).toBe(403);

      // feature-background-export-notification-center (/flow:done security
      // fan-out) — the export-jobs family joined the guard too: POST enqueue,
      // GET list, GET download all require a loopback Host.
      const wEvilExport = await fetch(`${base}/_api/export-jobs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', host: evilHost },
        body: JSON.stringify({ format: 'zip', scope: 'project-raw' }),
      });
      expect(wEvilExport.status).toBe(403);
      const wEvilExportSync = await fetch(`${base}/_api/export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', host: evilHost },
        body: JSON.stringify({ format: 'zip', scope: 'project-raw' }),
      });
      expect(wEvilExportSync.status).toBe(403);
      const rEvilJobs = await fetch(`${base}/_api/export-jobs`, { headers: { host: evilHost } });
      expect(rEvilJobs.status).toBe(403);
      const rEvilDownload = await fetch(`${base}/_api/export-jobs/download?id=x`, {
        headers: { host: evilHost },
      });
      expect(rEvilDownload.status).toBe(403);

      // READ routes (GET) — a rebound same-origin page could otherwise CORS-read
      // raw project source; the guard 403s them too.
      const rEvil = await fetch(`${base}/_api/canvas-source?file=ui/C.tsx`, {
        headers: { host: evilHost },
      });
      expect(rEvil.status).toBe(403);
      const rEvil2 = await fetch(`${base}/_api/comp-clips?canvas=ui/C.tsx`, {
        headers: { host: evilHost },
      });
      expect(rEvil2.status).toBe(403);

      // A real browser (loopback Host) is NOT rejected by the rebind guard — the
      // source read succeeds (200). Proves the guard doesn't false-positive on
      // the legitimate local request every real user makes.
      const rOk = await fetch(`${base}/_api/canvas-source?file=ui/C.tsx`, {
        headers: { host: `localhost:${port}` },
      });
      expect(rOk.status).toBe(200);
      // 127.0.0.1 Host is equally valid (the printed URL variant).
      const rOk2 = await fetch(`${base}/_api/canvas-source?file=ui/C.tsx`, {
        headers: { host: `127.0.0.1:${port}` },
      });
      expect(rOk2.status).toBe(200);
      // Same false-positive check for the export-jobs family (loopback Host passes).
      const rOkJobs = await fetch(`${base}/_api/export-jobs`, {
        headers: { host: `localhost:${port}` },
      });
      expect(rOkJobs.status).toBe(200);
    } finally {
      await killProc(proc);
    }
  });
});
