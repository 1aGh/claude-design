// Echo-guard unit tests — Phase 9 Task 4.

import { describe, expect, test } from 'bun:test';

import { createEchoGuard, ECHO_TTL_MS, hashBytes } from '../sync/echo-guard.ts';

describe('hashBytes', () => {
  test('stable hex SHA-256 of bytes', () => {
    expect(hashBytes('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });

  test('matches across string + Uint8Array inputs', () => {
    const buf = new TextEncoder().encode('hello');
    expect(hashBytes(buf)).toBe(hashBytes('hello'));
  });
});

describe('createEchoGuard', () => {
  test('record + consume same hash returns true (echo dropped)', () => {
    const g = createEchoGuard();
    g.record('a.html', 'h1');
    expect(g.consume('a.html', 'h1')).toBe(true);
    // Entry was popped — second consume of the same hash is a fresh match.
    expect(g.consume('a.html', 'h1')).toBe(false);
  });

  test('consume with non-matching hash returns false (real edit)', () => {
    const g = createEchoGuard();
    g.record('a.html', 'h1');
    expect(g.consume('a.html', 'different-hash')).toBe(false);
    // Original entry stays available for matching.
    expect(g.consume('a.html', 'h1')).toBe(true);
  });

  test('consume on path with no pending entries returns false', () => {
    const g = createEchoGuard();
    expect(g.consume('a.html', 'whatever')).toBe(false);
  });

  test('expires entries past TTL', () => {
    const g = createEchoGuard(100);
    g.record('a.html', 'h1', 0);
    // Same instant — still valid.
    expect(g.consume('a.html', 'h1', 50)).toBe(true);

    g.record('a.html', 'h2', 0);
    // Past TTL — expired, not consumed.
    expect(g.consume('a.html', 'h2', 200)).toBe(false);
  });

  test('per-path isolation', () => {
    const g = createEchoGuard();
    g.record('a.html', 'h1');
    g.record('b.html', 'h2');
    expect(g.consume('a.html', 'h2')).toBe(false);
    expect(g.consume('b.html', 'h1')).toBe(false);
    expect(g.consume('a.html', 'h1')).toBe(true);
    expect(g.consume('b.html', 'h2')).toBe(true);
  });

  test('stacked writes — N record() calls allow N consume() matches', () => {
    const g = createEchoGuard();
    g.record('a.html', 'h1');
    g.record('a.html', 'h1');
    g.record('a.html', 'h1');
    expect(g.consume('a.html', 'h1')).toBe(true);
    expect(g.consume('a.html', 'h1')).toBe(true);
    expect(g.consume('a.html', 'h1')).toBe(true);
    expect(g.consume('a.html', 'h1')).toBe(false);
  });

  test('sweep removes expired entries idempotently', () => {
    const g = createEchoGuard(100);
    g.record('a.html', 'h1', 0);
    g.record('b.html', 'h2', 0);
    expect(g.size()).toBe(2);
    g.sweep(50);
    expect(g.size()).toBe(2);
    g.sweep(200);
    expect(g.size()).toBe(0);
    // Double-sweep is fine.
    g.sweep(300);
    expect(g.size()).toBe(0);
  });

  test('default TTL is ECHO_TTL_MS', () => {
    const g = createEchoGuard();
    g.record('a.html', 'h1', 0);
    expect(g.consume('a.html', 'h1', ECHO_TTL_MS - 1)).toBe(true);

    g.record('a.html', 'h2', 0);
    expect(g.consume('a.html', 'h2', ECHO_TTL_MS + 1)).toBe(false);
  });
});
