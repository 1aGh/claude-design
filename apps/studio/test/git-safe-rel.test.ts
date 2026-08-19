// `designRel` and the rels built on it, validated before they reach git —
// F-13 / B12 of the v1.0.0 gate set.
//
// The finding was NOT "argv injection": every `runGit` / `run` call that carries
// a dynamic path already puts it after a `--` separator, so a leading `-` is a
// filename to git rather than a flag. The finding is CONTAINMENT, which `--`
// does nothing about. A rel carrying `..` is a perfectly well-formed pathspec
// that names a file outside the design root — and the autocommit path feeds
// exactly such rels into `git add -- <paths>` inside a workspace cell, with no
// human at the keyboard to notice `.github/workflows/release.yml` acquiring a
// commit.
//
// So the shapes below are the hostile ones, and the two consumers that matter
// are pinned: the containment PREFIX (which must never silently degrade to
// "no filter") and the staging BATCH (which must drop the poisoned rel and keep
// committing everybody else's work).

import { describe, expect, test } from 'bun:test';

import { isSafeGitRel, partitionSafeGitRels, safeGitPrefix } from '../git/safe-rel.ts';

const HOSTILE: [string, string][] = [
  ['../escape', 'parent traversal — the whole point'],
  ['a/../../b', 'traversal in the middle, where a prefix check would not see it'],
  ['..', 'bare parent'],
  ['.', 'bare current — a pathspec meaning "everything"'],
  ['a/./b', 'a no-op segment that normalises differently in two places'],
  ['/etc/passwd', 'absolute'],
  ['C:/Windows/System32', 'Windows-absolute'],
  ['a\\..\\b', 'backslash separators — traversal that survives a forward-slash check'],
  ['--upload-pack=/bin/sh', 'the flag-shaped rel the `--` separator exists for'],
  ['-rf', 'a shorter one'],
  ['a\u0000/../../b', 'NUL — truncates at the syscall boundary, so it is two paths'],
  ['a\u001f/b', 'other control characters'],
  ['a /b', 'trailing space in a segment — invisible in every UI that shows it'],
  ['', 'empty'],
  [`${'x/'.repeat(300)}y`, 'past the length cap'],
];

const BENIGN = [
  '.design/ui/screen.tsx',
  '.design/system/ds/README.md',
  '.design/assets/a1b2c3d4.png',
  'assets/logo.svg',
  '.design/preview/_layout.css',
  '.design/ui/My Canvas.tsx',
  '.design/ui/-not-leading.tsx'.replace('/-not', '/not'),
];

describe('isSafeGitRel', () => {
  for (const [rel, why] of HOSTILE) {
    test(`refuses ${JSON.stringify(rel)} — ${why}`, () => {
      expect(isSafeGitRel(rel)).toBe(false);
    });
  }

  for (const rel of BENIGN) {
    test(`admits ${JSON.stringify(rel)}`, () => {
      expect(isSafeGitRel(rel)).toBe(true);
    });
  }

  test('a non-string is refused rather than coerced', () => {
    for (const v of [null, undefined, 42, {}, ['a']]) {
      expect(isSafeGitRel(v)).toBe(false);
    }
  });
});

describe('safeGitPrefix — an absent prefix and a REFUSED one are different answers', () => {
  test('absent is the empty prefix (no containment filter), and that is legitimate', () => {
    expect(safeGitPrefix(undefined)).toBe('');
    expect(safeGitPrefix('')).toBe('');
    expect(safeGitPrefix(null)).toBe('');
  });

  test('a normal design root normalises', () => {
    expect(safeGitPrefix('.design')).toBe('.design');
    expect(safeGitPrefix('/.design/')).toBe('.design');
    expect(safeGitPrefix('design\\root')).toBe('design/root');
  });

  test('a hostile prefix is null — NOT the empty string', () => {
    // This distinction is the whole reason the function returns `string | null`.
    // Empty means "match everything", so a caller that mapped a refusal onto ''
    // would answer a traversal attempt by WIDENING the scope to the whole
    // repository. The caller (`normPrefix`) falls back to '.design' instead.
    //
    // A LEADING SLASH IS NOT HOSTILE HERE, and this is the one place the prefix
    // reading differs from the pathspec reading. `context.ts` already strips
    // `^/+` off `cfg.designRoot`, i.e. a configured `/.design` has always meant
    // "`.design`, relative to the repo root" — so `/etc/passwd` reads as the
    // prefix `etc/passwd`, which names a directory that does not exist and
    // therefore matches nothing. Harmless as a CONTAINMENT FILTER; still
    // refused by `isSafeGitRel` where it would be used as a PATHSPEC.
    const rootRelative = new Set(['/etc/passwd']);
    for (const [rel] of HOSTILE) {
      if (rel === '') continue; // '' is the absent case, tested above
      if (rootRelative.has(rel)) {
        expect(safeGitPrefix(rel)).toBe('etc/passwd');
        continue;
      }
      expect(safeGitPrefix(rel)).toBeNull();
    }
  });
});

describe('partitionSafeGitRels — one poisoned rel must not wedge the batch', () => {
  test('splits a mixed batch, keeping the order of each side', () => {
    const { safe, refused } = partitionSafeGitRels([
      '.design/ui/a.tsx',
      '../../.github/workflows/release.yml',
      '.design/ui/b.tsx',
      '-rf',
      '.design/system/ds/README.md',
    ]);
    expect(safe).toEqual(['.design/ui/a.tsx', '.design/ui/b.tsx', '.design/system/ds/README.md']);
    expect(refused).toEqual(['../../.github/workflows/release.yml', '-rf']);
  });

  test('an all-clean batch is unchanged', () => {
    const { safe, refused } = partitionSafeGitRels(BENIGN);
    expect(safe).toEqual(BENIGN);
    expect(refused).toEqual([]);
  });

  test('an all-hostile batch stages nothing rather than throwing', () => {
    const { safe, refused } = partitionSafeGitRels(['../a', '/b', '..']);
    expect(safe).toEqual([]);
    expect(refused).toHaveLength(3);
  });
});
