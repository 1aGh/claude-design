// DDR-147 § Security follow-up item 1 — the hardened `maude design fetch-asset`
// helper (apps/studio/bin/_fetch-asset.mjs). This suite locks the SECURITY CORE
// that the untrusted-fetch rails promise: the resolved-IP SSRF classifier
// (reject loopback / link-local / RFC-1918 / CGNAT / multicast / reserved, v4 +
// v6 incl. IPv4-mapped + NAT64), https-only URL parsing, the png/jpg/gif/webp
// magic sniff (SVG/HTML rejected), the content-addressed name contract, and the
// realpath containment assertion. Runs under `pnpm test` (node --test cli/**).
//
// The network path (curl) is exercised by the manual smoke in the RCA/PR; these
// are the offline, deterministic guards a regression would trip.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const MOD = resolve(REPO, 'apps', 'studio', 'bin', '_fetch-asset.mjs');

const {
  classifyAddress,
  parseIPv4,
  parseIPv6,
  parseHttpsTarget,
  sniffImageExt,
  assetName,
  containedAssetPath,
  FetchAssetError,
} = await import(MOD);

// ── SSRF classifier: BLOCKED addresses ───────────────────────────────────────
test('classifyAddress blocks private / loopback / link-local / reserved IPv4', () => {
  const blocked = [
    '127.0.0.1',
    '127.9.9.9',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // AWS/GCP IMDS
    '169.254.0.1',
    '100.64.0.1', // CGNAT
    '100.127.255.255',
    '0.0.0.0',
    '224.0.0.1', // multicast
    '239.255.255.255',
    '240.0.0.1', // reserved
    '255.255.255.255',
    '198.18.0.1', // benchmark
    '192.0.2.5', // TEST-NET-1
    '192.0.0.1', // IETF
  ];
  for (const ip of blocked) {
    assert.ok(classifyAddress(ip), `expected ${ip} to be BLOCKED but it was allowed`);
  }
});

test('classifyAddress allows genuine public IPv4 (incl. just-outside-range boundaries)', () => {
  const allowed = [
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34', // example.com
    '172.15.255.255', // just below 172.16/12
    '172.32.0.1', // just above 172.31
    '100.63.255.255', // just below CGNAT
    '100.128.0.1', // just above CGNAT
    '169.253.255.255', // just below link-local
    '11.0.0.1',
    '192.167.255.255',
    '192.169.0.1',
    '223.255.255.255', // just below multicast
  ];
  for (const ip of allowed) {
    assert.equal(classifyAddress(ip), null, `expected ${ip} to be ALLOWED but it was blocked`);
  }
});

test('classifyAddress blocks loopback / link-local / ULA / multicast + embedded-v4 IPv6', () => {
  const blocked = [
    '::1', // loopback
    '::', // unspecified
    'fe80::1', // link-local
    'fe80::abcd:1234',
    'fc00::1', // ULA
    'fd12:3456::1', // ULA
    'ff02::1', // multicast
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    '::ffff:10.0.0.1', // IPv4-mapped private
    '::ffff:169.254.169.254', // IPv4-mapped IMDS
    '64:ff9b::127.0.0.1', // NAT64 → loopback
    '64:ff9b::192.168.0.1', // NAT64 → private
  ];
  for (const ip of blocked) {
    assert.ok(classifyAddress(ip), `expected ${ip} to be BLOCKED but it was allowed`);
  }
});

test('classifyAddress allows genuine public IPv6 (incl. IPv4-mapped public)', () => {
  const allowed = [
    '2001:4860:4860::8888', // Google DNS
    '2606:4700:4700::1111', // Cloudflare DNS
    '::ffff:8.8.8.8', // IPv4-mapped PUBLIC → allowed via embedded classify
    '2a00:1450:4001:81b::200e',
  ];
  for (const ip of allowed) {
    assert.equal(classifyAddress(ip), null, `expected ${ip} to be ALLOWED but it was blocked`);
  }
});

test('classifyAddress fail-closes on non-IP / garbage input', () => {
  for (const bad of ['not-an-ip', 'example.com', '', '999.999.999.999', 'gggg::1']) {
    assert.ok(classifyAddress(bad), `expected ${JSON.stringify(bad)} to be treated as blocked`);
  }
});

