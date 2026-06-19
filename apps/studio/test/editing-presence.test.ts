// Unit: soft editing-presence (Phase 30) — the `editing` awareness field at the
// hub trust boundary. Locking is deliberately NOT built (no lease/takeover); the
// `editing` field is a soft heads-up. Every foreign value is attacker-influenceable
// through the semi-trusted hub (DDR-054), so it MUST be validated for VALUE — a
// future / NaN / non-positive `since` is rejected so a hostile peer can't pin a
// permanent badge or poison a `Date.now() - since` age computation.

import { describe, expect, test } from 'bun:test';

import { createRoom, type RoomCallbacks } from '../collab/room.ts';
import { sanitizeForeignState } from '../use-collab.tsx';

const noopCallbacks: RoomCallbacks = {
  seed() {},
  persistJson() {},
  persistBinary() {},
};

describe('sanitizeForeignState — editing field (Phase 30)', () => {
  test('keeps a valid current `editing.since`', () => {
    const now = Date.now();
    const peer = sanitizeForeignState(3, { name: 'Anna', editing: { since: now } });
    expect(peer?.editing).toEqual({ since: now });
  });

  test('absent editing → null (peer is not editing)', () => {
    const peer = sanitizeForeignState(3, { name: 'Anna' });
    expect(peer?.editing).toBeNull();
  });

  test('rejects a FUTURE since beyond the ±5s skew window (no permanent-badge pin)', () => {
    const future = Date.now() + 60_000;
    const peer = sanitizeForeignState(3, { name: 'Anna', editing: { since: future } });
    expect(peer?.editing).toBeNull();
  });

  test('allows a near-future since inside the 5s skew window', () => {
    const skew = Date.now() + 3_000;
    const peer = sanitizeForeignState(3, { name: 'Anna', editing: { since: skew } });
    expect(peer?.editing).toEqual({ since: skew });
  });

  test('rejects NaN / Infinity / non-positive since (no Date-math poison)', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      const peer = sanitizeForeignState(3, { name: 'Anna', editing: { since: bad } });
      expect(peer?.editing).toBeNull();
    }
  });

  test('rejects a non-object / malformed editing payload', () => {
    expect(sanitizeForeignState(3, { name: 'Anna', editing: 'now' })?.editing).toBeNull();
    expect(sanitizeForeignState(3, { name: 'Anna', editing: 12345 })?.editing).toBeNull();
    expect(sanitizeForeignState(3, { name: 'Anna', editing: {} })?.editing).toBeNull();
    expect(sanitizeForeignState(3, { name: 'Anna', editing: { since: '5' } })?.editing).toBeNull();
  });

  test('editing presence does not disturb the other sanitized fields', () => {
    const peer = sanitizeForeignState(9, {
      name: 'Anna',
      cursor: { x: 1, y: 2 },
      editing: { since: Date.now() },
    });
    expect(peer?.name).toBe('Anna');
    expect(peer?.cursor).toEqual({ x: 1, y: 2 });
    expect(peer?.editing).not.toBeNull();
  });
});

describe('room.setAgentEditing — agent presence projected onto awareness (Phase 30)', () => {
  test('projects an editing state that a remote peer can sanitize, then clears it', async () => {
    const room = createRoom('agent-editing-slug', noopCallbacks);
    const since = Date.now();

    room.setAgentEditing({ name: 'Anna', since });
    const states = Array.from(room.awareness.getStates().values());
    expect(states.length).toBe(1);
    // The projected state survives the client trust-boundary sanitizer with the
    // editing field intact (name → re-derived color; since preserved).
    const sanitized = sanitizeForeignState(1, states[0]);
    expect(sanitized?.name).toBe('Anna');
    expect(sanitized?.editing).toEqual({ since });

    room.setAgentEditing(null);
    expect(room.awareness.getStates().size).toBe(0);

    await room.destroy();
  });

  test('re-setting the same {name, since} is a no-op (heartbeat re-emit guard)', async () => {
    const room = createRoom('agent-editing-idempotent', noopCallbacks);
    const since = Date.now();
    let updates = 0;
    room.awareness.on('update', () => {
      updates += 1;
    });

    room.setAgentEditing({ name: 'Anna', since });
    room.setAgentEditing({ name: 'Anna', since }); // identical → no second update
    expect(updates).toBe(1);

    await room.destroy();
  });
});
