// The file-plane control channel — Sync v2 Increment 2 (DDR-226 §4).
//
// What is pinned here:
//
//   - the dotted name cannot collide with any canvas slug (the "no phantom
//     LEGACY document on an old client" property, which is the whole reason the
//     name has a dot in it);
//   - the control document is never persisted — no empty row in a tenant's
//     document store, so listings, restore drills and canvas counts are
//     unaffected;
//   - a burst of appends is ONE frame, carrying the LATEST head;
//   - a poke frame off the wire is untrusted input and is parsed as such.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Server } from '@hocuspocus/server';

import {
  createFilesPoke,
  documentMap,
  dropCtlAwareness,
  FILES_CTL_DOC,
  isFilesCtlDoc,
  POKE_COALESCE_MS,
  parsePoke,
  withoutCtlPersistence,
} from '../src/files-ctl.mjs';

/** The charset every pre-Sync-v2 client derives a document name from. */
const LEGACY_SLUG_RE = /^[A-Za-z0-9_-]+$/;

/** The hub's own document-name charset (server.mjs / tombstones.mjs). */
const DOCUMENT_NAME_REGEX = /^[A-Za-z0-9._/-]{1,256}$/;

describe('the reserved control document', () => {
  it('is a legal document name to THIS hub', () => {
    assert.match(FILES_CTL_DOC, DOCUMENT_NAME_REGEX);
  });

  it('can NEVER be produced by an older client’s slug charset', () => {
    // This is the property the dot buys. A pre-Sync-v2 desktop derives every
    // document name from a canvas slug; `maude.files` is unreachable from that
    // charset, so it can never be mistaken for a canvas, materialized as a
    // file, or listed as a phantom LEGACY document.
    assert.equal(LEGACY_SLUG_RE.test(FILES_CTL_DOC), false);
    assert.ok(FILES_CTL_DOC.includes('.'));
  });

  it('is branch-independent — one channel per project, not per branch', () => {
    assert.equal(FILES_CTL_DOC.includes('/'), false);
  });

  it('recognises itself and nothing else', () => {
    assert.equal(isFilesCtlDoc(FILES_CTL_DOC), true);
    for (const other of ['maude', 'files', 'maude.file', 'maude.files.x', '', null, undefined]) {
      assert.equal(isFilesCtlDoc(other), false);
    }
  });
});

describe('withoutCtlPersistence', () => {
  it('never stores or loads the control document, and passes everything else through', async () => {
    const stored = [];
    const loaded = [];
    const ext = withoutCtlPersistence({
      async onStoreDocument(d) {
        stored.push(d.documentName);
      },
      async onLoadDocument(d) {
        loaded.push(d.documentName);
      },
    });

    await ext.onStoreDocument({ documentName: FILES_CTL_DOC });
    await ext.onLoadDocument({ documentName: FILES_CTL_DOC });
    assert.deepEqual(stored, []);
    assert.deepEqual(loaded, []);

    await ext.onStoreDocument({ documentName: 'alligators/ui-home' });
    await ext.onLoadDocument({ documentName: 'alligators/ui-home' });
    assert.deepEqual(stored, ['alligators/ui-home']);
    assert.deepEqual(loaded, ['alligators/ui-home']);
  });

  it('tolerates an extension with no hooks at all', async () => {
    const ext = withoutCtlPersistence({});
    await ext.onStoreDocument({ documentName: 'x' });
    await ext.onLoadDocument({ documentName: 'x' });
  });
});

describe('documentMap — the wiring this got wrong once', () => {
  it('finds the map on a REAL `new Server()`, whose documents are one level down', () => {
    // The bug this test exists for: `new Server()` returns a Server, and a
    // Server has NO `documents` — the map lives at `.hocuspocus.documents`.
    // Reading `instance.documents` therefore yielded `undefined`, and because
    // "no document" is a legitimate everyday state (nobody attached), every
    // poke vanished in silence while the unit suite stayed green against a
    // hand-made fake that had the shape the code wished for.
    //
    // Constructed, never listened on: the shape is the whole point.
    const server = new Server({ port: 0, quiet: true });
    assert.equal(server.documents, undefined, 'the library still has the shape that caused this');
    const map = documentMap(server);
    assert.ok(map, 'documentMap must reach through to the Hocuspocus instance');
    assert.equal(typeof map.get, 'function');
  });

  it('accepts the Hocuspocus instance directly too', () => {
    const documents = new Map();
    assert.equal(documentMap({ documents }), documents);
  });

  it('returns null for anything that carries no map at all', () => {
    for (const bad of [null, undefined, {}, { documents: {} }, { hocuspocus: {} }]) {
      assert.equal(documentMap(bad), null);
    }
  });

  it('a poke wired to an object with no map says so LOUDLY, once', () => {
    // The silence is what made the original bug survive a green test run, so
    // the absence of a map must be an error line, not a quiet return.
    const errors = [];
    const t = fakeTimers();
    const poke = createFilesPoke({
      instance: { not: 'an instance' },
      log: { error: (m) => errors.push(m) },
      ...t,
    });
    poke.schedule(1);
    t.tick();
    poke.schedule(2);
    t.tick();
    assert.equal(errors.length, 1, 'loud once, not a flood');
    assert.match(errors[0], /wired to the wrong object/);
    assert.equal(poke.sent(), 0);
  });
});

/** A fake instance whose ctl document records what was broadcast. */
function fakeInstance({ attached = true } = {}) {
  const frames = [];
  const documents = new Map();
  if (attached) {
    documents.set(FILES_CTL_DOC, { broadcastStateless: (p) => frames.push(p) });
  }
  return { instance: { documents }, frames, documents };
}

