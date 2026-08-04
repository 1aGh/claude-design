// Unit: the read-only role gate on collab sync writes — the cloud collab lane
// (RCA issue-cloud-live-collaboration-dead).
//
// A cell's proxy opens the canvas iframe's collab socket at the member's real
// role; a viewer's socket arrives with readOnly=true. The room mirrors the role
// matrix at the WS door the same way the inspector channel does for
// comments-patch/delete: a read-only conn receives everything and publishes
// awareness (presence for viewers is the point of the channel), but its sync
// writes are gated to the COMMENT lane — the one write a viewer holds
// (`viewer.comment === true`). Composes with, never replaces, the DDR-122
// canvas-realm body-lane gate (test/collab-origin-gate.test.ts).

import { describe, expect, test } from 'bun:test';

import * as encoding from 'lib0/encoding';
import { writeUpdate } from 'y-protocols/sync';
import * as Y from 'yjs';

import { MESSAGE_SYNC } from '../collab/protocol.ts';
import { createRoom, type RoomCallbacks, type RoomConn } from '../collab/room.ts';

function makeConn(
  id: string,
  opts: { realm?: 'main' | 'canvas'; readOnly?: boolean } = {}
): RoomConn & { recv: Uint8Array[] } {
  const recv: Uint8Array[] = [];
  return {
    id,
    ...(opts.realm ? { realm: opts.realm } : {}),
    ...(opts.readOnly !== undefined ? { readOnly: opts.readOnly } : {}),
    send(payload: Uint8Array) {
      recv.push(payload);
    },
    recv,
  };
}

function makeCallbacks(): RoomCallbacks {
  return {
    seed() {},
    persistJson() {},
    persistBinary() {},
  };
}

function syncUpdateFrame(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

function peerDelta(room: { doc: Y.Doc }, mutate: (doc: Y.Doc) => void): Uint8Array {
  const peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(room.doc));
  const before = Y.encodeStateVector(peer);
  mutate(peer);
  return Y.encodeStateAsUpdate(peer, before);
}

describe('room read-only gate — cloud viewer sockets', () => {
  test('a read-only canvas conn may write COMMENTS (the viewer capability)', async () => {
    const room = createRoom('viewer-comments', makeCallbacks());
    const viewer = makeConn('viewer', { realm: 'canvas', readOnly: true });
    await room.connect(viewer);

    room.receive(
      viewer,
      syncUpdateFrame(
        peerDelta(room, (d) => d.getArray('comments').push([{ id: 'c1', text: 'a viewer note' }]))
      )
    );

    expect(room.doc.getArray('comments').toArray()).toEqual([{ id: 'c1', text: 'a viewer note' }]);
    expect(room.gateRefusals()).toBe(0);
    await room.destroy();
  });

  test('a read-only conn may NOT write annotations — refused, doc untouched, not broadcast', async () => {
    const room = createRoom('viewer-annotations', makeCallbacks());
    const editor = makeConn('editor', { realm: 'canvas', readOnly: false });
    const viewer = makeConn('viewer', { realm: 'canvas', readOnly: true });
    await room.connect(editor);
    await room.connect(viewer);
    editor.recv.length = 0;
    viewer.recv.length = 0;

    room.receive(
      viewer,
      syncUpdateFrame(peerDelta(room, (d) => d.getMap('annotations').set('svg', '<svg/>')))
    );

    expect(room.doc.getMap('annotations').get('svg')).toBeUndefined();
    expect(room.gateRefusals()).toBe(1);
    expect(editor.recv.length).toBe(0);
    // The refused peer got a corrective full-state frame instead.
    expect(viewer.recv.length).toBe(1);
    await room.destroy();
  });

  test('a read-only conn may not write body lanes either — even on the main realm', async () => {
    const room = createRoom('viewer-body', makeCallbacks());
    const viewer = makeConn('viewer', { realm: 'main', readOnly: true });
    await room.connect(viewer);

    room.receive(
      viewer,
      syncUpdateFrame(peerDelta(room, (d) => d.getText('html').insert(0, 'PWNED')))
    );

    expect(room.doc.getText('html').toString()).toBe('');
    expect(room.gateRefusals()).toBe(1);
    await room.destroy();
  });

  test('a WRITABLE canvas conn (an owner through the cloud lane) still annotates', async () => {
    // The reason the role claim exists at all: annotations are exactly what the
    // cloud complaint was about, and they need an editor-or-better socket.
    const room = createRoom('owner-annotates', makeCallbacks());
    const owner = makeConn('owner', { realm: 'canvas', readOnly: false });
    await room.connect(owner);

    room.receive(
      owner,
      syncUpdateFrame(
        peerDelta(room, (d) => d.getMap('annotations').set('svg', '<svg><rect/></svg>'))
      )
    );

    expect(room.doc.getMap('annotations').get('svg')).toBe('<svg><rect/></svg>');
    expect(room.gateRefusals()).toBe(0);
    await room.destroy();
  });

  test('awareness frames from a read-only conn pass — presence for viewers is the point', async () => {
    const room = createRoom('viewer-presence', makeCallbacks());
    const viewer = makeConn('viewer', { realm: 'canvas', readOnly: true });
    await room.connect(viewer);

    const peerDoc = new Y.Doc();
    const { Awareness, encodeAwarenessUpdate } = await import('y-protocols/awareness');
    const peerAwareness = new Awareness(peerDoc);
    peerAwareness.setLocalState({ name: 'viewing member' });
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 1 /* MESSAGE_AWARENESS */);
    encoding.writeVarUint8Array(
      encoder,
      encodeAwarenessUpdate(peerAwareness, [peerAwareness.clientID])
    );
    room.receive(viewer, encoding.toUint8Array(encoder));

    expect(room.awareness.getStates().get(peerAwareness.clientID)).toEqual({
      name: 'viewing member',
    });
    expect(room.gateRefusals()).toBe(0);
    await room.destroy();
  });

  test('a mixed frame (comment + annotation) from a read-only conn is refused wholesale', async () => {
    const room = createRoom('viewer-mixed', makeCallbacks());
    const viewer = makeConn('viewer', { realm: 'canvas', readOnly: true });
    await room.connect(viewer);

    room.receive(
      viewer,
      syncUpdateFrame(
        peerDelta(room, (d) => {
          d.getArray('comments').push([{ id: 'decoy' }]);
          d.getMap('annotations').set('svg', '<svg/>');
        })
      )
    );

    expect(room.gateRefusals()).toBe(1);
    expect(room.doc.getArray('comments').length).toBe(0);
    expect(room.doc.getMap('annotations').get('svg')).toBeUndefined();
    await room.destroy();
  });

  test('absent readOnly defaults to writable — pre-existing loopback callers unchanged', async () => {
    const room = createRoom('legacy-writable', makeCallbacks());
    const legacy = makeConn('legacy', { realm: 'canvas' });
    await room.connect(legacy);

    room.receive(
      legacy,
      syncUpdateFrame(peerDelta(room, (d) => d.getMap('annotations').set('svg', '<svg/>')))
    );

    expect(room.doc.getMap('annotations').get('svg')).toBe('<svg/>');
    expect(room.gateRefusals()).toBe(0);
    await room.destroy();
  });
});
