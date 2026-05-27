// Unit: y-websocket binary protocol round-trips. Validates the frames the
// dev-server emits actually decode against a vanilla yjs/y-protocols peer.

import { describe, expect, test } from 'bun:test';

import * as decoding from 'lib0/decoding';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import {
  MESSAGE_AWARENESS,
  MESSAGE_SYNC,
  encodeAwarenessFrame,
  encodeHandshake,
  encodeSyncUpdate,
  handleMessage,
} from '../collab/protocol.ts';

function readType(frame: Uint8Array): number {
  return decoding.readVarUint(decoding.createDecoder(frame));
}

describe('encodeHandshake', () => {
  test('always emits sync step 1 frame', () => {
    const doc = new Y.Doc();
    const aw = new Awareness(doc);
    const frames = encodeHandshake(doc, aw);
    expect(frames.length).toBeGreaterThanOrEqual(1);
    // biome-ignore lint/style/noNonNullAssertion: length asserted above
    expect(readType(frames[0]!)).toBe(MESSAGE_SYNC);
  });

  test('appends awareness frame when awareness has state', () => {
    const doc = new Y.Doc();
    const aw = new Awareness(doc);
    aw.setLocalState({ name: 'Alice', __connId: 'a' });
    const frames = encodeHandshake(doc, aw);
    expect(frames.length).toBe(2);
    // biome-ignore lint/style/noNonNullAssertion: length asserted above
    expect(readType(frames[0]!)).toBe(MESSAGE_SYNC);
    // biome-ignore lint/style/noNonNullAssertion: length asserted above
    expect(readType(frames[1]!)).toBe(MESSAGE_AWARENESS);
  });

  test('omits awareness frame when awareness is empty', () => {
    const doc = new Y.Doc();
    const aw = new Awareness(doc);
    aw.setLocalState(null); // clear default
    const frames = encodeHandshake(doc, aw);
    expect(frames.length).toBe(1);
  });
});

describe('encodeSyncUpdate', () => {
  test('wraps a Y.Doc update bytes in a sync frame', () => {
    const doc = new Y.Doc();
    doc.getArray('comments').push([{ id: 'c1', text: 'hi' }]);
    const update = Y.encodeStateAsUpdate(doc);
    const frame = encodeSyncUpdate(update);
    expect(readType(frame)).toBe(MESSAGE_SYNC);
    // The wrapped update applied to a fresh doc should reproduce the state.
    const replay = new Y.Doc();
    // Strip the message-type byte and the sync-step opcode by re-running
    // through handleMessage — that's the contract clients use too.
    const aw = new Awareness(replay);
    handleMessage(frame, replay, aw, { send() {} });
    expect((replay.getArray('comments').get(0) as { text: string }).text).toBe('hi');
  });
});

describe('encodeAwarenessFrame', () => {
  test('emits awareness type byte + payload that applies to another Awareness', () => {
    const docA = new Y.Doc();
    const awA = new Awareness(docA);
    awA.setLocalState({ name: 'Alice', __connId: 'a' });
    const frame = encodeAwarenessFrame(awA, [awA.clientID]);
    expect(readType(frame)).toBe(MESSAGE_AWARENESS);

    const docB = new Y.Doc();
    const awB = new Awareness(docB);
    // Drop B's default local state so we can assert exactly one foreign peer
    // landed in B's awareness registry.
    awB.setLocalState(null);
    handleMessage(frame, docB, awB, { send() {} });
    const alice = awB.getStates().get(awA.clientID) as
      | { name: string; __connId: string }
      | undefined;
    expect(alice?.name).toBe('Alice');
    expect(alice?.__connId).toBe('a');
  });
});

describe('handleMessage', () => {
  test('full bidirectional handshake converges two peers', () => {
    // Peer A: has comments
    const docA = new Y.Doc();
    docA.getArray('comments').push([{ id: 'c1', text: 'A wrote this' }]);
    const awA = new Awareness(docA);

    // Peer B: empty
    const docB = new Y.Doc();
    const awB = new Awareness(docB);

    // Full handshake = each peer sends its own sync step 1, the other responds
    // with sync step 2 (the diff). y-websocket's reference impl does the same.
    const aFrames = encodeHandshake(docA, awA);
    const bFrames = encodeHandshake(docB, awB);

    // Cross-feed.
    for (const frame of bFrames) {
      const reply = handleMessage(frame, docA, awA, { send() {} });
      if (reply) handleMessage(reply, docB, awB, { send() {} });
    }
    for (const frame of aFrames) {
      const reply = handleMessage(frame, docB, awB, { send() {} });
      if (reply) handleMessage(reply, docA, awA, { send() {} });
    }

    // After exchange B has A's comment.
    expect(docB.getArray('comments').length).toBe(1);
    const c = docB.getArray('comments').get(0) as { text: string };
    expect(c.text).toBe('A wrote this');
  });

  test('post-handshake encodeSyncUpdate propagates a single edit', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    // A makes an edit and emits the diff via encodeSyncUpdate.
    docA.getArray('comments').push([{ id: 'c2', text: 'later edit' }]);
    const frame = encodeSyncUpdate(Y.encodeStateAsUpdate(docA));

    const awB = new Awareness(docB);
    handleMessage(frame, docB, awB, { send() {} });
    expect(docB.getArray('comments').length).toBe(1);
    expect((docB.getArray('comments').get(0) as { text: string }).text).toBe('later edit');
  });

  test('unknown message type is a noop (forward-compat)', () => {
    const doc = new Y.Doc();
    const aw = new Awareness(doc);
    // Frame with message type 99 (unknown).
    const frame = new Uint8Array([99]);
    const reply = handleMessage(frame, doc, aw, { send() {} });
    expect(reply).toBeNull();
  });
});
