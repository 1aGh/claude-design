// Cloud Phase 3 — the containment invariant's boot-assert (DDR-193 §2).
//
//   > No tenant-authored TSX is ever evaluated by vendor-operated compute.
//
// The thing being tested is a REFUSAL. So the tests that matter are the ones
// that prove the gate fires: a cell exposing an export route, a canvas shell, a
// runtime bundle, or shipping Playwright must not be able to start.
//
// The negative case matters just as much: none of this may fire outside
// workspace mode, or every local dev-server stops booting.

import { describe, expect, test } from 'bun:test';

import {
  assertContainment,
  checkContainment,
  FORBIDDEN_MODULES,
  FORBIDDEN_ROUTE_PREFIXES,
  formatContainmentFailure,
  isForbiddenRoute,
  isWorkspaceMode,
  pruneForWorkspace,
} from '../workspace-mode.ts';

const CELL = { MAUDE_WORKSPACE_MODE: '1' } as NodeJS.ProcessEnv;
const LAPTOP = {} as NodeJS.ProcessEnv;

/** The routes a cell legitimately serves: sync + git + assets, nothing else. */
const ALLOWED_ROUTES = [
  '/_health',
  '/_api/asset',
  '/_api/comments',
  '/_api/annotations',
  '/_api/git-committers',
  '/_config',
  '/_ws',
];

describe('workspace mode detection', () => {
  test('only MAUDE_WORKSPACE_MODE=1 turns it on', () => {
    expect(isWorkspaceMode(CELL)).toBe(true);
    expect(isWorkspaceMode(LAPTOP)).toBe(false);
    expect(isWorkspaceMode({ MAUDE_WORKSPACE_MODE: 'true' })).toBe(false);
    expect(isWorkspaceMode({ MAUDE_WORKSPACE_MODE: '0' })).toBe(false);
    expect(isWorkspaceMode({ MAUDE_WORKSPACE_MODE: '' })).toBe(false);
  });
});

describe('checkContainment — what a cell may serve', () => {
  test('sync + git + asset routes pass', () => {
    const report = checkContainment(ALLOWED_ROUTES);
    expect(report.ok).toBe(true);
    expect(report.routes).toEqual([]);
    expect(report.modules).toEqual([]);
  });

  test('every forbidden prefix is caught, and the reason travels with it', () => {
    for (const { prefix, why } of FORBIDDEN_ROUTE_PREFIXES) {
      const report = checkContainment([...ALLOWED_ROUTES, prefix]);
      expect(report.ok).toBe(false);
      expect(report.routes).toHaveLength(1);
      expect(report.routes[0]?.prefix).toBe(prefix);
      // The message has to teach, not just refuse — this is read by someone who
      // added a route in 2027 and has never heard of this invariant.
      expect(report.routes[0]?.why).toBe(why);
      expect(why.length).toBeGreaterThan(20);
    }
  });

  test('a VARIANT of a forbidden route is still forbidden', () => {
    // The realistic way this gets reintroduced: not `/_api/export` verbatim, but
    // a sibling that does the same thing under a new name.
    for (const route of [
      '/_api/export-jobs',
      '/_api/export/png',
      '/_canvas-shell.html',
      '/_canvas-runtime/react.js',
      '/_ws/acp',
    ]) {
      const report = checkContainment([...ALLOWED_ROUTES, route]);
      expect(report.ok).toBe(false);
      expect(report.routes[0]?.route).toBe(route);
    }
  });

  test('a route that merely CONTAINS a forbidden word is not a false positive', () => {
    // Prefix matching, not substring — `/_api/asset` must not trip on nothing,
    // and a route about exports in its docs must not be blocked by name alone.
    const report = checkContainment([
      '/_api/asset',
      '/_api/export-history-docs-link',
      '/_api/no-export',
      '/_api/git-export-status',
    ]);
    expect(report.routes.map((r) => r.route)).toEqual(['/_api/export-history-docs-link']);
    // ...that one DOES start with /_api/export, and being caught is correct:
    // a surface named "export-*" is exactly what needs a human to look at it.
  });

  test('a resolvable browser automation module fails the check', () => {
    const report = checkContainment(ALLOWED_ROUTES, {
      resolveModule: (s) => s === 'playwright',
    });
    expect(report.ok).toBe(false);
    expect(report.modules).toEqual(['playwright']);
    // All four are checked, not just the popular one.
    const all = checkContainment(ALLOWED_ROUTES, { resolveModule: () => true });
    expect(all.modules).toEqual([...FORBIDDEN_MODULES]);
  });

  test('no resolver supplied ⇒ modules are simply not checked (not silently passed)', () => {
    const report = checkContainment(ALLOWED_ROUTES);
    expect(report.modules).toEqual([]);
  });
});

