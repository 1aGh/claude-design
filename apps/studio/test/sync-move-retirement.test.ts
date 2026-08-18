// The MOVE protocol — a moved canvas retires its old document (stampMovedTo).
//
// Before this existed, moving a canvas minted a new slug + new document and
// the OLD document simply lived on: the hub kept materialising it at the old
// path, every peer's cold start saw "doc has a body, disk has no file" and
// resurrected it, and the canvas came back as a duplicate on every machine.
// Observed live: `shoj` moved into a folder left BOTH paths on both machines
// and two documents on the hub.
//
// What is pinned here:
//   1. the stamp round-trips and is idempotent;
//   2. a retired doc is WRITE-INERT in every direction, for both disk
//      handlers (agent and projection) — no doc→file materialise, no
//      file→doc revival;
//   3. retirement is an explicit statement, never inferred from emptiness —
//      an un-stamped doc behaves exactly as before.

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Y from 'yjs';

import { createCanvasSyncAgent } from '../sync/agent.ts';
import { applyHtmlToDoc, htmlFromDoc, movedToFromDoc, stampMovedTo } from '../sync/codec.ts';
import { createEchoGuard, hashBytes } from '../sync/echo-guard.ts';
import { createDocProjection } from '../sync/projection.ts';

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'sync-retire-'));
}

describe('the stamp', () => {
  test('round-trips, with where the canvas went', () => {
    const doc = new Y.Doc();
    expect(movedToFromDoc(doc)).toBe(null);
    expect(stampMovedTo(doc, 'ui/folder/screen.tsx')).toBe(true);
    expect(movedToFromDoc(doc)).toBe('ui/folder/screen.tsx');
  });

  test('is idempotent — restamping the same target writes nothing', () => {
    const doc = new Y.Doc();
    stampMovedTo(doc, 'ui/a/b.tsx');
    let updates = 0;
    doc.on('update', () => updates++);
    expect(stampMovedTo(doc, 'ui/a/b.tsx')).toBe(false);
    expect(updates).toBe(0);
  });

  test('crosses the wire like any syncMeta', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    a.on('update', (u: Uint8Array) => Y.applyUpdate(b, u));
    stampMovedTo(a, 'ui/x.tsx');
    expect(movedToFromDoc(b)).toBe('ui/x.tsx');
  });
});

describe('a retired doc is write-inert — the agent', () => {
  test('doc→file: a peer update on a retired doc lands nothing on disk', async () => {
    const dir = tempDir();
    try {
      const doc = new Y.Doc();
      const paths = {
        html: join(dir, 'screen.html'),
        comments: join(dir, '_comments', 'screen.json'),
        annotations: join(dir, 'screen.annotations.svg'),
      };
      const agent = createCanvasSyncAgent({
        slug: 'screen',
        doc,
        paths,
        echoGuard: createEchoGuard(),
        flushMs: 0,
      });
      agent.start();

      stampMovedTo(doc, 'ui/moved/screen.tsx');
      applyHtmlToDoc(doc, '<main>ghost</main>');
      await agent.flush();

      // The resurrection: this file appearing is exactly the bug.
      expect(existsSync(paths.html)).toBe(false);
      agent.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('file→doc: a local edit to a stale pre-move file does not revive the doc', () => {
    const dir = tempDir();
    try {
      const doc = new Y.Doc();
      const paths = {
        html: join(dir, 'screen.html'),
        comments: join(dir, '_comments', 'screen.json'),
        annotations: join(dir, 'screen.annotations.svg'),
      };
      const agent = createCanvasSyncAgent({
        slug: 'screen',
        doc,
        paths,
        echoGuard: createEchoGuard(),
        flushMs: 0,
      });
      agent.start();
      stampMovedTo(doc, 'ui/moved/screen.tsx');

      const bytes = new TextEncoder().encode('<main>stale local edit</main>');
      const applied = agent.applyFromFs({
        path: paths.html,
        bytes,
        hash: hashBytes('<main>stale local edit</main>'),
      });

      expect(applied).toBe(false);
      expect(htmlFromDoc(doc)).toBe('');
      agent.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reconcile materialises nothing from a retired doc', async () => {
    const dir = tempDir();
    try {
      const doc = new Y.Doc();
      applyHtmlToDoc(doc, '<main>content from before the move</main>');
      stampMovedTo(doc, 'ui/moved/screen.tsx');
      const paths = {
        html: join(dir, 'screen.html'),
        comments: join(dir, '_comments', 'screen.json'),
        annotations: join(dir, 'screen.annotations.svg'),
      };
      const agent = createCanvasSyncAgent({
        slug: 'screen',
        doc,
        paths,
        echoGuard: createEchoGuard(),
        flushMs: 0,
      });
      agent.start();
      await agent.reconcile();

      expect(existsSync(paths.html)).toBe(false);
      agent.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('and the CONTROL: without the stamp, the very same doc materialises', async () => {
    // The guard must be the stamp, not some accident of the harness.
    const dir = tempDir();
    try {
      const doc = new Y.Doc();
      applyHtmlToDoc(doc, '<main>live</main>');
      const paths = {
        html: join(dir, 'screen.html'),
        comments: join(dir, '_comments', 'screen.json'),
        annotations: join(dir, 'screen.annotations.svg'),
      };
      const agent = createCanvasSyncAgent({
        slug: 'screen',
        doc,
        paths,
        echoGuard: createEchoGuard(),
        flushMs: 0,
      });
      agent.start();
      await agent.reconcile();

      expect(readFileSync(paths.html, 'utf8')).toBe('<main>live</main>');
      agent.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('a retired doc is write-inert — the projection', () => {
  test('doc→file reconcile + flush land nothing', async () => {
    const dir = tempDir();
    try {
      const doc = new Y.Doc();
      applyHtmlToDoc(doc, '<main>ghost</main>');
      stampMovedTo(doc, 'ui/moved/screen.tsx');
      const proj = createDocProjection({
        slug: 'screen',
        doc,
        paths: { html: join(dir, 'screen.tsx') },
        flushMs: 0,
      });
      proj.start();
      proj.reconcile();
      await proj.flush();

      expect(existsSync(join(dir, 'screen.tsx'))).toBe(false);
      proj.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('file→doc refuses too', () => {
    const dir = tempDir();
    try {
      const doc = new Y.Doc();
      stampMovedTo(doc, 'ui/moved/screen.tsx');
      const abs = join(dir, 'screen.tsx');
      writeFileSync(abs, '<main>stale</main>');
      const proj = createDocProjection({
        slug: 'screen',
        doc,
        paths: { html: abs },
        flushMs: 0,
      });
      proj.start();
      const applied = proj.applyFromFs({
        path: abs,
        bytes: new TextEncoder().encode('<main>stale</main>'),
        hash: hashBytes('<main>stale</main>'),
      });
      expect(applied).toBe(false);
      expect(htmlFromDoc(doc)).toBe('');
      proj.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
