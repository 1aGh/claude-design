// The ONE cold-start application body — Sync v2 Increment 0 (DDR-226).
//
// Three things are pinned here:
//
//   1. **The tripwire.** Both architectures import `sync/cold-start-apply.ts`.
//      DDR-102 said the decision table is "a pure module consumed by BOTH sync
//      paths" — the table was, the APPLICATION was not, and the twin switches
//      drifted three times (DDR-076's empty-hub guard written twice, DDR-223's
//      eraser FIXED twice, and the `recover-seed-dup` fallthrough below). This
//      test makes a re-split a red test, the same way
//      `sync-file-membership.test.ts` pins the classifier's hub mirror.
//
//   2. **Totality.** Every `ColdStartAction` reaches a row and produces the
//      right body winner + effect. The compile-time `never` default catches new
//      actions at build time; this catches a hand-edited switch at test time.
//
//   3. **The live regression.** `migrateSeed` on a hub body that is the local
//      body repeated must COLLAPSE it, not keep it. Before this module,
//      migrate-seed's switch had no `recover-seed-dup` case and no default, so
//      the decision fell through to `hub-wins` and the duplicated body was kept
//      and materialized to disk — an un-buildable canvas (two `export default`).

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Y from 'yjs';

import { applyHtmlToDoc } from '../sync/codec.ts';
import type { ColdStartAction, ColdStartDecision } from '../sync/cold-start.ts';
import { decideColdStart } from '../sync/cold-start.ts';
import { applyColdStart } from '../sync/cold-start-apply.ts';
import { migrateSeed } from '../sync/migrate-seed.ts';
import { ORIGINS } from '../sync/origins.ts';

const SYNC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'sync');

/** Every action the table can emit. Kept as a literal list on purpose: if
 *  `ColdStartAction` grows a member, the `satisfies` below fails to compile. */
const ALL_ACTIONS = [
  'noop',
  'materialize-hub',
  'seed-local-up',
  'fast-forward-hub',
  'recover-seed-dup',
  'conflict',
] as const satisfies readonly ColdStartAction[];

const silent = { warn: () => {}, error: () => {} };

/** Record which effect the applier invoked. */
function spyOps() {
  const calls: string[] = [];
  return {
    calls,
    takeHub: () => {
      calls.push('takeHub');
    },
    takeLocal: (body: string) => {
      calls.push(`takeLocal:${body}`);
    },
    checkpointIdentity: (body: string) => {
      calls.push(`checkpoint:${body}`);
    },
  };
}

describe('cold-start-apply — the tripwire (one applier, both architectures)', () => {
  test('agent.ts and migrate-seed.ts both import cold-start-apply.ts', () => {
    for (const file of ['agent.ts', 'migrate-seed.ts']) {
      const src = readFileSync(join(SYNC_DIR, file), 'utf8');
      expect(src).toContain("from './cold-start-apply.ts'");
      expect(src).toContain('applyColdStart(');
    }
  });

  test('neither caller keeps a private switch over decision.action', () => {
    // The whole point of the module: the row set lives in ONE place. A
    // `switch (decision.action)` reappearing in either caller is the drift
    // this test exists to catch.
    for (const file of ['agent.ts', 'migrate-seed.ts']) {
      const src = readFileSync(join(SYNC_DIR, file), 'utf8');
      expect(src).not.toContain('switch (decision.action)');
    }
  });
});

describe('cold-start-apply — total over every action', () => {
  test.each(ALL_ACTIONS)('%s reaches a row', async (action) => {
    const decision: ColdStartDecision = {
      action,
      reason: 'test',
      ...(action === 'conflict' ? { winner: 'hub' as const } : {}),
    };
    const ops = spyOps();
    const result = await applyColdStart({
      slug: 's',
      decision,
      localBody: 'LOCAL',
      docBody: 'HUB',
      log: silent,
      ...ops,
    });
    expect(result.action).toBe(action);
    expect(['local', 'hub']).toContain(result.bodyWinner);
  });

  test('an action with no row throws instead of silently keeping the hub', async () => {
    const ops = spyOps();
    await expect(
      applyColdStart({
        slug: 's',
        // Deliberately outside the union — the shape a hand-edited table or a
        // stale build would produce.
        decision: { action: 'invented-row' as ColdStartAction, reason: 'test' },
        localBody: 'LOCAL',
        docBody: 'HUB',
        log: silent,
        ...ops,
      })
    ).rejects.toThrow(/unhandled action/);
    expect(ops.calls).toEqual([]);
  });

  test('winners and effects per row', async () => {
    const expected: Array<[ColdStartAction, 'local' | 'hub', string | null]> = [
      ['noop', 'hub', null],
      ['materialize-hub', 'hub', 'takeHub'],
      ['fast-forward-hub', 'hub', 'takeHub'],
      ['seed-local-up', 'local', 'takeLocal:LOCAL'],
      ['recover-seed-dup', 'local', 'takeLocal:LOCAL'],
    ];
    for (const [action, winner, call] of expected) {
      const ops = spyOps();
      const result = await applyColdStart({
        slug: 's',
        decision: { action, reason: 'test' },
        localBody: 'LOCAL',
        docBody: 'HUB',
        log: silent,
        ...ops,
      });
      expect(result.bodyWinner).toBe(winner);
      expect(ops.calls).toEqual(call === null ? [] : [call]);
    }
  });

  test('noop checkpoints identity only when both sides carry the same bytes', async () => {
    const same = spyOps();
    await applyColdStart({
      slug: 's',
      decision: { action: 'noop', reason: 'identical' },
      localBody: 'SAME',
      docBody: 'SAME',
      log: silent,
      ...same,
    });
    expect(same.calls).toEqual(['checkpoint:SAME']);

    const bothEmpty = spyOps();
    await applyColdStart({
      slug: 's',
      decision: { action: 'noop', reason: 'both empty' },
      localBody: null,
      docBody: '',
      log: silent,
      ...bothEmpty,
    });
    expect(bothEmpty.calls).toEqual([]);
  });
});

