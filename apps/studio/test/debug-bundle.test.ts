// debug-bundle scrubber + ring — feature-bug-report-button.
//
// The scrubber is a PRIVACY GATE, not tidiness: docs/report-schema.md promises
// every log line is deterministically cleaned server-side before it can enter
// a report. Extend these tests FIRST when extending the scrubber.

import { describe, expect, test } from 'bun:test';

import {
  buildDebugBundle,
  installLogRing,
  logRingLines,
  recordLogLine,
  scrub,
} from '../debug-bundle.ts';

describe('scrub()', () => {
  test('repo-absolute paths collapse to <project>/ BEFORE home collapses to ~', () => {
    const out = scrub('error at /Users/jane/git/acme/src/app.ts and /Users/jane/notes.txt', {
      home: '/Users/jane',
      repoRoot: '/Users/jane/git/acme',
    });
    expect(out).toBe('error at <project>/src/app.ts and ~/notes.txt');
  });

  test('GitHub tokens (classic + fine-grained) are redacted', () => {
    const out = scrub('using ghp_AbC123xyzAbC123xyz and github_pat_11ABCDEF0abcdef', {
      home: '/h',
    });
    expect(out).not.toContain('ghp_');
    expect(out).not.toContain('github_pat_');
    expect(out).toContain('[redacted]');
  });

  test('bearer headers, sk- keys and JWTs are redacted', () => {
    const out = scrub(
      'sent Bearer abc.def.ghi then sk-ant-api03-longsecretvalue then eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig-part',
      { home: '/h' }
    );
    expect(out).toContain('Bearer [redacted]');
    expect(out).not.toContain('sk-ant-api03');
    expect(out).not.toContain('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0');
    // An `Authorization:` header form over-redacts (key rule wins) — that is
    // acceptable: privacy failures here are leaks, never extra redaction.
    const hdr = scrub('Authorization: Bearer abc.def.ghi', { home: '/h' });
    expect(hdr).not.toContain('abc.def.ghi');
  });

  test('secret-shaped key=value keeps the key, redacts the value', () => {
    const out = scrub('token=abc123secret api_key: "xyz789" password=hunter2', { home: '/h' });
    expect(out).toContain('token=[redacted]');
    expect(out).toContain('password=[redacted]');
    expect(out).not.toContain('abc123secret');
    expect(out).not.toContain('hunter2');
  });

  test('emails are redacted', () => {
    expect(scrub('reported by jane.doe+test@example.co.uk', { home: '/h' })).toBe(
      'reported by [email]'
    );
  });

  test('clean text passes through untouched', () => {
    const line = '[log] canvas ui/Dashboard.tsx rebuilt in 43ms';
    expect(scrub(line, { home: '/h', repoRoot: '/r' })).toBe(line);
  });
});

describe('log ring', () => {
  test('caps at 500 lines, keeps the newest, tail selects the last N', () => {
    for (let i = 0; i < 620; i++) recordLogLine(`line ${i}`);
    const all = logRingLines(500);
    expect(all.length).toBe(500);
    expect(all[0]).toBe('line 120');
    expect(all[all.length - 1]).toBe('line 619');
    expect(logRingLines(3)).toEqual(['line 617', 'line 618', 'line 619']);
  });

  test('console tap mirrors into the ring and is idempotent', () => {
    installLogRing();
    installLogRing(); // second call must not double-wrap (no duplicate lines)
    console.log('tap-check', { a: 1 });
    const tail = logRingLines(5);
    expect(tail.filter((l) => l.includes('tap-check')).length).toBe(1);
    expect(tail.some((l) => l.includes('[log] tap-check {"a":1}'))).toBe(true);
  });
});

describe('buildDebugBundle()', () => {
  test('assembles scrubbed fields; canvas path scrubbed; no content leaks', () => {
    recordLogLine('boot at /Users/jane/git/acme with token=verysecret');
    const bundle = buildDebugBundle({
      maudeVersion: '9.9.9',
      projectName: 'acme',
      activeCanvas: 'ui/Dashboard.tsx',
      repoRoot: '/Users/jane/git/acme',
    });
    expect(bundle.app.maudeVersion).toBe('9.9.9');
    expect(bundle.app.platform).toBe(process.platform);
    expect(bundle.context.activeCanvas).toBe('ui/Dashboard.tsx');
    expect(bundle.logs.serverLogTail).toContain('<project>');
    expect(bundle.logs.serverLogTail).not.toContain('verysecret');
    expect(bundle.logs.serverLogTail).not.toContain('/Users/jane/git/acme');
  });

  // #119 — a runaway-memory report used to arrive as a number the user
  // eyeballed in Activity Monitor, with nothing in the bundle to confirm it
  // (and a silent log ring, because the heap watch measured the wrong
  // counter). `rss` is the same number the user sees.
  test('carries process memory so a memory report arrives measured', () => {
    const bundle = buildDebugBundle({
      maudeVersion: '9.9.9',
      projectName: 'acme',
      activeCanvas: null,
      repoRoot: '/Users/jane/git/acme',
    });
    expect(bundle.process.rssBytes).toBeGreaterThan(0);
    expect(bundle.process.heapUsedBytes).toBeGreaterThan(0);
    expect(bundle.process.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(bundle.process.uptimeSeconds)).toBe(true);
  });
});
