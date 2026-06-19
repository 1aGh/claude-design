// Unit: pure helpers from participants-chrome.tsx.

import { describe, expect, test } from 'bun:test';
import { initialsFor, isOwnEditingEcho } from '../participants-chrome.tsx';
import type { ForeignAwareness } from '../use-collab.tsx';

const peer = (over: Partial<ForeignAwareness>): ForeignAwareness => ({
  clientID: 1,
  name: 'Anna',
  color: 'oklch(0.7 0.16 145)',
  cursor: null,
  selection: null,
  annotationSelection: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  editing: null,
  ...over,
});

describe('initialsFor', () => {
  test('two-word name → uppercase first letters', () => {
    expect(initialsFor('Alice Smith')).toBe('AS');
    expect(initialsFor('michał dovrtěl')).toBe('MD');
  });

  test('single-word name → first two letters uppercased', () => {
    expect(initialsFor('alice')).toBe('AL');
    expect(initialsFor('A')).toBe('A');
  });

  test('many-word name → first letter of first two words', () => {
    expect(initialsFor('John Ronald Reuel Tolkien')).toBe('JR');
  });

  test('empty / whitespace → ?', () => {
    expect(initialsFor('')).toBe('?');
    expect(initialsFor('   ')).toBe('?');
  });

  test('handles extra whitespace', () => {
    expect(initialsFor('  Alice   Smith  ')).toBe('AS');
  });
});

describe('isOwnEditingEcho (Phase 30 / DDR-120)', () => {
  test('skips MY own server-side editing echo (my name, editing, no cursor/selection)', () => {
    expect(isOwnEditingEcho(peer({ name: 'Anna', editing: { since: 1 } }), 'Anna')).toBe(true);
  });

  test('keeps a remote peer editing (different name)', () => {
    expect(isOwnEditingEcho(peer({ name: 'Bob', editing: { since: 1 } }), 'Anna')).toBe(false);
  });

  test('keeps MY peer if it has a live cursor (a real second tab, not the echo)', () => {
    expect(
      isOwnEditingEcho(
        peer({ name: 'Anna', editing: { since: 1 }, cursor: { x: 1, y: 2 } }),
        'Anna'
      )
    ).toBe(false);
  });

  test('keeps a peer that is not editing', () => {
    expect(isOwnEditingEcho(peer({ name: 'Anna', editing: null }), 'Anna')).toBe(false);
  });
});
