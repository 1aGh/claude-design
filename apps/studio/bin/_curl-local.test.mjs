// DDR-185 — the loopback-only curl gate behind `maude design curl-local`
// (apps/studio/bin/_curl-local.mjs). This suite locks the SECURITY CORE: the
// strict-loopback address classifier (accepts ONLY 127.0.0.0/8 / ::1 / the
// IPv4-mapped form — unlike `_fetch-asset.mjs`'s `classifyAddress`, an
// ordinary private-LAN address like 192.168.1.1 is REJECTED here, not
// allowed), the every-record DNS check (closes the multi-A-record rebinding
// gap), the argv URL scan (curl accepts its target in any position, and more
// than one), and — added by the security addendum — the argv ALLOWLIST that
// rejects `-K`/`--resolve`/`--connect-to`/`-L`/`--proxy` and friends outright
// (a live security fan-out found the first cut's blocklist-free forwarding
// let those flags smuggle an unvalidated second target past the loopback
// check entirely; see the file's own header comment for the two confirmed
// exploits).

import { describe, expect, test } from 'bun:test';
import {
  CurlLocalError,
  classifyRecords,
  findTargetUrls,
  isLoopbackAddress,
  REJECTED_FLAGS,
  resolveLoopbackIp,
  validateArgv,
} from './_curl-local.mjs';

describe('isLoopbackAddress', () => {
  test('accepts IPv4 loopback (127.0.0.0/8, not just 127.0.0.1)', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('127.9.9.9')).toBe(true);
    expect(isLoopbackAddress('127.255.255.255')).toBe(true);
  });

  test('accepts IPv6 ::1 and the IPv4-mapped loopback form', () => {
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
  });

  test("rejects ordinary private-LAN addresses — this is STRICTER than fetch-asset's classifier", () => {
    // fetch-asset's classifyAddress blocks these too (as "not a safe egress
    // target"), but for a different reason (SSRF from an external URL). Here
    // the bar is "is this literally my own machine" — a private-LAN IP is a
    // real, different host, not loopback, and must still prompt.
    expect(isLoopbackAddress('192.168.1.1')).toBe(false);
    expect(isLoopbackAddress('10.0.0.1')).toBe(false);
    expect(isLoopbackAddress('172.16.0.1')).toBe(false);
    expect(isLoopbackAddress('169.254.169.254')).toBe(false); // cloud IMDS
  });

  test('rejects public addresses and link-local/multicast/reserved ranges', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '224.0.0.1', '240.0.0.1', 'fe80::1']) {
      expect(isLoopbackAddress(ip)).toBe(false);
    }
  });

  test('rejects a non-IP string', () => {
    expect(isLoopbackAddress('not-an-ip')).toBe(false);
    expect(isLoopbackAddress('localhost')).toBe(false); // a hostname, not a literal — resolved separately
  });
});

describe('classifyRecords — the every-record check (multi-A-record DNS rebinding)', () => {
  test('all-loopback records pass', () => {
    expect(
      classifyRecords('localhost', [{ address: '127.0.0.1' }, { address: '127.0.0.2' }])
    ).toBeNull();
  });

  test('a single non-loopback record among several loopback ones still fails the whole host', () => {
    const reason = classifyRecords('rebind.example', [
      { address: '127.0.0.1' },
      { address: '93.184.216.34' },
    ]);
    expect(reason).toContain('93.184.216.34');
    expect(reason).toContain('non-loopback');
  });

  test('empty record set fails', () => {
    expect(classifyRecords('empty.example', [])).toContain('no DNS records');
  });
});

