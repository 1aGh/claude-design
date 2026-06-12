// Incident replay — the 2026-06-11 `ui-maskot` data loss (DDR-102).
//
// The shape that ate a day of work: peer A seeded a STALE body to the hub;
// peer B booted later holding a NEWER divergent local file and no journal
// (first link on that machine). v1.1 hub-wins overwrote B's disk with A's
// stale body; the only trace was a conflict notice. This test replays the
// exact shape against the REAL journal + REAL history snapshots and asserts
// the DDR-102 outcome: B loses nothing.
//
// Scenario 2 is the everyday case that must stay silent: B's local matches
// what this machine last synced (journal hash) → the hub being ahead is a
// clean fast-forward, no snapshots, no conflict noise.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Y from 'yjs';

import type { Context } from '../context.ts';
import { createHistory } from '../history.ts';
import { createCanvasSyncAgent } from '../sync/agent.ts';
import { applyHtmlToDoc, htmlFromDoc, stampBodyEdit } from '../sync/codec.ts';
import { createEchoGuard, hashBytes } from '../sync/echo-guard.ts';
import { loadJournal, type SyncJournal } from '../sync/journal.ts';

const STALE_BODY = '<div class="maskot">stale 2551-byte version that seeded the hub</div>';
const NEWER_BODY = '<div class="maskot">a full day of mascot work — 6 kB of it</div>';

let dir: string; // peer B's design root
let journal: SyncJournal;

function paths() {
  return {
    html: join(dir, 'ui', 'maskot.html'),
    comments: join(dir, '_comments', 'ui-maskot.json'),
    annotations: join(dir, 'ui-maskot.annotations.svg'),
  };
}

/** Minimal ctx for the REAL history lib (snapshots under <dir>/_history). */
function historyCtx(): Context {
  return {
    paths: {
      repoRoot: dir,
      designRel: '.',
      designRoot: dir,
      historyDir: join(dir, '_history'),
    },
  } as unknown as Context;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'incident-replay-'));
  mkdirSync(join(dir, 'ui'), { recursive: true });
  journal = loadJournal(dir, { flushMs: 0 });
});

afterEach(() => {
  journal.stop();
  rmSync(dir, { recursive: true, force: true });
});

/** Build peer B's agent against `doc` with the REAL journal + history. */
function makeAgentB(doc: Y.Doc, conflicts: unknown[]) {
  const history = createHistory(historyCtx());
  const agent = createCanvasSyncAgent({
    slug: 'ui-maskot',
    doc,
    paths: paths(),
    echoGuard: createEchoGuard(),
    flushMs: 0,
    journal,
    snapshot: async (content, reason) => {
      try {
        const snap = await history.writeSnapshot('ui/maskot.html', content, reason);
        return snap.ts;
      } catch {
        return null;
      }
    },
    onConflict: (info) => {
      conflicts.push(info);
    },
  });
  agent.start();
  return agent;
}

