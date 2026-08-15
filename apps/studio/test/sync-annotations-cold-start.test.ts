// Per-lane annotations cold start — the 2026-08-14 annotations eraser.
//
// The eraser: annotations used to follow the BODY winner at cold start, and
// the emptiness guard was `!== ''` — so a hub doc holding the bare 72-byte
// wrapper (`<svg …></svg>`, a non-empty STRING carrying zero strokes)
// overwrote a peer's real strokes whenever the hub won the body, taking the
// `assets/<sha8>` references the asset pull scans with them. Confirmed on
// alligators: a sidecar committed with two `<image>` strokes at 12:45 was the
// empty wrapper on every peer two minutes after the next fleet roll.
//
// The fix has three parts, each pinned here:
//   1. `isEmptyAnnotationsSvg` — the wrapper counts as empty.
//   2. `decideAnnotationsColdStart` — per-lane table; unstamped emptiness
//      never beats content, stamped delete-all is honored by time.
//   3. `stampAnnotationsEdit` riding every local→doc annotations apply
//      (applyFromFs, cold-start seed, adopt) in the same transaction.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Y from 'yjs';

import { type CanvasSyncAgent, createCanvasSyncAgent } from '../sync/agent.ts';
import {
  annotationsEditAtFromDoc,
  annotationsFromDoc,
  applyHtmlToDoc,
  isEmptyAnnotationsSvg,
  stampAnnotationsEdit,
} from '../sync/codec.ts';
import { type AnnotationsColdStartInput, decideAnnotationsColdStart } from '../sync/cold-start.ts';
import { createEchoGuard, hashBytes } from '../sync/echo-guard.ts';
import { migrateSeed } from '../sync/migrate-seed.ts';

/** The exact serialization `strokesToSvg([])` emits — the eraser's payload. */
const EMPTY_WRAPPER = '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"></svg>';
const STROKES =
  '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"><image data-id="s_1" data-tool="image" x="0" y="0" width="160" height="160" href="assets/0327a8e5.png"/></svg>';
const STROKES_B =
  '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"><rect data-id="s_2" x="1" y="1" width="10" height="10"/></svg>';

/* ------------------------------------------------- isEmptyAnnotationsSvg */

describe('isEmptyAnnotationsSvg', () => {
  test('null / empty / whitespace are empty', () => {
    expect(isEmptyAnnotationsSvg(null)).toBe(true);
    expect(isEmptyAnnotationsSvg('')).toBe(true);
    expect(isEmptyAnnotationsSvg('  \n\t ')).toBe(true);
  });

  test('the bare wrapper is empty — the eraser regression pin', () => {
    expect(isEmptyAnnotationsSvg(EMPTY_WRAPPER)).toBe(true);
  });

  test('wrapper with surrounding whitespace is empty', () => {
    expect(isEmptyAnnotationsSvg(`  ${EMPTY_WRAPPER}\n`)).toBe(true);
  });

  test('a single stroke is NOT empty', () => {
    expect(isEmptyAnnotationsSvg(STROKES)).toBe(false);
  });
});

/* ------------------------------------------- decideAnnotationsColdStart */

function input(over: Partial<AnnotationsColdStartInput>): AnnotationsColdStartInput {
  return {
    local: null,
    doc: '',
    isEmpty: isEmptyAnnotationsSvg,
    localMtimeMs: null,
    docEditAtMs: null,
    bodyWinner: 'hub',
    ...over,
  };
}

