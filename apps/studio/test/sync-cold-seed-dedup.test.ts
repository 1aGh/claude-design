// Concurrent cold-seed de-duplication — F1 regression.
//
// RCA: `.ai/logs/rca/issue-collab-cold-seed-tsx-duplication.md`. When TWO
// dev-servers seed the SAME canvas slug into an EMPTY hub at the SAME instant,
// each reads `docBody === empty` before the other's `seed-local-up` write has
// propagated, so both apply their (identical) body. Two `applyHtmlToDoc`
// insertions from two Yjs clientIDs into one Y.Text are NOT content-deduped by
// the CRDT — the body doubled (two `export default`), failing the canvas build.
//
// The fix elects a single writer (`syncMeta.seededBy` — Y.Map LWW converges it
// to ONE clientID on every peer) which, inside a bounded post-seed window,
// re-applies the canonical body so `applyHtmlToDoc`'s diff deletes the trailing
// duplicate. These tests pin: (1) simultaneous seed → one copy, (2) a fresh peer
// booting against an already-doubled hub recovers, (3) the sequential control
// stays clean (no over-eager collapse of legitimately-adopted state).

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Y from 'yjs';

import { type CanvasSyncAgent, createCanvasSyncAgent } from '../sync/agent.ts';
import { htmlFromDoc } from '../sync/codec.ts';
import { createEchoGuard } from '../sync/echo-guard.ts';

// A realistic canvas body — the un-buildable failure is `export default` × 2.
const BODY = [
  'import { DesignCanvas } from "@maude/canvas-lib";',
  'export default function Screen() {',
  '  return <DesignCanvas><h1>Shared draft</h1></DesignCanvas>;',
  '}',
  '',
].join('\n');

const TRANSPORT = Symbol('transport');

let dirA: string;
let dirB: string;
let docA: Y.Doc;
let docB: Y.Doc;
let agentA: CanvasSyncAgent | undefined;
let agentB: CanvasSyncAgent | undefined;

function pathsFor(dir: string) {
  return {
    html: join(dir, 'screen.tsx'),
    comments: join(dir, '_comments', 'screen.json'),
    annotations: join(dir, 'screen.annotations.svg'),
  };
}

function writeLocalBody(dir: string, body: string): void {
  // Seed disk before the agent reconciles (the local side of the cold start).
  writeFileSync(pathsFor(dir).html, body);
}

function makeAgent(doc: Y.Doc, dir: string): CanvasSyncAgent {
  const a = createCanvasSyncAgent({
    slug: 'screen',
    doc,
    paths: pathsFor(dir),
    echoGuard: createEchoGuard(),
    flushMs: 0, // synchronous flush via queueMicrotask
  });
  a.start();
  return a;
}

/** Bidirectional full-state exchange, looped until the de-dup repair (which
 *  fires synchronously inside applyUpdate) has propagated + settled. */
function syncDocs(d1: Y.Doc, d2: Y.Doc, rounds = 6): void {
  for (let i = 0; i < rounds; i++) {
    Y.applyUpdate(d2, Y.encodeStateAsUpdate(d1), TRANSPORT);
    Y.applyUpdate(d1, Y.encodeStateAsUpdate(d2), TRANSPORT);
  }
}

beforeEach(() => {
  dirA = mkdtempSync(join(tmpdir(), 'cold-seed-a-'));
  dirB = mkdtempSync(join(tmpdir(), 'cold-seed-b-'));
  docA = new Y.Doc();
  docB = new Y.Doc();
});

afterEach(() => {
  agentA?.stop();
  agentB?.stop();
  agentA = undefined;
  agentB = undefined;
  rmSync(dirA, { recursive: true, force: true });
  rmSync(dirB, { recursive: true, force: true });
});

describe('concurrent cold-seed → single body', () => {
  test('two peers seed identical bodies into an empty hub at once → ONE copy', async () => {
    writeLocalBody(dirA, BODY);
    writeLocalBody(dirB, BODY);
    agentA = makeAgent(docA, dirA);
    agentB = makeAgent(docB, dirB);

    // The race: BOTH reconcile against an empty doc before either propagates.
    await agentA.reconcile();
    await agentB.reconcile();

    // Hub merges both seeds — the moment the duplication would surface.
    syncDocs(docA, docB);

    // Both docs converge to exactly ONE copy (no doubled `export default`).
    expect(htmlFromDoc(docA)).toBe(BODY);
    expect(htmlFromDoc(docB)).toBe(BODY);
    // And the count of `export default` is 1 — the build-breaking signature gone.
    expect(htmlFromDoc(docA).match(/export default/g)?.length).toBe(1);

    // Disk on both peers mirrors the single copy.
    await agentA.flush();
    await agentB.flush();
    expect(readFileSync(pathsFor(dirA).html, 'utf8')).toBe(BODY);
    expect(readFileSync(pathsFor(dirB).html, 'utf8')).toBe(BODY);
  });

  test('adopt-mode concurrent seed also self-heals to one copy', async () => {
    writeLocalBody(dirA, BODY);
    writeLocalBody(dirB, BODY);
    agentA = createCanvasSyncAgent({
      slug: 'screen',
      doc: docA,
      paths: pathsFor(dirA),
      echoGuard: createEchoGuard(),
      flushMs: 0,
      adopt: true,
    });
    agentB = createCanvasSyncAgent({
      slug: 'screen',
      doc: docB,
      paths: pathsFor(dirB),
      echoGuard: createEchoGuard(),
      flushMs: 0,
      adopt: true,
    });
    agentA.start();
    agentB.start();

    await agentA.reconcile();
    await agentB.reconcile();
    syncDocs(docA, docB);

    expect(htmlFromDoc(docA)).toBe(BODY);
    expect(htmlFromDoc(docB)).toBe(BODY);
  });
});

describe('recovery of an already-duplicated hub (requirement #3)', () => {
  test('a peer booting against a doubled doc collapses it on reconcile', async () => {
    writeLocalBody(dirA, BODY);
    // Simulate a hub that already concatenated two identical seeds.
    const t = docA.getText('html');
    t.insert(0, BODY);
    t.insert(BODY.length, BODY);
    expect(htmlFromDoc(docA)).toBe(BODY + BODY);

    agentA = makeAgent(docA, dirA);
    await agentA.reconcile();

    expect(htmlFromDoc(docA)).toBe(BODY);
    expect(htmlFromDoc(docA).match(/export default/g)?.length).toBe(1);
  });
});

describe('sequential control — no over-eager collapse', () => {
  test('B joining after A seeded adopts the single copy (no duplication)', async () => {
    writeLocalBody(dirA, BODY);
    writeLocalBody(dirB, BODY);
    agentA = makeAgent(docA, dirA);
    agentB = makeAgent(docB, dirB);

    // A seeds first and FULLY propagates before B reconciles.
    await agentA.reconcile();
    syncDocs(docA, docB);
    // B now sees the hub already holds the body → noop (adopt), no second seed.
    await agentB.reconcile();
    syncDocs(docA, docB);

    expect(htmlFromDoc(docA)).toBe(BODY);
    expect(htmlFromDoc(docB)).toBe(BODY);
  });
});
