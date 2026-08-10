// `_fetch-asset.mjs` — the gate's pure decision functions, plus the three
// DDR-216 additions. Standing tests, not optional hardening: DDR-216's
// Consequences names each of these by hand because this is a SHARED,
// security-reviewed helper whose OTHER caller (the DDR-147 moodboard lane) has
// no host allowlist at all.

import { describe, expect, test } from 'bun:test';

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  FetchAssetError,
  fetchAsset,
  parseHttpsTarget,
  sniffImageExt,
  sniffStagedKind,
} from '../bin/_fetch-asset.mjs';

const FIGMA_HOSTS = ['figma.com', 'figma-alpha-api.s3.us-west-2.amazonaws.com'];

const png = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const svg = (s = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>') => Buffer.from(s, 'utf8');

describe('the host allowlist is exact-or-dotted-suffix, never endsWith', () => {
  test.each([
    ['the apex', 'https://figma.com/x'],
    ['a real subdomain', 'https://www.figma.com/x'],
    ['a deep subdomain', 'https://a.b.figma.com/x'],
    ['the render bucket, exactly', 'https://figma-alpha-api.s3.us-west-2.amazonaws.com/x'],
  ])('admits %s', (_label, url) => {
    expect(() => parseHttpsTarget(url, { allowHosts: FIGMA_HOSTS })).not.toThrow();
  });

  test.each([
    // The classic suffix bug: a bare endsWith('figma.com') admits this.
    ['a suffix look-alike', 'https://evil-figma.com/x'],
    ['figma.com as a prefix of another domain', 'https://figma.com.evil.tld/x'],
    ['an unrelated host', 'https://evil.tld/x'],
    // A bare endsWith('.amazonaws.com') would admit EVERY S3 bucket on earth.
    ['a different S3 bucket', 'https://attacker-bucket.s3.us-west-2.amazonaws.com/x'],
    ['the bare bucket parent', 'https://s3.us-west-2.amazonaws.com/x'],
  ])('refuses %s', (_label, url) => {
    expect(() => parseHttpsTarget(url, { allowHosts: FIGMA_HOSTS })).toThrow(FetchAssetError);
  });

  test("an absent allowlist keeps today's unrestricted behaviour", () => {
    // The moodboard/research lane passes no allowlist and must be untouched.
    expect(() => parseHttpsTarget('https://upload.wikimedia.org/x.png')).not.toThrow();
    expect(parseHttpsTarget('https://anything.example/x').host).toBe('anything.example');
  });

  test('a refusal names the host as a charset-validated token, never raw (D10)', () => {
    try {
      parseHttpsTarget('https://evil.tld/x', { allowHosts: FIGMA_HOSTS });
      throw new Error('expected a rejection');
    } catch (err) {
      expect((err as Error).message).toMatch(/^host not in this lane's allowlist: [a-z0-9.-]+$/);
    }
  });
});

describe('port pinning is opt-in, and is new logic', () => {
  test('the default still accepts any valid port (unchanged behaviour)', () => {
    expect(parseHttpsTarget('https://example.test:8443/x').port).toBe(8443);
  });

  test('the pinned lane refuses a non-443 port', () => {
    expect(() => parseHttpsTarget('https://figma.com:8443/x', { pinPort443: true })).toThrow(
      FetchAssetError
    );
  });

  test('the pinned lane accepts 443, explicit or implicit', () => {
    expect(parseHttpsTarget('https://figma.com/x', { pinPort443: true }).port).toBe(443);
    expect(parseHttpsTarget('https://figma.com:443/x', { pinPort443: true }).port).toBe(443);
  });
});

describe('the allowlist NARROWS the gate — it never replaces the rest of it', () => {
  test.each([
    ['non-https', 'http://figma.com/x'],
    ['embedded credentials', 'https://user:pw@figma.com/x'],
    ['a file URL', 'file:///etc/passwd'],
  ])('%s is still refused even on an allowlisted host', (_label, url) => {
    expect(() => parseHttpsTarget(url, { allowHosts: FIGMA_HOSTS })).toThrow(FetchAssetError);
  });
});

describe('sniffImageExt is NOT widened — the moodboard lane depends on it', () => {
  test.each([
    ['an SVG', svg()],
    ['an XML-prologue SVG', svg('<?xml version="1.0"?><svg></svg>')],
    ['an SVG comment prologue', svg('<!-- c --><svg></svg>')],
    ['HTML', Buffer.from('<!doctype html><html></html>', 'utf8')],
    ['a script', Buffer.from('alert(1)', 'utf8')],
  ])('still returns null for %s', (_label, bytes) => {
    // DDR-216 D11 step 6: this is THE test that makes the tempting two-line
    // "just add svg to the sniff" fix fail CI. If it ever goes green for SVG,
    // arbitrary remote vectors can land in the versioned, peer-synced assets/
    // tree of a lane this feature never touches.
    expect(sniffImageExt(bytes)).toBeNull();
  });

  test('still accepts a real raster', () => {
    expect(sniffImageExt(png())).toBe('png');
  });
});

describe('sniffStagedKind — the --raw-out accept set', () => {
  test('accepts everything sniffImageExt accepts', () => {
    expect(sniffStagedKind(png())).toBe('png');
  });

  test('additionally accepts SVG, which is the whole point of the mode', () => {
    expect(sniffStagedKind(svg())).toBe('svg');
    expect(sniffStagedKind(svg('<?xml version="1.0"?><svg></svg>'))).toBe('svg');
  });

  test('still REFUSES the things a bypass would let through', () => {
    // `--raw-out` must never mean "skip the type gate" — that would turn the one
    // reviewable downloader into an unsniffed one for the next caller.
    expect(sniffStagedKind(Buffer.from('<!doctype html><html></html>', 'utf8'))).toBeNull();
    expect(sniffStagedKind(Buffer.from('alert(1)', 'utf8'))).toBeNull();
    expect(sniffStagedKind(Buffer.from('PKzipbytes', 'utf8'))).toBeNull();
    expect(sniffStagedKind(Buffer.from('', 'utf8'))).toBeNull();
  });

  test('only the HEAD is probed — a late `<svg` does not rescue a blob', () => {
    const late = Buffer.concat([Buffer.alloc(512, 0x41), svg()]);
    expect(sniffStagedKind(late)).toBeNull();
  });
});

describe('--raw-out containment survives an OS-symlinked temp root', () => {
  test('a legitimate staging path under os.tmpdir() is ACCEPTED', async () => {
    // The bug this pins: `realpathSync` on the root but not the target compares
    // `/private/var/…` against `/var/…` on macOS (both `/var` and `/tmp` are
    // OS-level symlinks) and rejects every legitimate path. It shipped, and the
    // first real import skipped all 29 of its assets with a generic
    // "download or sanitize failed". Same trap DDR-172 Decision 1 documents.
    const dir = mkdtempSync(join(tmpdir(), 'raw-out-probe-'));
    try {
      const out = join(dir, 'staged.png');
      // Reaches the network gate rather than the containment check: any throw
      // must NOT be the containment one.
      let err: unknown;
      try {
        await fetchAsset({
          url: 'https://figma.com/definitely-not-real.png',
          root: dir,
          rawOut: out,
          rawRoot: dir,
          allowHosts: FIGMA_HOSTS,
          maxTime: 1,
        });
      } catch (e) {
        err = e;
      }
      expect((err as Error | undefined)?.message ?? '').not.toContain('--raw-out must resolve');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a path OUTSIDE the declared root is still refused', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'raw-out-probe-'));
    try {
      await expect(
        fetchAsset({
          url: 'https://figma.com/x.png',
          root: dir,
          rawOut: join(dir, '..', 'escaped.png'),
          rawRoot: dir,
          allowHosts: FIGMA_HOSTS,
        })
      ).rejects.toThrow(/--raw-out must resolve inside/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('--raw-out without --raw-root is refused outright', async () => {
    await expect(
      fetchAsset({ url: 'https://figma.com/x.png', root: '/tmp', rawOut: '/tmp/x.png' })
    ).rejects.toThrow(/requires --raw-root/);
  });
});
