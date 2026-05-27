// Unit: pure helpers from participants-chrome.tsx.

import { describe, expect, test } from 'bun:test';

import { initialsFor } from '../participants-chrome.tsx';

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