describe('cold-start-apply — DDR-102 fail-closed, in one place', () => {
  test('hub wins normally when the snapshot lands', async () => {
    const ops = spyOps();
    const result = await applyColdStart({
      slug: 's',
      decision: { action: 'conflict', winner: 'hub', reason: 'diverged' },
      localBody: 'LOCAL',
      docBody: 'HUB',
      snapshot: async () => 'ts-1',
      log: silent,
      ...ops,
    });
    expect(result.bodyWinner).toBe('hub');
    expect(result.conflict?.snapshotFailed).toBe(false);
    expect(ops.calls).toEqual(['takeHub']);
  });

  test('a hub-wins verdict is REFUSED when the local snapshot did not land', async () => {
    const ops = spyOps();
    const errors: string[] = [];
    const result = await applyColdStart({
      slug: 's',
      decision: { action: 'conflict', winner: 'hub', reason: 'diverged' },
      localBody: 'LOCAL',
      docBody: 'HUB',
      snapshot: async () => null, // both snapshots fail
      log: { warn: () => {}, error: (m) => errors.push(m) },
      ...ops,
    });
    expect(result.bodyWinner).toBe('local');
    expect(result.conflict?.snapshotFailed).toBe(true);
    expect(ops.calls).toEqual(['takeLocal:LOCAL']);
    expect(errors.join(' ')).toContain('REFUSING to overwrite local');
  });

  test('no snapshot fn at all ⇒ plain newest-wins (standalone wiring)', async () => {
    const ops = spyOps();
    const result = await applyColdStart({
      slug: 's',
      decision: { action: 'conflict', winner: 'hub', reason: 'diverged' },
      localBody: 'LOCAL',
      docBody: 'HUB',
      log: silent,
      ...ops,
    });
    expect(result.bodyWinner).toBe('hub');
    expect(result.conflict?.snapshotFailed).toBe(false);
  });

  test('the conflict report carries the POST-guard winner', async () => {
    const seen: Array<{ winner?: string; snapshotFailed?: boolean }> = [];
    await applyColdStart({
      slug: 's',
      decision: { action: 'conflict', winner: 'hub', reason: 'diverged' },
      localBody: 'LOCAL',
      docBody: 'HUB',
      snapshot: async () => null,
      onConflict: (info) => seen.push(info),
      log: silent,
      ...spyOps(),
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.winner).toBe('local');
    expect(seen[0]?.snapshotFailed).toBe(true);
  });
});

/* ---------------------------------------------------------------------- */

describe('migrate-seed — the recover-seed-dup fallthrough (LIVE regression)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cold-start-apply-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const paths = () => ({
    html: join(dir, 'screen.html'),
    comments: join(dir, 'screen.comments.json'),
    annotations: join(dir, 'screen.annotations.svg'),
    meta: join(dir, 'screen.meta.json'),
    css: join(dir, 'screen.css'),
  });

  test('a doubled hub body is COLLAPSED to one copy, not kept', async () => {
    const p = paths();
    const body = '<main>one copy</main>';
    writeFileSync(p.html, body);

    // The shape of a concurrent cold-seed collision: two peers each seeded the
    // same body into an empty hub and the CRDT concatenated both insertions.
    const doc = new Y.Doc();
    applyHtmlToDoc(doc, body + body, ORIGINS.MIGRATION);

    // Sanity: the table really does emit `recover-seed-dup` for this input.
    expect(
      decideColdStart({
        localBody: body,
        docBody: body + body,
        journalHash: null,
        localMtimeMs: null,
        docBodyEditAtMs: null,
      }).action
    ).toBe('recover-seed-dup');

    const result = await migrateSeed({ slug: 's', doc, paths: p });

    // Before Increment 0 this returned 'hub-wins' and the doc kept `body+body`.
    expect(result).toBe('recover-seed-dup');
    expect(doc.getText('html').toString()).toBe(body);
  });

  test('a THREE-fold repeat collapses too, and re-running is a no-op', async () => {
    const p = paths();
    const body = '<main>x</main>';
    writeFileSync(p.html, body);

    const doc = new Y.Doc();
    applyHtmlToDoc(doc, body.repeat(3), ORIGINS.MIGRATION);

    expect(await migrateSeed({ slug: 's', doc, paths: p })).toBe('recover-seed-dup');
    expect(doc.getText('html').toString()).toBe(body);

    // Idempotent: the second pass sees identical sides.
    expect(await migrateSeed({ slug: 's', doc, paths: p })).toBe('hub-wins');
    expect(doc.getText('html').toString()).toBe(body);
  });
});
