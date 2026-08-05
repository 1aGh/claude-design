// `isTrustedRequestHost` — the mode-aware DNS-rebind guard.
// RCA: issue-cloud-inspector-edits-refused-by-loopback-guard.
//
// The bug: 97 studio route handlers gated on `isLoopbackHost(Host)`, and in a
// cell the hub proxy rewrites Host to the project's PUBLIC name (D4), so that
// check could never pass — every Inspector/artboard edit 403'd while annotations
// (no such guard) synced. The fix keeps the loopback check verbatim OUTSIDE
// workspace mode and, INSIDE a cell, accepts the proxy's unforgeable
// `x-maude-role` vouch instead (the proxy strips every inbound `x-maude-*`
// before injecting its own, so the header's presence proves hub provenance).

import { afterEach, describe, expect, test } from 'bun:test';

import { isTrustedRequestHost } from '../http.ts';

const WS = 'MAUDE_WORKSPACE_MODE';
const prior = process.env[WS];
afterEach(() => {
  if (prior === undefined) delete process.env[WS];
  else process.env[WS] = prior;
});

const req = (host: string | null, extra: Record<string, string> = {}) =>
  new Request('http://x/_api/edit-css', {
    headers: { ...(host ? { host } : {}), ...extra },
  });

describe('local mode — loopback Host only (verbatim DNS-rebind guard)', () => {
  test('loopback Hosts pass', () => {
    delete process.env[WS];
    expect(isTrustedRequestHost(req('localhost:4399'))).toBe(true);
    expect(isTrustedRequestHost(req('127.0.0.1:4399'))).toBe(true);
    expect(isTrustedRequestHost(req('[::1]:4399'))).toBe(true);
  });

  test('a rebound foreign Host is refused — even carrying x-maude-role', () => {
    delete process.env[WS];
    expect(isTrustedRequestHost(req('evil.example:4399'))).toBe(false);
    // Outside a cell the injected header means nothing: there is no proxy in
    // front to have stamped it, so it is attacker-supplied and ignored.
    expect(isTrustedRequestHost(req('evil.example:4399', { 'x-maude-role': 'owner' }))).toBe(false);
  });
});

describe('workspace mode — the hub proxy vouch is accepted', () => {
  test('a public Host WITH an injected role is trusted (the cell shell-edit path)', () => {
    process.env[WS] = '1';
    expect(
      isTrustedRequestHost(req('alligators.cloud.maude.sh', { 'x-maude-role': 'owner' }))
    ).toBe(true);
    expect(
      isTrustedRequestHost(req('alligators.cloud.maude.sh', { 'x-maude-role': 'member' }))
    ).toBe(true);
  });

  test('a public Host WITHOUT an injected role is still refused', () => {
    process.env[WS] = '1';
    // No proxy vouch ⇒ no proof of hub provenance ⇒ the guard holds.
    expect(isTrustedRequestHost(req('alligators.cloud.maude.sh'))).toBe(false);
  });

  test('loopback still passes in workspace mode (the studio binds 127.0.0.1)', () => {
    process.env[WS] = '1';
    expect(isTrustedRequestHost(req('127.0.0.1:4399'))).toBe(true);
  });
});