describe('resolveLoopbackIp', () => {
  test('an IP-literal host skips DNS entirely — loopback passes, returns itself', async () => {
    await expect(resolveLoopbackIp('127.0.0.1')).resolves.toBe('127.0.0.1');
  });

  test('an IP-literal host that is not loopback throws CurlLocalError(3)', async () => {
    await expect(resolveLoopbackIp('8.8.8.8')).rejects.toThrow(CurlLocalError);
    try {
      await resolveLoopbackIp('8.8.8.8');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe(3);
    }
  });

  test('a hostname resolving to all-loopback records (injected lookup) passes, returns the pin IP', async () => {
    const lookupFn = async () => [
      { address: '127.0.0.1', family: 4 },
      { address: '::1', family: 6 },
    ];
    await expect(resolveLoopbackIp('localhost', { lookupFn })).resolves.toBe('127.0.0.1');
  });

  test('a hostname with ONE non-loopback record among several is rejected (DNS-rebinding defense)', async () => {
    const lookupFn = async () => [
      { address: '127.0.0.1', family: 4 },
      { address: '203.0.113.5', family: 4 }, // TEST-NET-3 — a real "other" address
    ];
    await expect(resolveLoopbackIp('rebind.example', { lookupFn })).rejects.toThrow(CurlLocalError);
  });

  test('DNS resolution failure is a rejection, not a silent pass', async () => {
    const lookupFn = async () => {
      const err = new Error('getaddrinfo ENOTFOUND nope.invalid');
      err.code = 'ENOTFOUND';
      throw err;
    };
    await expect(resolveLoopbackIp('nope.invalid', { lookupFn })).rejects.toThrow(CurlLocalError);
  });
});

describe('validateArgv — the allowlist that closes the -K/--resolve/--connect-to bypasses', () => {
  test('accepts an ordinary loopback invocation', () => {
    expect(validateArgv(['-s', '-X', 'GET', 'http://localhost:3000/api'])).toBeNull();
  });

  for (const flag of REJECTED_FLAGS) {
    test(`rejects ${flag} anywhere in argv`, () => {
      const reason = validateArgv(['http://127.0.0.1:1/', flag, 'x']);
      expect(reason).toContain(flag);
    });
  }

  test('rejects the config-file-injection PoC verbatim (security-auditor finding 1)', () => {
    const reason = validateArgv(['http://127.0.0.1:1/decoy', '-K', 'evil.conf']);
    expect(reason).not.toBeNull();
  });

  test('rejects the --resolve target-override PoC verbatim (ethical-hacker finding B)', () => {
    const reason = validateArgv(['--resolve', 'localhost:80:203.0.113.5', 'http://localhost/']);
    expect(reason).not.toBeNull();
  });

  test('rejects a `--flag=value` form of a rejected flag, not just the bare form', () => {
    expect(
      validateArgv(['http://127.0.0.1:1/', '--proxy=http://evil.example:8080'])
    ).not.toBeNull();
  });
});

describe('findTargetUrls — curl accepts its target URL in any argv position, and more than one', () => {
  test('finds a single URL among flags', () => {
    const urls = findTargetUrls(['-s', '-X', 'GET', 'http://localhost:3000/api']);
    expect(urls).toHaveLength(1);
    expect(urls[0].hostname).toBe('localhost');
  });

  test('finds the URL when flags come AFTER it too', () => {
    const urls = findTargetUrls(['http://localhost:3000/api', '-s']);
    expect(urls).toHaveLength(1);
  });

  test('finds multiple targets (curl supports more than one URL)', () => {
    const urls = findTargetUrls(['http://localhost:1/a', 'http://localhost:2/b']);
    expect(urls.map((u) => u.href)).toEqual(['http://localhost:1/a', 'http://localhost:2/b']);
  });

  test('a flag value that is not a URL (e.g. a JSON payload) is not mistaken for a target', () => {
    const urls = findTargetUrls(['-d', '{"a":1}', 'http://localhost:3000']);
    expect(urls).toHaveLength(1);
    expect(urls[0].hostname).toBe('localhost');
  });

  test('a non-http(s) scheme (file://) is not recognized as a target', () => {
    const urls = findTargetUrls(['file:///etc/passwd']);
    expect(urls).toHaveLength(0);
  });

  test('no URL anywhere in argv returns an empty list', () => {
    expect(findTargetUrls(['--version'])).toHaveLength(0);
  });
});
