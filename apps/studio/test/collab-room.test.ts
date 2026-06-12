// Unit: Room behavior — two in-memory peers see each other, debounced flush
// fires, flush is idempotent, room teardown is clean.

import { describe, expect, test } from 'bun:test';

import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { encodeAwarenessFrame, handleMessage } from '../collab/protocol.ts';
import { createRoom, type RoomCallbacks, type RoomConn } from '../collab/room.ts';

function makeConn(id: string): RoomConn & { recv: Uint8Array[] } {
  const recv: Uint8Array[] = [];
  return {
    id,
    send(payload: Uint8Array) {
      recv.push(payload);
    },
    recv,
  };
}

function makeCallbacks(): RoomCallbacks & {
  jsonCalls: number;
  binaryCalls: number;
  lastJson: { slug: string; commentsLen: number } | null;
} {
  const cb = {
    jsonCalls: 0,
    binaryCalls: 0,
    lastJson: null as { slug: string; commentsLen: number } | null,
    async seed(_slug: string, _doc: Y.Doc) {
      /* empty */
    },
    async persistJson(slug: string, doc: Y.Doc) {
      cb.jsonCalls++;
      cb.lastJson = { slug, commentsLen: doc.getArray('comments').length };
    },
    async persistBinary(_slug: string, _state: Uint8Array) {
      cb.binaryCalls++;
    },
  };
  return cb;
}

const DEBOUNCE_MS = 800;
const SETTLE_MS = DEBOUNCE_MS + 100;

describe('Room', () => {
  test('two peers converge on Y.Doc updates', async () => {
    const cb = makeCallbacks();
    const room = createRoom('test-slug', cb);
    const A = makeConn('a');
    const B = makeConn('b');

    await room.connect(A);
    await room.connect(B);

    // Drain handshake frames each peer received.
    A.recv.length = 0;
    B.recv.length = 0;

    // Peer A produces an update; route it through the room (as the protocol
    // would). Easiest path: mutate doc directly through a transaction tagged
    // with A.
    room.doc.transact(() => {
      room.doc.getArray('comments').push([{ id: 'c1', text: 'hello' }]);
    }, A);

    // Room broadcasts the encoded update to all peers except A.
    expect(A.recv.length).toBe(0);
    expect(B.recv.length).toBe(1);

    // B replays the frame against its own doc; the comment lands.
    const docB = new Y.Doc();
    const awBStub = (await import('y-protocols/awareness')).Awareness;
    const awB = new awBStub(docB);
    // biome-ignore lint/style/noNonNullAssertion: recv.length asserted in the prior expect()
    handleMessage(B.recv[0]!, docB, awB, { send() {} });
    expect(docB.getArray('comments').length).toBe(1);

    await room.destroy();
  });

  test('debounced flush fires after 800ms of quiescence', async () => {
    const cb = makeCallbacks();
    const room = createRoom('debounce-slug', cb);
    const A = makeConn('a');
    await room.connect(A);

    room.doc.transact(() => {
      room.doc.getArray('comments').push([{ id: 'c1', text: 'one' }]);
    }, A);
    expect(cb.jsonCalls).toBe(0); // not yet — still inside debounce window

    await Bun.sleep(SETTLE_MS);
    expect(cb.jsonCalls).toBe(1);
    expect(cb.binaryCalls).toBe(1);
    expect(cb.lastJson?.commentsLen).toBe(1);

    await room.destroy();
  });

  test('rapid updates collapse to a single flush at quiescence', async () => {
    const cb = makeCallbacks();
    const room = createRoom('coalesce-slug', cb);
    const A = makeConn('a');
    await room.connect(A);

    for (let i = 0; i < 5; i++) {
      room.doc.transact(() => {
        room.doc.getArray('comments').push([{ id: `c${i}`, text: `n${i}` }]);
      }, A);
    }
    expect(cb.jsonCalls).toBe(0);
    await Bun.sleep(SETTLE_MS);
    expect(cb.jsonCalls).toBe(1);
    expect(cb.lastJson?.commentsLen).toBe(5);

    await room.destroy();
  });

  test('explicit flush() bypasses the debounce', async () => {
    const cb = makeCallbacks();
    const room = createRoom('force-flush-slug', cb);
    const A = makeConn('a');
    await room.connect(A);

    room.doc.transact(() => {
      room.doc.getArray('comments').push([{ id: 'c1', text: 'one' }]);
    }, A);
    expect(cb.jsonCalls).toBe(0);

    await room.flush();
    expect(cb.jsonCalls).toBe(1);

    // Idempotent — second flush with no further mutations doesn't write again.
    await room.flush();
    expect(cb.jsonCalls).toBe(1);

    await room.destroy();
  });

  test('disconnect removes the awareness states a conn published', async () => {
    const cb = makeCallbacks();
    const room = createRoom('aw-cleanup-slug', cb);
    const A = makeConn('a');
    await room.connect(A);

    // Alice (conn A) publishes her awareness over the wire — the server learns
    // her clientID belongs to conn 'a' from the update origin (server-authoritative;
    // it does NOT trust a client-supplied __connId). Mirrors the real receive path.
    const clientDoc = new Y.Doc();
    const clientAw = new Awareness(clientDoc);
    clientAw.setLocalState({ name: 'Alice' });
    room.receive(A, encodeAwarenessFrame(clientAw, [clientAw.clientID]));
    expect(room.awareness.getStates().has(clientAw.clientID)).toBe(true);

    room.disconnect(A);
    expect(room.size()).toBe(0);
    // The disconnected conn's awareness state is dropped immediately — no waiting
    // out the ~30s awareness timeout (the phantom-accumulation bug).
    expect(room.awareness.getStates().has(clientAw.clientID)).toBe(false);

    clientAw.destroy();
    clientDoc.destroy();
    await room.destroy();
  });

  test('seed is called once even with concurrent connects', async () => {
    let seedCalls = 0;
    const cb: RoomCallbacks = {
      async seed(_slug, _doc) {
        seedCalls++;
        await Bun.sleep(10);
      },
      async persistJson() {},
      async persistBinary() {},
    };
    const room = createRoom('seed-once-slug', cb);
    const A = makeConn('a');
    const B = makeConn('b');
    await Promise.all([room.connect(A), room.connect(B)]);
    expect(seedCalls).toBe(1);

    await room.destroy();
  });
});
