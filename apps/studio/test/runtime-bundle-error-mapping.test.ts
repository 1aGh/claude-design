// Phase 19 / DDR-044 — runtime-bundle error-message remediation.
// When Bun.build fails because the global install cache is corrupted
// (EISDIR/ENOENT on a cached package's entry file), surface an actionable
// `bun pm cache rm <pkg>` hint instead of just relaying the raw log.

import { describe, expect, test } from 'bun:test';

import { bunCacheRemediation } from '../runtime-bundle.ts';

describe('bunCacheRemediation', () => {
  test('returns null on unrelated build failures (real syntax errors etc.)', () => {
    expect(bunCacheRemediation('react', '[error] Unexpected token <')).toBeNull();
    expect(bunCacheRemediation('react-dom', '[error] Could not resolve "missing-pkg"')).toBeNull();
  });

  test('matches EISDIR on .bun/install/cache + names the base package', () => {
    const log =
      "[error] EISDIR reading '/Users/iagh/.bun/install/cache/react@19.2.6@@@1 @@1/index.js'";
    const out = bunCacheRemediation('react', log);
    expect(out).not.toBeNull();
    expect(out).toMatch(/bun pm cache rm react/);
    expect(out).toMatch(/bad state/);
  });

  test('matches ENOENT on .bun/install/cache too', () => {
    const log = "[error] ENOENT: '/Users/x/.bun/install/cache/react-dom@19.0.0/index.js'";
    const out = bunCacheRemediation('react-dom', log);
    expect(out).toMatch(/bun pm cache rm react-dom/);
  });

  test('subpath specifiers strip to the base package for the cache rm command', () => {
    // bun pm cache works on base package names — "react/jsx-runtime" → "react".
    const log = "[error] EISDIR '/Users/x/.bun/install/cache/react@19.2.6/jsx-runtime.js'";
    const out = bunCacheRemediation('react/jsx-runtime', log);
    expect(out).toMatch(/bun pm cache rm react\b/);
    expect(out).not.toMatch(/bun pm cache rm react\//);
  });

  test('case-insensitive match (Bun has bounced casing across versions)', () => {
    const log = '[error] eisdir reading /Users/x/.bun/install/cache/react@19/index.js';
    expect(bunCacheRemediation('react', log)).not.toBeNull();
  });
});