describe('decideAnnotationsColdStart — emptiness vs content', () => {
  test('both empty → none', () => {
    expect(decideAnnotationsColdStart(input({})).winner).toBe('none');
    expect(
      decideAnnotationsColdStart(input({ local: EMPTY_WRAPPER, doc: EMPTY_WRAPPER })).winner
    ).toBe('none');
  });

  test('THE ERASER: unstamped hub wrapper + local strokes + hub body winner → local', () => {
    const d = decideAnnotationsColdStart(
      input({ local: STROKES, doc: EMPTY_WRAPPER, localMtimeMs: 1000, bodyWinner: 'hub' })
    );
    expect(d.winner).toBe('local');
  });

  test('unset hub lane + local strokes → local (seed up), even with hub body winner', () => {
    const d = decideAnnotationsColdStart(
      input({ local: STROKES, doc: '', localMtimeMs: 1000, bodyWinner: 'hub' })
    );
    expect(d.winner).toBe('local');
  });

  test('STAMPED hub delete-all newer than local strokes → hub (deletes are honored)', () => {
    const d = decideAnnotationsColdStart(
      input({ local: STROKES, doc: EMPTY_WRAPPER, localMtimeMs: 1000, docEditAtMs: 2000 })
    );
    expect(d.winner).toBe('hub');
  });

  test('stamped hub delete-all OLDER than local strokes → local', () => {
    const d = decideAnnotationsColdStart(
      input({ local: STROKES, doc: EMPTY_WRAPPER, localMtimeMs: 2000, docEditAtMs: 1000 })
    );
    expect(d.winner).toBe('local');
  });

  test('local absent + hub strokes → hub (clean first sync materializes)', () => {
    const d = decideAnnotationsColdStart(input({ doc: STROKES }));
    expect(d.winner).toBe('hub');
  });

  test('local delete-all (wrapper on disk) newer than hub stamp → local', () => {
    const d = decideAnnotationsColdStart(
      input({ local: EMPTY_WRAPPER, doc: STROKES, localMtimeMs: 2000, docEditAtMs: 1000 })
    );
    expect(d.winner).toBe('local');
  });

  test('local wrapper with no doc stamp → hub (unstamped local emptiness loses too)', () => {
    const d = decideAnnotationsColdStart(
      input({ local: EMPTY_WRAPPER, doc: STROKES, localMtimeMs: 2000 })
    );
    expect(d.winner).toBe('hub');
  });
});

describe('decideAnnotationsColdStart — both non-empty', () => {
  test('equal content → none', () => {
    const d = decideAnnotationsColdStart(input({ local: STROKES, doc: STROKES }));
    expect(d.winner).toBe('none');
  });

  test('newest wins by per-lane stamp: local newer → local', () => {
    const d = decideAnnotationsColdStart(
      input({ local: STROKES, doc: STROKES_B, localMtimeMs: 2000, docEditAtMs: 1000 })
    );
    expect(d.winner).toBe('local');
  });

  test('newest wins by per-lane stamp: doc newer → hub', () => {
    const d = decideAnnotationsColdStart(
      input({ local: STROKES, doc: STROKES_B, localMtimeMs: 1000, docEditAtMs: 2000 })
    );
    expect(d.winner).toBe('hub');
  });

  test('no per-lane stamp → follows the body winner (legacy coupling)', () => {
    expect(
      decideAnnotationsColdStart(
        input({ local: STROKES, doc: STROKES_B, localMtimeMs: 1000, bodyWinner: 'local' })
      ).winner
    ).toBe('local');
    expect(
      decideAnnotationsColdStart(
        input({ local: STROKES, doc: STROKES_B, localMtimeMs: 1000, bodyWinner: 'hub' })
      ).winner
    ).toBe('hub');
  });
});

/* ------------------------------------------------------- codec round-trip */

describe('stampAnnotationsEdit / annotationsEditAtFromDoc', () => {
  test('round-trips; absent stamp reads null', () => {
    const doc = new Y.Doc();
    expect(annotationsEditAtFromDoc(doc)).toBe(null);
    stampAnnotationsEdit(doc, undefined, 12345);
    expect(annotationsEditAtFromDoc(doc)).toBe(12345);
  });
});

/* ------------------------------------------------------ agent integration */

let dir: string;
let agent: CanvasSyncAgent;
let docA: Y.Doc;
let docB: Y.Doc;

function paths() {
  return {
    html: join(dir, 'screen.html'),
    comments: join(dir, '_comments', 'screen.json'),
    annotations: join(dir, 'screen.annotations.svg'),
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sync-ann-cold-'));
  docA = new Y.Doc();
  docB = new Y.Doc();
  const TRANSPORT = Symbol('transport');
  docA.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === TRANSPORT) return;
    Y.applyUpdate(docB, update, TRANSPORT);
  });
  docB.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === TRANSPORT) return;
    Y.applyUpdate(docA, update, TRANSPORT);
  });
});

