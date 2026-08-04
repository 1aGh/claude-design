// Cloud Phase 27 D3 — whose runtime state is this?
//
// `_active.json` and `_canvas-state/<slug>.view.json` are per-MACHINE
// singletons by design (DDR-115), which is right for a desktop and wrong for a
// cell: one studio process serves an owner and a viewer, so a colleague opening
// a canvas switched YOUR tab and their pan moved YOUR camera. Silently — it
// read as flakiness, not as two people sharing one file.
//
// The first test is the one that matters most: OUTSIDE a cell nothing changes.

import { describe, expect, test } from 'bun:test';

import {
  currentSession,
  normalizeSessionKey,
  runInSession,
  sessionDir,
  sessionFile,
} from '../session-scope.ts';

describe('session scope', () => {
  test('with no session every path is byte-for-byte what it was', () => {
    expect(currentSession()).toBe('');
    expect(sessionDir('/repo/.design/_canvas-state')).toBe('/repo/.design/_canvas-state');
    expect(sessionFile('/repo/.design/_active.json')).toBe('/repo/.design/_active.json');
  });

  test('a session gives each member their own subtree and their own active file', () => {
    runInSession('a1b2c3d4e5f60718', () => {
      expect(currentSession()).toBe('a1b2c3d4e5f60718');
      expect(sessionDir('/repo/.design/_canvas-state')).toBe(
        '/repo/.design/_canvas-state/a1b2c3d4e5f60718'
      );
      // A SIBLING of `_active.json`, not a rename: the runtime-state taxonomy,
      // the gitignore and `isMaudeRuntimeState` all match that stem by name,
      // and a sibling keeps every one of them correct with no fourth list.
      expect(sessionFile('/repo/.design/_active.json')).toBe(
        '/repo/.design/_active.a1b2c3d4e5f60718.json'
      );
    });
  });

  test('the scope does not leak past the call', () => {
    runInSession('deadbeef', () => expect(currentSession()).toBe('deadbeef'));
    expect(currentSession()).toBe('');
  });

  test('two sessions do not see each other', () => {
    runInSession('one', () => {
      expect(currentSession()).toBe('one');
      runInSession('two', () => expect(currentSession()).toBe('two'));
      expect(currentSession()).toBe('one');
    });
  });

  test('the scope survives an await — a request is not one tick', async () => {
    await runInSession('async1', async () => {
      await new Promise((r) => setTimeout(r, 5));
      expect(currentSession()).toBe('async1');
      await Promise.resolve();
      expect(currentSession()).toBe('async1');
    });
  });

  test('a key that is not proxy-shaped is refused, not sanitized', () => {
    // The value becomes a path segment, so this is the traversal gate — and it
    // REJECTS rather than strips, because a key we had to repair is not one
    // whose intent we should be guessing. Falling back to the shared singleton
    // is the same behaviour a desktop already has.
    for (const bad of [
      '../../etc/passwd',
      'a/b',
      'a\\b',
      '.',
      '..',
      'has space',
      'x'.repeat(65),
      '',
      null,
      undefined,
    ]) {
      expect(normalizeSessionKey(bad as string)).toBe('');
    }
    for (const good of ['abc123', 'a1b2c3d4e5f60718', 'A_b-9']) {
      expect(normalizeSessionKey(good)).toBe(good);
    }
    // …and a refused key means the shared path, never a traversed one.
    runInSession('../../etc', () => {
      expect(sessionDir('/repo/.design/_canvas-state')).toBe('/repo/.design/_canvas-state');
    });
  });

  test('a file with no extension still gets a distinct per-session name', () => {
    runInSession('k', () => {
      expect(sessionFile('/repo/.design/_active')).toBe('/repo/.design/_active.k');
      // A dot in a PARENT directory must not be mistaken for the extension.
      expect(sessionFile('/repo/my.dir/_active')).toBe('/repo/my.dir/_active.k');
    });
  });
});
