// CSRF Origin guard for the main-origin source-write routes (edit-css /
// edit-text / edit-attr). DDR-105. The DDR-054 origin-split already blocks the
// untrusted canvas *iframe* (canvas-origin-gate.test.ts proves that). This guard
// covers the OTHER untrusted origin: a malicious top-level page in another tab
// forging a `text/plain` CORS simple-request POST to localhost. The browser
// stamps such a request with an unspoofable cross-origin `Origin` header, so the
// guard must reject it — while still letting the legit same-origin shell write
// and not breaking non-browser clients (which send no Origin header).
//
// Unit-level on purpose: `sameOriginWrite` is a pure function of the Request, so
// we exercise the decision directly instead of booting a subprocess server.
// (A booted-server integration test would add a 124th server-booting file to the
// suite, which perturbs bun's worker scheduling and surfaces a PRE-EXISTING
// cross-worker port-collision flake in canvas-meta-api.test.ts — a test-harness
// race unrelated to this guard. See the Phase 12.2 validate notes.)

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { sameOriginWrite } from '../http.ts';

const SELF = 'http://localhost:4399';
const post = (origin?: string): Request =>
  new Request(`${SELF}/_api/edit-css`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain', ...(origin ? { origin } : {}) },
    body: '{}',
  });

describe('CSRF Origin guard — sameOriginWrite (DDR-105)', () => {
  test('rejects a forged cross-origin Origin', () => {
    expect(sameOriginWrite(post('http://evil.example'))).toBe(false);
    // A look-alike host (substring / suffix tricks) must not slip through.
    expect(sameOriginWrite(post('http://localhost.evil.example'))).toBe(false);
    expect(sameOriginWrite(post('http://localhost:4399.evil.example'))).toBe(false);
    // Right host, wrong port is still cross-origin.
    expect(sameOriginWrite(post('http://localhost:4400'))).toBe(false);
    // Right host:port, wrong scheme is still cross-origin.
    expect(sameOriginWrite(post('https://localhost:4399'))).toBe(false);
  });

  test('allows the legit same-origin shell Origin', () => {
    expect(sameOriginWrite(post(SELF))).toBe(true);
  });

  test('allows a request with no Origin header (curl / programmatic / bun:test)', () => {
    expect(sameOriginWrite(post())).toBe(true);
  });

  test('rejects an unparseable Origin rather than letting it through', () => {
    expect(sameOriginWrite(post('not a url'))).toBe(false);
  });
});

// phase-30 / DDR-120: the ai-activity bridge now projects `/_api/ai/*` POSTs
// onto room awareness, which crosses the hub to every connected peer. So a
// forged cross-origin POST to /start /heartbeat /end is no longer a harmless
// loopback banner — it injects a fake "<x> is editing <slug>" presence to all
// peers (the channel that drives the social save/publish decision). These three
// routes MUST carry the same `sameOriginWrite` guard as the other write routes.
// Source-level assertion (same "don't boot a server" rationale as above): pin
// the guard into each route block so an accidental removal fails CI.
describe('CSRF Origin guard — /_api/ai/* presence-bridge routes (phase-30)', () => {
  const src = readFileSync(fileURLToPath(new URL('../http.ts', import.meta.url)), 'utf8');

  for (const route of ['/_api/ai/start', '/_api/ai/heartbeat', '/_api/ai/end']) {
    test(`${route} is wired with the sameOriginWrite CSRF guard`, () => {
      // Slice from this route's key to the next route key, then assert the guard
      // appears inside that block.
      const start = src.indexOf(`'${route}':`);
      expect(start).toBeGreaterThan(-1);
      const after = src.indexOf("'/_api/", start + 1);
      const block = src.slice(start, after === -1 ? undefined : after);
      expect(block).toContain('sameOriginWrite(req)');
    });
  }
});