describe('assertContainment — the boot gate', () => {
  test('OUTSIDE workspace mode it never fires, whatever is exposed', () => {
    // A developer's laptop serves every one of these. If the gate fired here,
    // the entire local product would stop booting.
    expect(() =>
      assertContainment([...ALLOWED_ROUTES, ...FORBIDDEN_ROUTE_PREFIXES.map((f) => f.prefix)], {
        env: LAPTOP,
        resolveModule: () => true,
      })
    ).not.toThrow();
  });

  test('in a cell, a clean route table starts', () => {
    expect(() => assertContainment(ALLOWED_ROUTES, { env: CELL })).not.toThrow();
  });

  test('in a cell, an export route REFUSES TO START', () => {
    expect(() => assertContainment([...ALLOWED_ROUTES, '/_api/export'], { env: CELL })).toThrow(
      /REFUSING TO START/
    );
  });

  test('in a cell, shipping Playwright REFUSES TO START even with clean routes', () => {
    expect(() =>
      assertContainment(ALLOWED_ROUTES, { env: CELL, resolveModule: (s) => s === 'playwright' })
    ).toThrow(/playwright/);
  });

  test('the failure message names the surface, the reason, and the way out', () => {
    let message = '';
    try {
      assertContainment([...ALLOWED_ROUTES, '/_canvas-shell.html'], { env: CELL });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('/_canvas-shell.html');
    expect(message).toContain('DDR-193');
    expect(message).toContain('executes a canvas module');
    // The escape hatch is named so the next engineer doesn't invent a flag.
    expect(message).toContain('Direction B');
    expect(message).toContain('HARD PREREQUISITE');
  });

  test('formatContainmentFailure reports routes and modules together', () => {
    const report = checkContainment([...ALLOWED_ROUTES, '/_api/export'], {
      resolveModule: (s) => s === 'puppeteer',
    });
    const message = formatContainmentFailure(report);
    expect(message).toContain('/_api/export');
    expect(message).toContain('puppeteer');
    expect(message).toContain('Reachable routes');
    expect(message).toContain('Modules that resolve');
  });
});

describe('the vocabulary itself', () => {
  test('the forbidden set covers every way a cell could evaluate tenant code', () => {
    // Pinned deliberately: the realistic loss of this invariant is a refactor
    // quietly dropping an entry while every other test stays green. Changing
    // this list should require changing this test, on purpose.
    expect(FORBIDDEN_ROUTE_PREFIXES.map((f) => f.prefix).sort()).toEqual([
      '/_api/export',
      '/_api/generate',
      '/_api/photo-edit',
      '/_canvas-runtime',
      '/_canvas-shell',
      '/_ws/acp',
    ]);
    expect([...FORBIDDEN_MODULES].sort()).toEqual([
      'playwright',
      'playwright-core',
      'puppeteer',
      'puppeteer-core',
    ]);
  });
});

describe('pruneForWorkspace — how a cell can boot at all', () => {
  test('keeps the sync/git/asset surface and removes exactly the forbidden one', () => {
    const table = {
      '/_health': 'h',
      '/_api/asset': 'a',
      '/_api/comments': 'c',
      '/_api/git-committers': 'g',
      '/_api/export': 'x',
      '/_api/export-jobs': 'x2',
      '/_api/photo-edit': 'p',
      '/_api/generate/keys': 'k',
    };
    const { routes, removed } = pruneForWorkspace(table);

    expect(Object.keys(routes).sort()).toEqual([
      '/_api/asset',
      '/_api/comments',
      '/_api/git-committers',
      '/_health',
    ]);
    expect(removed).toEqual([
      '/_api/export',
      '/_api/export-jobs',
      '/_api/generate/keys',
      '/_api/photo-edit',
    ]);
    // Handlers are carried through by reference — pruning must not rebuild them.
    expect(routes['/_api/asset']).toBe('a');
  });

  test('the pruned table then PASSES the boot assert — prune and assert agree', () => {
    // This is the whole design: the assert is a post-condition on the pruning,
    // so a prefix added to the vocabulary both prunes and is verified, and the
    // two can never drift into disagreeing.
    const table = Object.fromEntries(
      [...FORBIDDEN_ROUTE_PREFIXES.map((f) => f.prefix), '/_health', '/_api/asset'].map((r) => [
        r,
        () => {},
      ])
    );
    const { routes } = pruneForWorkspace(table);
    expect(() => assertContainment(Object.keys(routes), { env: CELL })).not.toThrow();
    // ...and the unpruned table would have refused.
    expect(() => assertContainment(Object.keys(table), { env: CELL })).toThrow(/REFUSING TO START/);
  });

  test('pruning an already-clean table is a no-op', () => {
    const table = Object.fromEntries(ALLOWED_ROUTES.map((r) => [r, () => {}]));
    const { routes, removed } = pruneForWorkspace(table);
    expect(removed).toEqual([]);
    expect(Object.keys(routes).sort()).toEqual([...ALLOWED_ROUTES].sort());
  });

  test('isForbiddenRoute is the single predicate both the table and fetch use', () => {
    // The `fetch` fall-through owns paths that are not in the route table
    // (/_ws/acp, /_canvas-shell.html, /_canvas-runtime/*), so it gates on this
    // same function. One predicate, so the two gates cannot disagree.
    expect(isForbiddenRoute('/_canvas-shell.html')).toBe(true);
    expect(isForbiddenRoute('/_canvas-runtime/react.js')).toBe(true);
    expect(isForbiddenRoute('/_ws/acp')).toBe(true);
    expect(isForbiddenRoute('/_ws')).toBe(false);
    expect(isForbiddenRoute('/_health')).toBe(false);
    expect(isForbiddenRoute('/_api/asset')).toBe(false);
  });
});