// ── IP parsers ───────────────────────────────────────────────────────────────
test('parseIPv4 rejects malformed dotted-quads', () => {
  for (const bad of ['1.2.3', '1.2.3.4.5', '256.1.1.1', '01.2.3.4', '1.2.3.a', '', '-1.2.3.4']) {
    assert.equal(parseIPv4(bad), null, `expected ${JSON.stringify(bad)} to fail parse`);
  }
  assert.deepEqual([...parseIPv4('1.2.3.4')], [1, 2, 3, 4]);
  assert.deepEqual([...parseIPv4('255.255.255.255')], [255, 255, 255, 255]);
});

test('parseIPv6 handles ::, embedded IPv4, zone id; rejects malformed', () => {
  assert.ok(parseIPv6('::1'));
  assert.ok(parseIPv6('::'));
  assert.ok(parseIPv6('fe80::1%en0')); // zone id stripped
  assert.ok(parseIPv6('2001:db8::1'));
  assert.ok(parseIPv6('::ffff:1.2.3.4'));
  for (const bad of ['gggg::', '1::2::3', '12345::', '1.2.3.4', '']) {
    assert.equal(parseIPv6(bad), null, `expected ${JSON.stringify(bad)} to fail parse`);
  }
});

// ── URL target ───────────────────────────────────────────────────────────────
test('parseHttpsTarget accepts https and extracts host/port', () => {
  assert.deepEqual(parseHttpsTarget('https://example.com/a.png'), {
    host: 'example.com',
    port: 443,
  });
  assert.deepEqual(parseHttpsTarget('https://cdn.example.com:8443/x'), {
    host: 'cdn.example.com',
    port: 8443,
  });
});

test('parseHttpsTarget rejects non-https, credentials, and hostless URLs', () => {
  const bad = [
    'http://example.com/a.png',
    'ftp://example.com/a.png',
    'file:///etc/passwd',
    'https://user:pass@example.com/a.png',
    'not a url',
  ];
  for (const u of bad) {
    assert.throws(() => parseHttpsTarget(u), FetchAssetError, `expected ${u} to throw`);
  }
});

// ── image sniff ──────────────────────────────────────────────────────────────
test('sniffImageExt recognises png/jpg/gif/webp and rejects SVG/HTML/empty', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);
  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(sniffImageExt(png), 'png');
  assert.equal(sniffImageExt(jpg), 'jpg');
  assert.equal(sniffImageExt(gif), 'gif');
  assert.equal(sniffImageExt(webp), 'webp');
  assert.equal(sniffImageExt(Buffer.from('<svg xmlns="...')), null);
  assert.equal(sniffImageExt(Buffer.from('<!DOCTYPE html>')), null);
  assert.equal(sniffImageExt(Buffer.from([])), null);
  // RIFF that is NOT webp (e.g. wav) must not sniff as an image.
  assert.equal(
    sniffImageExt(Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])),
    null
  );
});

// ── naming + containment ─────────────────────────────────────────────────────
test('assetName is content-addressed <sha8>.<ext> and deterministic', () => {
  const bytes = Buffer.from('hello world');
  const n1 = assetName(bytes, 'png');
  const n2 = assetName(bytes, 'png');
  assert.equal(n1, n2);
  assert.match(n1, /^[a-f0-9]{8}\.png$/);
  assert.notEqual(assetName(Buffer.from('other'), 'jpg'), n1);
});

test('containedAssetPath resolves under <root>/<designRoot>/assets and rejects escape', () => {
  const { assetsDir, fileAbs } = containedAssetPath('/repo', '.design', 'a1b2c3d4.png');
  assert.equal(assetsDir, resolve('/repo/.design/assets'));
  assert.equal(fileAbs, resolve('/repo/.design/assets/a1b2c3d4.png'));
  // A traversal name escapes → throws.
  assert.throws(() => containedAssetPath('/repo', '.design', '../../etc/passwd'), FetchAssetError);
  // A design-root that climbs out of the repo → throws.
  assert.throws(() => containedAssetPath('/repo', '../../etc', 'a1b2c3d4.png'), FetchAssetError);
});

// ── wiring: verb registered + helper files ship ──────────────────────────────
test('fetch-asset is a registered `maude design` bin verb with both helper files present', () => {
  assert.ok(existsSync(resolve(REPO, 'apps/studio/bin/fetch-asset.sh')), 'fetch-asset.sh missing');
  assert.ok(
    existsSync(resolve(REPO, 'apps/studio/bin/_fetch-asset.mjs')),
    '_fetch-asset.mjs missing'
  );
  const design = readFileSync(resolve(REPO, 'cli/commands/design.mjs'), 'utf8');
  assert.match(design, /'fetch-asset'/, "'fetch-asset' not in design.mjs BIN_VERBS");
});
