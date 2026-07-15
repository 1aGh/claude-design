// Pure unit tests for client/panels/acp-capabilities.js — the parsing +
// persisted-pick-resolution helpers the dynamic CapabilityBar renders from.
// No hardcoded model/effort/mode list is under test here BY DESIGN: these
// functions must work for whatever the session actually advertises.

import { describe, expect, test } from 'bun:test';

import {
  flattenSelectOptions,
  parseConfigOptions,
  parseModes,
  resolvePersistedPick,
} from '../client/panels/acp-capabilities.js';

describe('parseConfigOptions', () => {
  test('identifies model/effort/fast by id, excludes the mode-mirror entry, and buckets everything else into others', () => {
    const configOptions = [
      { id: 'model', category: 'model', currentValue: 'sonnet', options: [] },
      { id: 'effort', category: 'thought_level', currentValue: 'default', options: [] },
      { id: 'mode', category: 'mode', currentValue: 'default', options: [] },
      { id: 'fast', category: 'model_config', currentValue: 'off', options: [] },
      { id: 'agent', currentValue: 'default', options: [] }, // no category — the documented gap
      { id: 'some-future-option', category: '_custom', currentValue: 'x', options: [] },
    ];
    const { model, effort, fast, others } = parseConfigOptions(configOptions);
    expect(model?.id).toBe('model');
    expect(effort?.id).toBe('effort');
    expect(fast?.id).toBe('fast');
    expect(others.map((o) => o.id)).toEqual(['agent', 'some-future-option']);
  });

  test('tolerates missing/empty/malformed input', () => {
    expect(parseConfigOptions(undefined)).toEqual({ model: null, effort: null, fast: null, others: [] });
    expect(parseConfigOptions(null)).toEqual({ model: null, effort: null, fast: null, others: [] });
    expect(parseConfigOptions([])).toEqual({ model: null, effort: null, fast: null, others: [] });
    // A non-object entry must not throw.
    expect(parseConfigOptions([null, 'x', 42]).others).toEqual([]);
  });

  test('a session with only a subset of options omits the rest as null, not a stale default', () => {
    const { model, effort, fast } = parseConfigOptions([{ id: 'model', options: [] }]);
    expect(model).not.toBeNull();
    expect(effort).toBeNull();
    expect(fast).toBeNull();
  });
});

describe('parseModes', () => {
  test('returns current + available from a real SessionModeState', () => {
    const modes = {
      currentModeId: 'plan',
      availableModes: [
        { id: 'default', name: 'Manual' },
        { id: 'plan', name: 'Plan Mode' },
      ],
    };
    expect(parseModes(modes)).toEqual({
      current: 'plan',
      available: modes.availableModes,
    });
  });

  test('an agent that never advertises modes yields an empty, non-throwing shape', () => {
    expect(parseModes(null)).toEqual({ current: null, available: [] });
    expect(parseModes(undefined)).toEqual({ current: null, available: [] });
    expect(parseModes({})).toEqual({ current: null, available: [] });
  });
});

describe('flattenSelectOptions', () => {
  test('passes through a flat option list unchanged', () => {
    const options = [
      { value: 'a', name: 'A' },
      { value: 'b', name: 'B' },
    ];
    expect(flattenSelectOptions(options)).toEqual(options);
  });

  test('flattens grouped SessionConfigSelectGroup[] into one leaf list', () => {
    const options = [
      { group: 'g1', name: 'Group 1', options: [{ value: 'a', name: 'A' }] },
      { group: 'g2', name: 'Group 2', options: [{ value: 'b', name: 'B' }, { value: 'c', name: 'C' }] },
    ];
    expect(flattenSelectOptions(options).map((o) => o.value)).toEqual(['a', 'b', 'c']);
  });

  test('tolerates missing input', () => {
    expect(flattenSelectOptions(undefined)).toEqual([]);
    expect(flattenSelectOptions(null)).toEqual([]);
  });
});

describe('resolvePersistedPick', () => {
  test('prefers the saved pick when the session still offers it', () => {
    expect(resolvePersistedPick(['opus', 'sonnet'], 'opus', 'sonnet')).toBe('opus');
  });

  test('falls back to the session default when the saved pick is no longer offered', () => {
    expect(resolvePersistedPick(['sonnet', 'haiku'], 'opus', 'sonnet')).toBe('sonnet');
  });

  test('falls back to null when there is neither a valid saved pick nor a default', () => {
    expect(resolvePersistedPick([], 'opus', undefined)).toBeNull();
    expect(resolvePersistedPick([], null, null)).toBeNull();
  });

  test('a null/undefined saved value always defers to the default', () => {
    expect(resolvePersistedPick(['a', 'b'], null, 'b')).toBe('b');
    expect(resolvePersistedPick(['a', 'b'], undefined, 'a')).toBe('a');
  });
});
