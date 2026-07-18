#!/usr/bin/env node
// _curl-local.mjs — loopback-only curl, reached via `maude design curl-local`
// (DDR-062 dispatch; DDR-185).
//
// WHY THIS EXISTS: an ACP chat session auto-approves `Bash(maude:*)` (DDR-184)
// but NOT a bare `curl` — every raw `curl` call still prompts, even one aimed
// at the user's own localhost dev server (a common ask mid design-workflow:
// "is my backend up on :3000?"). Claude Code's `Bash(prefix:*)` allowlist is a
// plain string-prefix match with no host awareness (`Bash(curl http://localhost:*)`
// doesn't match `curl -s http://localhost:3000` — the flag breaks the prefix),
// so a prefix-list can't express "curl, but only to localhost" reliably. This
// verb does the real check instead: resolve the request's target host and
// refuse to invoke curl at all unless every resolved address is loopback.
// Covered for free by the EXISTING `Bash(maude:*)` allow-list rule — no
// widening of the session's Bash surface.
//
// Reuses `_fetch-asset.mjs`'s battle-tested IPv4/IPv6 literal parsers
// (`parseIPv4`/`parseIPv6`) rather than reinventing address parsing, but with
// the OPPOSITE accept condition: fetch-asset's `classifyAddress` rejects
// loopback/private/link-local/etc. and allows everything else (it's fetching
// attacker-controlled URLs from the open web); curl-local requires STRICT
// loopback and rejects everything else, including ordinary private-LAN
// addresses (192.168.x.x etc.) — this verb is for "my own machine", not
// "anything reachable on my network".
//
// Unlike fetch-asset, this does NOT DNS-pin the connection or disable
// redirects — the target is the user's OWN local dev server (not an
// attacker-controlled external URL), and that server issuing its own internal
// redirects (e.g. `/` → `/login`) is ordinary, expected behavior, not a threat
// this verb needs to defend against.
//
// Every http(s)-looking argument (curl accepts the target URL in any argv
// position) must resolve to loopback — not just the first one found — so
// `curl-local http://localhost:1/a http://evil.example/b` (multiple targets)
// can't slip a non-local target past a first-match-only scan.
//
// Exit: curl's own exit code on success · 2 usage · 3 non-loopback target
//       (or DNS resolution failure) rejected · 1 other.

import { spawnSync } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import { parseIPv4, parseIPv6 } from './_fetch-asset.mjs';

/** True iff this parsed 4-byte IPv4 is in the loopback range 127.0.0.0/8. */
function isLoopbackIPv4(bytes) {
  return bytes[0] === 127;
}

/** True iff this parsed 16-byte IPv6 is ::1, or an IPv4-mapped/NAT64 loopback. */
function isLoopbackIPv6(bytes) {
  const allZeroThrough = (n) => bytes.slice(0, n).every((x) => x === 0);
  if (allZeroThrough(15) && bytes[15] === 1) return true; // ::1
  if (allZeroThrough(10) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isLoopbackIPv4(bytes.slice(12, 16)); // ::ffff:127.x.x.x
  }
  return false;
}

/** True iff this IP literal is strictly loopback — never any other private/reserved range. */
export function isLoopbackAddress(addr) {
  const kind = isIP(addr);
  if (kind === 4) {
    const bytes = parseIPv4(addr);
    return !!bytes && isLoopbackIPv4(bytes);
  }
  if (kind === 6) {
    const bytes = parseIPv6(addr);
    return !!bytes && isLoopbackIPv6(bytes);
  }
  return false;
}

export class CurlLocalError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Pure check over an already-resolved record set (the shape `dns.lookup(host,
 * {all:true})` returns): every record must be loopback, or this returns a
 * block-reason string naming the first offending address. A single
 * non-loopback record among several (multi-record DNS rebinding) fails the
 * whole host, not just that one record — split out from `assertLoopbackHost`
 * so it's testable with a plain array literal, no DNS/module mocking needed.
 */
export function classifyRecords(host, records) {
  if (!records || !records.length) return `no DNS records for ${host}`;
  for (const { address } of records) {
    if (!isLoopbackAddress(address)) {
      return `${host} resolves to non-loopback ${address} — refusing`;
    }
  }
  return null;
}

/**
 * Resolve every DNS record for `host` and require ALL of them to be loopback.
 * `lookupFn` is injectable (defaults to the real `node:dns/promises` `lookup`)
 * purely so tests can supply a deterministic multi-record response without
 * mocking the `node:dns` module itself.
 */
export async function assertLoopbackHost(host, { lookupFn = lookup } = {}) {
  if (isIP(host)) {
    if (!isLoopbackAddress(host)) {
      throw new CurlLocalError(3, `${host} is not a loopback address`);
    }
    return;
  }
  let records;
  try {
    records = await lookupFn(host, { all: true, verbatim: true });
  } catch (err) {
    throw new CurlLocalError(3, `DNS resolution failed for ${host}: ${err?.code ?? err?.message}`);
  }
  const blockReason = classifyRecords(host, records);
  if (blockReason) throw new CurlLocalError(3, blockReason);
}

/**
 * Every http(s) URL among argv's non-flag-looking tokens — curl accepts its
 * target URL in any position, and a request may name more than one target.
 * A token that fails to parse as a URL, or parses with a non-http(s) scheme
 * (file://, gopher://, …), is simply not a target this scan recognizes.
 */
export function findTargetUrls(argv) {
  const urls = [];
  for (const a of argv) {
    if (!a || a.startsWith('-')) continue;
    try {
      const u = new URL(a);
      if (u.protocol === 'http:' || u.protocol === 'https:') urls.push(u);
    } catch {
      // not a URL — a flag value (e.g. `-d '{"a":1}'`) or similar; keep scanning.
    }
  }
  return urls;
}

const HELP = `curl-local — loopback-only curl (reached via \`maude design curl-local\`)

Usage:
  maude design curl-local <curl-args...>

Resolves every http(s) target in the given curl arguments and refuses to run
curl at all unless EVERY resolved address is loopback (127.0.0.0/8 or ::1).
On success, forwards straight through to a real \`curl\` with the same argv and
the same exit code.

Exit: curl's own exit code · 2 usage · 3 non-loopback target rejected · 1 other.`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${HELP}\n`);
    process.exit(argv.length === 0 ? 2 : 0);
  }
  const targets = findTargetUrls(argv);
  if (targets.length === 0) {
    process.stderr.write('curl-local: no http(s) URL found in arguments\n');
    process.exit(2);
  }
  try {
    for (const u of targets) {
      await assertLoopbackHost(u.hostname);
    }
  } catch (err) {
    process.stderr.write(`curl-local: ${err.message}\n`);
    process.exit(err instanceof CurlLocalError ? err.code : 1);
  }
  const result = spawnSync('curl', argv, { stdio: 'inherit' });
  if (result.error) {
    process.stderr.write(`curl-local: failed to run curl: ${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

// Run only when invoked directly (not when imported by the test). This shim
// runs under real `node` on a real on-disk path (never embedded in
// `bun --compile`), so the classic argv[1] guard is correct here — see the
// v0.38.0 self-heal memory.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
