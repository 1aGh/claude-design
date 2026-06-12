// CSRF Origin guard for the main-origin source-write routes (edit-css /
// edit-text / edit-attr). DDR-103. The DDR-054 origin-split already blocks the
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

import { sameOriginWrite } from '../http.ts';

const SELF = 'http://localhost:4399';
const post = (origin?: string): Request =>
  new Request(`${SELF}/_api/edit-css`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain', ...(origin ? { origin } : {}) },
    body: '{}',
  });

describe('CSRF Origin guard — sameOriginWrite (DDR-103)', () => {
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