afterEach(() => {
  agent?.stop();
  rmSync(dir, { recursive: true, force: true });
});

function makeAgent(): CanvasSyncAgent {
  const a = createCanvasSyncAgent({
    slug: 'screen',
    doc: docB,
    paths: paths(),
    echoGuard: createEchoGuard(),
    flushMs: 0,
  });
  a.start();
  return a;
}

describe('cold start — the eraser scenario end to end', () => {
  test('unstamped hub wrapper does NOT erase local strokes; local seeds up + stamps', async () => {
    // Hub holds the stale empty wrapper (what the eraser propagated) with no
    // per-lane stamp — the exact pre-fix state of every wiped canvas.
    docA.getMap('annotations').set('svg', EMPTY_WRAPPER);
    // Local disk holds real strokes with an image reference.
    writeFileSync(paths().annotations, STROKES);

    agent = makeAgent();
    await agent.reconcile();

    // Disk keeps the strokes; the doc now carries them, stamped.
    expect(readFileSync(paths().annotations, 'utf8')).toBe(STROKES);
    expect(annotationsFromDoc(docB)).toBe(STROKES);
    expect(annotationsFromDoc(docA)).toBe(STROKES); // propagated to the hub side
    expect(annotationsEditAtFromDoc(docB)).not.toBe(null);
  });

  test('stamped hub delete-all newer than local strokes IS honored on disk', async () => {
    writeFileSync(paths().annotations, STROKES);
    // Backdate the local file so the hub's delete-all stamp is provably newer.
    const past = new Date(Date.now() - 60_000);
    utimesSync(paths().annotations, past, past);
    docA.transact(() => {
      docA.getMap('annotations').set('svg', EMPTY_WRAPPER);
    });
    stampAnnotationsEdit(docA, undefined, Date.now());

    agent = makeAgent();
    await agent.reconcile();

    expect(readFileSync(paths().annotations, 'utf8')).toBe(EMPTY_WRAPPER);
  });

  test('clean first sync still materializes hub strokes to disk', async () => {
    docA.getMap('annotations').set('svg', STROKES);

    agent = makeAgent();
    await agent.reconcile();

    expect(readFileSync(paths().annotations, 'utf8')).toBe(STROKES);
  });

  test('SHARED-DOC eraser: migrateSeed rescues local strokes from an unstamped hub wrapper', async () => {
    // The cell-side copy of the eraser: hub doc has a newer body (so the body
    // resolution keeps the hub) and a stale unstamped wrapper in the
    // annotations lane; local disk has real strokes.
    const doc = new Y.Doc();
    applyHtmlToDoc(doc, '<main>hub body</main>');
    doc.getMap('annotations').set('svg', EMPTY_WRAPPER);
    writeFileSync(paths().html, '<main>hub body</main>'); // body identical → noop path
    writeFileSync(paths().annotations, STROKES);

    await migrateSeed({ slug: 'screen', doc, paths: paths() });

    // The doc now carries the local strokes, stamped — so the collab room's
    // persistJson materializes strokes, not the wrapper.
    expect(annotationsFromDoc(doc)).toBe(STROKES);
    expect(annotationsEditAtFromDoc(doc)).not.toBe(null);
  });

  test('applyFromFs stamps annotationsEditAt in the same update', () => {
    agent = makeAgent();
    const bytes = new TextEncoder().encode(STROKES);
    const changed = agent.applyFromFs({
      path: paths().annotations,
      bytes,
      hash: hashBytes(STROKES),
    });
    expect(changed).toBe(true);
    expect(annotationsFromDoc(docB)).toBe(STROKES);
    expect(annotationsEditAtFromDoc(docB)).not.toBe(null);
    // The stamp crossed to the other peer with the same update.
    expect(annotationsEditAtFromDoc(docA)).not.toBe(null);
  });
});