/** A controllable clock for the coalescer. */
function fakeTimers() {
  let pending = null;
  return {
    setTimeoutImpl: (fn) => {
      pending = fn;
      return { unref() {} };
    },
    clearTimeoutImpl: () => {
      pending = null;
    },
    tick: () => {
      const fn = pending;
      pending = null;
      fn?.();
    },
    armed: () => pending !== null,
  };
}

describe('the poke', () => {
  it('coalesces a burst into ONE frame carrying the LATEST head', () => {
    const { instance, frames } = fakeInstance();
    const t = fakeTimers();
    const poke = createFilesPoke({ instance, ...t });

    for (let seq = 1; seq <= 500; seq += 1) poke.schedule(seq);
    assert.equal(frames.length, 0, 'nothing goes out inside the window');
    t.tick();

    assert.equal(frames.length, 1, '500 appends ⇒ one frame');
    assert.deepEqual(JSON.parse(frames[0]), { t: 'files', head: 500 });
    assert.equal(poke.sent(), 1);
  });

  it('an out-of-order schedule can never lower the head it announces', () => {
    const { instance, frames } = fakeInstance();
    const t = fakeTimers();
    const poke = createFilesPoke({ instance, ...t });
    poke.schedule(9);
    poke.schedule(4);
    t.tick();
    assert.equal(JSON.parse(frames[0]).head, 9);
  });

  it('is a quiet no-op when nobody is attached', () => {
    const { instance, frames } = fakeInstance({ attached: false });
    const t = fakeTimers();
    const poke = createFilesPoke({ instance, ...t });
    poke.schedule(3);
    t.tick();
    assert.deepEqual(frames, []);
    assert.equal(poke.sent(), 0);
  });

  it('a broadcast that throws is a latency event, never a thrown write', () => {
    const errors = [];
    const documents = new Map([
      [
        FILES_CTL_DOC,
        {
          broadcastStateless() {
            throw new Error('socket gone');
          },
        },
      ],
    ]);
    const t = fakeTimers();
    const poke = createFilesPoke({
      instance: { documents },
      log: { error: (m) => errors.push(m) },
      ...t,
    });
    poke.schedule(1);
    t.tick();
    assert.equal(errors.length, 1);
    assert.equal(poke.sent(), 0);
  });

  it('stop() disarms — a shutdown must not emit into a closing socket', () => {
    const { instance, frames } = fakeInstance();
    const t = fakeTimers();
    const poke = createFilesPoke({ instance, ...t });
    poke.schedule(1);
    poke.stop();
    assert.equal(t.armed(), false);
    poke.schedule(2);
    assert.equal(t.armed(), false);
    assert.deepEqual(frames, []);
  });

  it('the coalescing window is the documented 250 ms', () => {
    assert.equal(POKE_COALESCE_MS, 250);
  });
});

describe('parsePoke — the frame is untrusted input', () => {
  it('accepts the exact shape', () => {
    assert.deepEqual(parsePoke(JSON.stringify({ t: 'files', head: 12 })), { head: 12 });
    assert.deepEqual(parsePoke(JSON.stringify({ t: 'files', head: 0 })), { head: 0 });
  });

  it('drops anything else rather than guessing', () => {
    const bad = [
      null,
      undefined,
      42,
      'not json',
      JSON.stringify({ t: 'other', head: 1 }),
      JSON.stringify({ t: 'files' }),
      JSON.stringify({ t: 'files', head: -1 }),
      JSON.stringify({ t: 'files', head: 1.5 }),
      JSON.stringify({ t: 'files', head: '5' }),
      JSON.stringify({ head: 1 }),
      JSON.stringify([1, 2, 3]),
      `{"t":"files","head":1,"pad":"${'x'.repeat(600)}"}`,
    ];
    for (const p of bad) {
      assert.equal(parsePoke(p), null, `should have refused: ${String(p).slice(0, 40)}`);
    }
  });

  it('carries no path, no hash and no bytes — by shape', () => {
    // The frame's entire vocabulary is `t` and `head`. Anything a hostile hub
    // might want to smuggle has nowhere to ride, and the receiver re-reads the
    // journal through the authenticated, scope-filtered route regardless.
    const parsed = parsePoke(
      JSON.stringify({ t: 'files', head: 3, path: 'system/evil.css', sha256: 'ab' })
    );
    assert.deepEqual(parsed, { head: 3 });
  });
});

describe('the control document carries no presence', () => {
  // `readOnly` gates Y content and not awareness, and every valid token of
  // every scope is admitted to this document by design. Without this, a peer
  // could publish arbitrary state — for as many synthetic clientIDs as it
  // liked — to every other peer on the hub, which is a cross-scope broadcast
  // bus wearing a presence hat.
  const states = () =>
    new Map([
      [1, { user: 'alice', payload: 'x'.repeat(64) }],
      [2, { user: 'mallory' }],
    ]);

  it('drops every awareness state on the ctl document', () => {
    const s = states();
    const dropped = dropCtlAwareness({ document: { name: FILES_CTL_DOC }, states: s });
    assert.equal(dropped, true);
    assert.equal(s.size, 0, 'nothing is stored and nothing fans out');
  });

  it('leaves presence on ordinary documents completely alone', () => {
    const s = states();
    const dropped = dropCtlAwareness({ document: { name: 'ws/acme/main/home' }, states: s });
    assert.equal(dropped, false);
    assert.equal(s.size, 2, 'real collaboration still shows who is here');
  });

  it('survives a malformed payload without throwing', () => {
    assert.doesNotThrow(() => dropCtlAwareness({}));
    assert.doesNotThrow(() => dropCtlAwareness({ document: null, states: null }));
    assert.equal(dropCtlAwareness({ document: { name: FILES_CTL_DOC }, states: new Map() }), false);
  });
});