describe('incident replay — ui-maskot cold-start divergence (DDR-102)', () => {
  test('peer B (newer divergent local, no journal) loses NOTHING: winner=local, dual snapshot, hub gets B body', async () => {
    // Peer A seeded the hub with the stale body an hour ago (older stamp).
    const hubDoc = new Y.Doc();
    hubDoc.transact(() => {
      applyHtmlToDoc(hubDoc, STALE_BODY);
      stampBodyEdit(hubDoc, undefined, Date.now() - 60 * 60 * 1000);
    });

    // Peer B holds a NEWER divergent local file (mtime = now) and has never
    // synced on this machine (journal absent).
    writeFileSync(paths().html, NEWER_BODY);

    const conflicts: Array<{
      kind?: string;
      winner?: string;
      snapshots?: { local?: string; hub?: string };
    }> = [];
    const agent = makeAgentB(hubDoc, conflicts);
    await agent.reconcile();
    agent.stop();

    // 1) B's file is byte-identical on disk — the day of work survived.
    expect(readFileSync(paths().html, 'utf8')).toBe(NEWER_BODY);
    // 2) Winner = local (newer mtime beats the hub's older stamp).
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('cold-start-diverged');
    expect(conflicts[0].winner).toBe('local');
    // 3) BOTH versions snapshotted to _history/ui-maskot/ (real files).
    expect(conflicts[0].snapshots?.local).toBeDefined();
    expect(conflicts[0].snapshots?.hub).toBeDefined();
    const snapDir = join(dir, '_history', 'ui-maskot');
    const blobs = readdirSync(snapDir).filter((f) => f.endsWith('.html'));
    const contents = blobs.map((f) => readFileSync(join(snapDir, f), 'utf8'));
    expect(contents).toContain(NEWER_BODY);
    expect(contents).toContain(STALE_BODY);
    // 4) The hub doc now carries B's body (seeded up, stamped).
    expect(htmlFromDoc(hubDoc)).toBe(NEWER_BODY);
    // 5) The journal checkpointed — the NEXT boot is a clean fast-forward.
    expect(journal.get('ui-maskot')?.bodyHash).toBe(hashBytes(NEWER_BODY));
  });

  test('peer B with a CLEAN journal fast-forwards silently: no snapshot, no conflict', async () => {
    // B previously synced STALE_BODY on this machine (journal checkpoint),
    // disk still holds exactly that; the hub then moved ahead.
    writeFileSync(paths().html, STALE_BODY);
    journal.record('ui-maskot', { bodyHash: hashBytes(STALE_BODY) });

    const hubDoc = new Y.Doc();
    hubDoc.transact(() => {
      applyHtmlToDoc(hubDoc, NEWER_BODY);
      stampBodyEdit(hubDoc);
    });

    const conflicts: unknown[] = [];
    const agent = makeAgentB(hubDoc, conflicts);
    await agent.reconcile();
    agent.stop();

    // Disk fast-forwarded to hub state…
    expect(readFileSync(paths().html, 'utf8')).toBe(NEWER_BODY);
    // …with zero conflict noise and zero history spam.
    expect(conflicts).toHaveLength(0);
    const snapDir = join(dir, '_history', 'ui-maskot');
    let blobs: string[] = [];
    try {
      blobs = readdirSync(snapDir);
    } catch {
      /* dir never created — exactly the point */
    }
    expect(blobs).toHaveLength(0);
    // Journal advanced to the new state.
    expect(journal.get('ui-maskot')?.bodyHash).toBe(hashBytes(NEWER_BODY));
  });

  test('boot order REVERSED (B first, then A): A fast-forwards to B state, nothing lost either way', async () => {
    // B boots first against an empty hub → DDR-064 seed-local-up.
    writeFileSync(paths().html, NEWER_BODY);
    const hubDoc = new Y.Doc();
    const conflictsB: unknown[] = [];
    const agentB = makeAgentB(hubDoc, conflictsB);
    await agentB.reconcile();
    agentB.stop();
    expect(htmlFromDoc(hubDoc)).toBe(NEWER_BODY);
    expect(conflictsB).toHaveLength(0); // empty-hub seed is not a conflict

    // Peer A (separate design root + journal) holds the stale body it synced
    // before — its journal matches its disk → clean fast-forward to B's state.
    const dirA = mkdtempSync(join(tmpdir(), 'incident-replay-A-'));
    mkdirSync(join(dirA, 'ui'), { recursive: true });
    try {
      writeFileSync(join(dirA, 'ui', 'maskot.html'), STALE_BODY);
      const journalA = loadJournal(dirA, { flushMs: 0 });
      journalA.record('ui-maskot', { bodyHash: hashBytes(STALE_BODY) });
      const conflictsA: unknown[] = [];
      const agentA = createCanvasSyncAgent({
        slug: 'ui-maskot',
        doc: hubDoc,
        paths: {
          html: join(dirA, 'ui', 'maskot.html'),
          comments: join(dirA, '_comments', 'ui-maskot.json'),
          annotations: join(dirA, 'ui-maskot.annotations.svg'),
        },
        echoGuard: createEchoGuard(),
        flushMs: 0,
        journal: journalA,
        onConflict: (info) => {
          conflictsA.push(info);
        },
      });
      agentA.start();
      await agentA.reconcile();
      agentA.stop();
      journalA.stop();

      expect(readFileSync(join(dirA, 'ui', 'maskot.html'), 'utf8')).toBe(NEWER_BODY);
      expect(conflictsA).toHaveLength(0);
    } finally {
      rmSync(dirA, { recursive: true, force: true });
    }
  });
});
